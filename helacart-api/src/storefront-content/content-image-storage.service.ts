import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { AuthenticatedRequest } from '../auth/firebase-auth.guard.js';

const formats = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;
export const contentImageMaximum = 5 * 1024 * 1024;
@Injectable()
export class ContentImageStorageService {
  private readonly logger = new Logger(ContentImageStorageService.name);
  constructor(private readonly config: ConfigService) {}
  private client() {
    const account = this.config.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('R2_SECRET_ACCESS_KEY');
    const bucket = this.config.get<string>('R2_BUCKET');
    const publicBase = this.config.get<string>('R2_PUBLIC_BASE_URL');
    if (!account || !accessKeyId || !secretAccessKey || !bucket || !publicBase)
      throw new ServiceUnavailableException(
        'Public image storage is not configured',
      );
    return {
      bucket,
      publicBase: publicBase.replace(/\/$/, ''),
      client: new S3Client({
        region: 'auto',
        endpoint: `https://${account}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: true,
      }),
    };
  }
  async upload(request: AuthenticatedRequest, prefix: string) {
    const mime = request.headers['content-type']
      ?.split(';')[0]
      ?.trim() as keyof typeof formats;
    if (!Object.hasOwn(formats, mime))
      throw new BadRequestException('Use JPEG, PNG or WebP');
    if (Number(request.headers['content-length']) > contentImageMaximum)
      throw new BadRequestException('Image must be at most 5 MB');
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
      const bytes = Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk as Uint8Array);
      size += bytes.length;
      if (size > contentImageMaximum)
        throw new BadRequestException('Image must be at most 5 MB');
      chunks.push(bytes);
    }
    const bytes = Buffer.concat(chunks);
    const matches =
      mime === 'image/png'
        ? bytes.length >= 8 &&
          bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : mime === 'image/jpeg'
          ? bytes.length >= 4 &&
            bytes[0] === 255 &&
            bytes[1] === 216 &&
            bytes[2] === 255 &&
            bytes.at(-2) === 255 &&
            bytes.at(-1) === 217
          : bytes.length >= 12 &&
            bytes.toString('ascii', 0, 4) === 'RIFF' &&
            bytes.toString('ascii', 8, 12) === 'WEBP';
    if (!matches)
      throw new BadRequestException('Image bytes do not match Content-Type');
    const { client, bucket, publicBase } = this.client();
    const storageKey = `storefront/${prefix}/${randomUUID()}.${formats[mime]}`;
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: storageKey,
          Body: bytes,
          ContentType: mime,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      return { imageUrl: `${publicBase}/${storageKey}`, storageKey };
    } catch (error) {
      await client
        .send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }))
        .catch(() =>
          this.logger.warn(
            'An interrupted storefront image upload needs storage cleanup.',
          ),
        );
      throw error;
    } finally {
      client.destroy();
    }
  }
  async remove(storageKey: string | null | undefined) {
    if (
      !storageKey ||
      !/^storefront\/(?:categories\/[a-f0-9-]+|hero)\/[a-f0-9-]+\.(?:jpg|png|webp)$/.test(
        storageKey,
      )
    )
      return;
    const { client, bucket } = this.client();
    try {
      await client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }),
      );
    } finally {
      client.destroy();
    }
  }
  async cleanup(storageKey: string | null | undefined) {
    try {
      await this.remove(storageKey);
    } catch {
      this.logger.warn(
        'An unused storefront image could not be removed; retry storage cleanup.',
      );
    }
  }
  heroKey(url: string | null | undefined) {
    const base = this.config
      .get<string>('R2_PUBLIC_BASE_URL')
      ?.replace(/\/$/, '');
    if (!base || !url?.startsWith(base + '/storefront/hero/')) return null;
    const key = url.slice(base.length + 1);
    return /^storefront\/hero\/[a-f0-9-]+\.(?:jpg|png|webp)$/.test(key)
      ? key
      : null;
  }
}
