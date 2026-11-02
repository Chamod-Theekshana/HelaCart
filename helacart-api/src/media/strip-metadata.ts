import { BadRequestException } from '@nestjs/common';

/**
 * Removes EXIF/GPS, XMP, text and timestamp metadata from uploaded images
 * without re-encoding pixels (contract §12). Pure TypeScript, no dependencies.
 *
 * - JPEG: drops APP1..APP15 and COM segments, keeping APP0 (JFIF), APP14
 *   (Adobe colour transform) and APP2 ICC_PROFILE segments.
 * - PNG: drops tEXt, zTXt, iTXt, eXIf and tIME chunks and anything after IEND.
 *   A file that ends cleanly on a chunk boundary without IEND is passed
 *   through (decoders reject it anyway); a truncated chunk is an error.
 * - WebP: drops EXIF and "XMP " chunks and clears the matching VP8X flags.
 *
 * Throws InvalidImageError for structurally invalid files.
 */
export class InvalidImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidImageError';
  }
}

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

export function stripImageMetadata(bytes: Buffer, mime: string): Buffer {
  if (mime === 'image/jpeg') return stripJpeg(bytes);
  if (mime === 'image/png') return stripPng(bytes);
  if (mime === 'image/webp') return stripWebp(bytes);
  throw new InvalidImageError('Unsupported image type');
}

/** Upload helper: same as stripImageMetadata but reports a 400 to the client. */
export function sanitizeUploadedImage(bytes: Buffer, mime: string): Buffer {
  try {
    return stripImageMetadata(bytes, mime);
  } catch (error) {
    if (error instanceof InvalidImageError)
      throw new BadRequestException(
        'The image could not be processed. Upload a standard JPEG, PNG or WebP file',
      );
    throw error;
  }
}

const icc = Buffer.from('ICC_PROFILE\0', 'latin1');

function stripJpeg(bytes: Buffer): Buffer {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8)
    throw new InvalidImageError('Missing JPEG start marker');
  const parts: Buffer[] = [bytes.subarray(0, 2)];
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff)
      throw new InvalidImageError('Corrupt JPEG segment');
    // Markers may be preceded by any number of 0xFF fill bytes.
    let markerOffset = offset;
    while (markerOffset < bytes.length && bytes[markerOffset] === 0xff)
      markerOffset++;
    if (markerOffset >= bytes.length)
      throw new InvalidImageError('Truncated JPEG marker');
    const marker = bytes[markerOffset];
    const segmentStart = markerOffset - 1;
    if (marker === 0xd9) {
      parts.push(bytes.subarray(segmentStart, markerOffset + 1));
      return Buffer.concat(parts);
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      // Standalone markers carry no length.
      parts.push(bytes.subarray(segmentStart, markerOffset + 1));
      offset = markerOffset + 1;
      continue;
    }
    if (markerOffset + 3 > bytes.length)
      throw new InvalidImageError('Truncated JPEG segment');
    const length = bytes.readUInt16BE(markerOffset + 1);
    const end = markerOffset + 1 + length;
    if (length < 2 || end > bytes.length)
      throw new InvalidImageError('JPEG segment exceeds file size');
    if (marker === 0xda) {
      // Start of scan: entropy-coded data (and any later scans) is copied as is.
      parts.push(bytes.subarray(segmentStart));
      return Buffer.concat(parts);
    }
    const payload = bytes.subarray(markerOffset + 3, end);
    const isApp = marker >= 0xe0 && marker <= 0xef;
    const keep =
      !(isApp || marker === 0xfe) ||
      marker === 0xe0 ||
      marker === 0xee ||
      (marker === 0xe2 &&
        payload.length >= icc.length &&
        payload.subarray(0, icc.length).equals(icc));
    if (keep) parts.push(bytes.subarray(segmentStart, end));
    offset = end;
  }
  throw new InvalidImageError('JPEG has no image data');
}

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const pngDropped = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);

function stripPng(bytes: Buffer): Buffer {
  if (bytes.length < 8 || !bytes.subarray(0, 8).equals(pngSignature))
    throw new InvalidImageError('Missing PNG signature');
  const parts: Buffer[] = [bytes.subarray(0, 8)];
  let offset = 8;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length)
      throw new InvalidImageError('Truncated PNG chunk');
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('latin1', offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (!/^[A-Za-z]{4}$/.test(type) || end > bytes.length)
      throw new InvalidImageError('Corrupt PNG chunk');
    if (!pngDropped.has(type)) parts.push(bytes.subarray(offset, end));
    offset = end;
    // Bytes after IEND are never part of the image; drop them.
    if (type === 'IEND') break;
  }
  return Buffer.concat(parts);
}

const vp8xExifFlag = 0x08;
const vp8xXmpFlag = 0x04;

function stripWebp(bytes: Buffer): Buffer {
  if (
    bytes.length < 12 ||
    bytes.toString('latin1', 0, 4) !== 'RIFF' ||
    bytes.toString('latin1', 8, 12) !== 'WEBP'
  )
    throw new InvalidImageError('Missing WebP header');
  const declared = bytes.readUInt32LE(4) + 8;
  if (declared > bytes.length || declared < 12)
    throw new InvalidImageError('WebP size exceeds file size');
  const chunks: Buffer[] = [];
  let offset = 12;
  while (offset + 8 <= declared) {
    const fourcc = bytes.toString('latin1', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const padded = size + (size % 2);
    const end = offset + 8 + padded;
    if (end > declared && offset + 8 + size !== declared)
      throw new InvalidImageError('Corrupt WebP chunk');
    const chunkEnd = Math.min(end, declared);
    if (fourcc !== 'EXIF' && fourcc !== 'XMP ') {
      let chunk = bytes.subarray(offset, chunkEnd);
      if (fourcc === 'VP8X' && size >= 1) {
        chunk = Buffer.from(chunk);
        chunk[8] &= ~(vp8xExifFlag | vp8xXmpFlag);
      }
      chunks.push(chunk);
    }
    offset = chunkEnd;
  }
  if (!chunks.length) throw new InvalidImageError('WebP has no image data');
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(body.length + 4, 4);
  header.write('WEBP', 8, 'latin1');
  return Buffer.concat([header, body]);
}
