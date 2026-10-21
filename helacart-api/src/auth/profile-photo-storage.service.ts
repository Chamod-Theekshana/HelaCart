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

export const profilePhotoMaxBytes = 3 * 1024 * 1024;
export type ProfilePhotoFile = {
  buffer: Buffer;
  mimetype: string;
  size: number;
};
export type StoredProfilePhoto = {
  storageKey: string;
  contentType: string;
  byteSize: number;
};
const formats = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

@Injectable()
export class ProfilePhotoStorageService {
  constructor(private readonly config: ConfigService) {}

  validate(file?: ProfilePhotoFile): asserts file is ProfilePhotoFile {
    if (!file || !Object.hasOwn(formats, file.mimetype))
      throw new BadRequestException('Choose a JPEG, PNG or WebP profile photo');
    const bytes = file.buffer;
    if (
      !bytes?.length ||
      bytes.length > profilePhotoMaxBytes ||
      file.size !== bytes.length
    )
      throw new BadRequestException(
        'Profile photo must be between 1 byte and 3 MB',
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
      throw new BadRequestException('Photo bytes do not match the image type');
  }

  private storage() {
    const bucket = this.config.get<string>('R2_PRIVATE_BUCKET');
    const account = this.config.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('R2_SECRET_ACCESS_KEY');
    if (
      !bucket ||
      bucket === this.config.get<string>('R2_BUCKET') ||
      !account ||
      !accessKeyId ||
      !secretAccessKey
    )
      throw new ServiceUnavailableException(
        'Private profile photo storage is not configured',
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
    userId: string,
    file: ProfilePhotoFile,
  ): Promise<StoredProfilePhoto> {
    this.validate(file);
    const { bucket, client } = this.storage();
    const storageKey = `profile-photos/${userId}/${randomUUID()}.${formats[file.mimetype as keyof typeof formats]}`;
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: storageKey,
          Body: file.buffer,
          ContentType: file.mimetype,
          CacheControl: 'private, no-store',
        }),
      );
      return { storageKey, contentType: file.mimetype, byteSize: file.size };
    } catch (error) {
      await client
        .send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }))
        .catch(() => undefined);
      throw error;
    } finally {
      client.destroy();
    }
  }

  async remove(storageKey: string) {
    if (!storageKey.startsWith('profile-photos/'))
      throw new ServiceUnavailableException('Profile photo is unavailable');
    const { bucket, client } = this.storage();
    try {
      await client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }),
      );
    } finally {
      client.destroy();
    }
  }

  async read(photo: StoredProfilePhoto) {
    if (!photo.storageKey.startsWith('profile-photos/'))
      throw new ServiceUnavailableException('Profile photo is unavailable');
    const { bucket, client } = this.storage();
    try {
      const object = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: photo.storageKey }),
      );
      if (!object.Body || (object.ContentLength ?? 0) > profilePhotoMaxBytes)
        throw new ServiceUnavailableException('Profile photo is unavailable');
      const bytes = Buffer.from(await object.Body.transformToByteArray());
      if (bytes.length !== photo.byteSize)
        throw new ServiceUnavailableException('Profile photo is unavailable');
      return { bytes, contentType: photo.contentType };
    } finally {
      client.destroy();
    }
  }
}
