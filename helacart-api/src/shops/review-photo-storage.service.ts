import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
export const reviewPhotoMaxBytes = 5 * 1024 * 1024;
export type ReviewPhotoFile = {
  buffer: Buffer;
  mimetype: string;
  size: number;
};
const formats = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;
export type StoredReviewPhoto = {
  id: string;
  storageKey: string;
  contentType: string;
  byteSize: number;
};

@Injectable()
export class ReviewPhotoStorageService {
  constructor(private readonly config: ConfigService) {}
  validate(files: ReviewPhotoFile[]) {
    if (files.length > 3)
      throw new BadRequestException('Add at most 3 review photos');
    for (const file of files) {
      if (!Object.hasOwn(formats, file.mimetype))
        throw new BadRequestException(
          'Review photos must be JPEG, PNG or WebP',
        );
      const bytes = file.buffer;
      if (
        !bytes?.length ||
        bytes.length > reviewPhotoMaxBytes ||
        file.size !== bytes.length
      )
        throw new BadRequestException(
          'Each review photo must be between 1 byte and 5 MB',
        );
      const valid =
        file.mimetype === 'image/png'
          ? bytes.length >= 8 &&
            bytes
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : file.mimetype === 'image/jpeg'
            ? bytes.length >= 4 &&
              bytes[0] === 255 &&
              bytes[1] === 216 &&
              bytes[2] === 255 &&
              bytes.at(-2) === 255 &&
              bytes.at(-1) === 217
            : bytes.length >= 12 &&
              bytes.toString('ascii', 0, 4) === 'RIFF' &&
              bytes.toString('ascii', 8, 12) === 'WEBP';
      if (!valid)
        throw new BadRequestException(
          'Review photo bytes do not match the image type',
        );
    }
  }
  private storage() {
    const bucket = this.config.get<string>('R2_PRIVATE_BUCKET'),
      publicBucket = this.config.get<string>('R2_BUCKET');
    const account = this.config.get<string>('R2_ACCOUNT_ID'),
      accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID'),
      secretAccessKey = this.config.get<string>('R2_SECRET_ACCESS_KEY');
    if (
      !bucket ||
      bucket === publicBucket ||
      !account ||
      !accessKeyId ||
      !secretAccessKey
    )
      throw new ServiceUnavailableException(
        'Private review photo storage is not configured',
      );
    return {
      bucket,
      client: new S3Client({
        region: 'auto',
        endpoint: `https://${account}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: true,
      }),
    };
  }
  async upload(
    reviewId: string,
    files: ReviewPhotoFile[],
  ): Promise<StoredReviewPhoto[]> {
    this.validate(files);
    if (!files.length) return [];
    const { bucket, client } = this.storage();
    const stored: StoredReviewPhoto[] = [];
    try {
      for (const file of files) {
        const id = randomUUID();
        const storageKey = `review-photos/${reviewId}/${id}.${formats[file.mimetype as keyof typeof formats]}`;
        stored.push({
          id,
          storageKey,
          contentType: file.mimetype,
          byteSize: file.size,
        });
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: storageKey,
            Body: file.buffer,
            ContentType: file.mimetype,
            CacheControl: 'private, no-store',
          }),
        );
      }
      return stored;
    } catch (error) {
      await Promise.allSettled(
        stored.map((photo) =>
          client.send(
            new DeleteObjectCommand({ Bucket: bucket, Key: photo.storageKey }),
          ),
        ),
      );
      throw error;
    } finally {
      client.destroy();
    }
  }
  async remove(photos: StoredReviewPhoto[]) {
    if (!photos.length) return;
    const { bucket, client } = this.storage();
    try {
      await Promise.allSettled(
        photos.map((photo) =>
          client.send(
            new DeleteObjectCommand({ Bucket: bucket, Key: photo.storageKey }),
          ),
        ),
      );
    } finally {
      client.destroy();
    }
  }
  async read(photo: {
    storageKey: string;
    contentType: string;
    byteSize: number;
  }) {
    if (!photo.storageKey.startsWith('review-photos/'))
      throw new ServiceUnavailableException('Review photo is unavailable');
    const { bucket, client } = this.storage();
    try {
      const object = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: photo.storageKey }),
      );
      if (!object.Body || (object.ContentLength ?? 0) > reviewPhotoMaxBytes)
        throw new ServiceUnavailableException('Review photo is unavailable');
      const bytes = Buffer.from(await object.Body.transformToByteArray());
      if (bytes.length !== photo.byteSize)
        throw new ServiceUnavailableException('Review photo is unavailable');
      return { bytes, contentType: photo.contentType };
    } finally {
      client.destroy();
    }
  }
}
