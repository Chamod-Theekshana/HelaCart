import { BadRequestException } from '@nestjs/common';
import {
  InvalidImageError,
  sanitizeUploadedImage,
  stripImageMetadata,
} from './strip-metadata.js';

const segment = (marker: number, payload: Buffer) => {
  const header = Buffer.alloc(4);
  header[0] = 0xff;
  header[1] = marker;
  header.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([header, payload]);
};
const latin = (text: string) => Buffer.from(text, 'latin1');

const pngChunk = (type: string, data: Buffer) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  return Buffer.concat([length, latin(type), data, Buffer.alloc(4, 0xab)]);
};
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const riffChunk = (fourcc: string, data: Buffer) => {
  const size = Buffer.alloc(4);
  size.writeUInt32LE(data.length);
  return Buffer.concat([
    latin(fourcc),
    size,
    data,
    data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0),
  ]);
};
const webp = (chunks: Buffer[]) => {
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(body.length + 4, 4);
  header.write('WEBP', 8, 'latin1');
  return Buffer.concat([header, body]);
};

describe('Image metadata stripping', () => {
  it('drops EXIF/XMP, comments and other APP segments from JPEG', () => {
    const jfif = segment(0xe0, latin('JFIF\0\x01\x01'));
    const exif = segment(0xe1, latin('Exif\0\0GPS-LATITUDE-6.9271'));
    const xmp = segment(0xe1, latin('http://ns.adobe.com/xap/1.0/\0<x/>'));
    const icc = segment(0xe2, latin('ICC_PROFILE\0\x01\x01profile'));
    const mpf = segment(0xe2, latin('MPF\0secondary image'));
    const photoshop = segment(0xed, latin('Photoshop 3.0\0IPTC'));
    const adobe = segment(0xee, latin('Adobe\0d'));
    const comment = segment(0xfe, latin('taken at home'));
    const dqt = segment(0xdb, Buffer.alloc(65, 1));
    const sos = Buffer.concat([
      segment(0xda, Buffer.from([1, 1, 0, 0, 0x3f, 0])),
      Buffer.from([0x12, 0xff, 0x00, 0x34, 0xff, 0xd9]),
    ]);
    const input = Buffer.concat([
      Buffer.from([0xff, 0xd8]),
      jfif,
      exif,
      xmp,
      icc,
      mpf,
      photoshop,
      adobe,
      comment,
      dqt,
      sos,
    ]);
    const output = stripImageMetadata(input, 'image/jpeg');
    expect(output).toEqual(
      Buffer.concat([Buffer.from([0xff, 0xd8]), jfif, icc, adobe, dqt, sos]),
    );
    expect(output.toString('latin1')).not.toContain('GPS');
    expect(output.toString('latin1')).not.toContain('taken at home');
    expect(output.subarray(-2)).toEqual(Buffer.from([0xff, 0xd9]));
  });

  it('keeps a minimal JPEG intact and rejects corrupt segments', () => {
    const minimal = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    expect(stripImageMetadata(minimal, 'image/jpeg')).toEqual(minimal);
    const truncated = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x40, 0x00]),
      latin('Exif'),
    ]);
    expect(() => stripImageMetadata(truncated, 'image/jpeg')).toThrow(
      InvalidImageError,
    );
    expect(() =>
      stripImageMetadata(Buffer.from([1, 2, 3, 4]), 'image/jpeg'),
    ).toThrow(InvalidImageError);
  });

  it('drops text, EXIF and time chunks from PNG and anything after IEND', () => {
    const ihdr = pngChunk('IHDR', Buffer.alloc(13, 2));
    const idat = pngChunk('IDAT', Buffer.alloc(10, 3));
    const iend = pngChunk('IEND', Buffer.alloc(0));
    const input = Buffer.concat([
      pngSignature,
      ihdr,
      pngChunk('tEXt', latin('Author\0Nimal')),
      pngChunk('eXIf', latin('MM\0*GPS')),
      pngChunk('iTXt', latin('XML:com.adobe.xmp\0')),
      pngChunk('zTXt', latin('Comment\0\0x')),
      idat,
      pngChunk('tIME', Buffer.alloc(7, 1)),
      iend,
      latin('trailing secret'),
    ]);
    expect(stripImageMetadata(input, 'image/png')).toEqual(
      Buffer.concat([pngSignature, ihdr, idat, iend]),
    );
    expect(() =>
      stripImageMetadata(
        Buffer.concat([pngSignature, ihdr.subarray(0, 10)]),
        'image/png',
      ),
    ).toThrow(InvalidImageError);
  });

  it('drops EXIF and XMP chunks from WebP and clears the VP8X flags', () => {
    // VP8X flags: ICC (0x20) | EXIF (0x08) | XMP (0x04).
    const vp8x = riffChunk(
      'VP8X',
      Buffer.from([0x2c, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    );
    const iccp = riffChunk('ICCP', latin('profile'));
    const image = riffChunk('VP8 ', Buffer.alloc(9, 7));
    const input = webp([
      vp8x,
      iccp,
      image,
      riffChunk('EXIF', latin('Exif\0\0GPS')),
      riffChunk('XMP ', latin('<x:xmpmeta/>')),
    ]);
    const output = stripImageMetadata(input, 'image/webp');
    const cleared = Buffer.from(vp8x);
    cleared[8] = 0x20;
    expect(output).toEqual(webp([cleared, iccp, image]));
    expect(output.readUInt32LE(4)).toBe(output.length - 8);
    expect(output.toString('latin1')).not.toContain('GPS');
    expect(input[20]).toBe(0x2c);
  });

  it('rejects malformed WebP and unsupported types', () => {
    const header = webp([riffChunk('VP8 ', Buffer.alloc(4))]);
    header.writeUInt32LE(9_999, 4);
    expect(() => stripImageMetadata(header, 'image/webp')).toThrow(
      InvalidImageError,
    );
    expect(() => stripImageMetadata(Buffer.alloc(4), 'image/gif')).toThrow(
      InvalidImageError,
    );
  });

  it('reports processing failures to the client as a 400', () => {
    expect(() =>
      sanitizeUploadedImage(Buffer.from('not a jpeg'), 'image/jpeg'),
    ).toThrow(BadRequestException);
  });
});
