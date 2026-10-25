import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { SellerDocumentKind } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const sellerDocumentMaxBytes = 5 * 1024 * 1024;
const imageTypes = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;
type ImageType = keyof typeof imageTypes;
export type ApplicationFile = {
  buffer: Buffer;
  mimetype: string;
  size: number;
};
export type ApplicationFiles = {
  identityFront?: ApplicationFile[];
  identityBack?: ApplicationFile[];
  businessRegistration?: ApplicationFile[];
};
type StoredDocument = {
  kind: SellerDocumentKind;
  storageKey: string;
  contentType: string;
  byteSize: number;
};

@Injectable()
export class SellerDocumentsService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  validate(files: ApplicationFiles) {
    if (files.identityFront?.length !== 1 || files.identityBack?.length !== 1)
      throw new BadRequestException(
        'Front and back photos of your ID card or driving licence are required',
      );
    if (files.businessRegistration && files.businessRegistration.length !== 1)
      throw new BadRequestException(
        'Upload at most one business registration photo',
      );
    const entries = [
      { kind: SellerDocumentKind.IDENTITY_FRONT, file: files.identityFront[0] },
      { kind: SellerDocumentKind.IDENTITY_BACK, file: files.identityBack[0] },
      ...(files.businessRegistration?.[0]
        ? [
            {
              kind: SellerDocumentKind.BUSINESS_REGISTRATION,
              file: files.businessRegistration[0],
            },
          ]
        : []),
    ];
    for (const { file } of entries) {
      if (!Object.hasOwn(imageTypes, file.mimetype))
        throw new BadRequestException(
          'Document photos must be JPEG, PNG or WebP',
        );
      if (
        !file.buffer?.length ||
        file.buffer.length > sellerDocumentMaxBytes ||
        file.size !== file.buffer.length
      )
        throw new BadRequestException(
          'Each document photo must be between 1 byte and 5 MB',
        );
      const bytes = file.buffer;
      const matches =
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
              bytes[bytes.length - 2] === 255 &&
              bytes[bytes.length - 1] === 217
            : bytes.length >= 12 &&
              bytes.toString('ascii', 0, 4) === 'RIFF' &&
              bytes.toString('ascii', 8, 12) === 'WEBP';
      if (!matches)
        throw new BadRequestException(
          'Document photo bytes do not match the image type',
        );
    }
    return entries;
  }

  private storage() {
    const bucket = this.config.get<string>('R2_PRIVATE_BUCKET');
    const publicBucket = this.config.get<string>('R2_BUCKET');
    const account = this.config.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('R2_SECRET_ACCESS_KEY');
    if (
      !bucket ||
      bucket === publicBucket ||
      !account ||
      !accessKeyId ||
      !secretAccessKey
    )
      throw new ServiceUnavailableException(
        'Private seller document storage is not configured',
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
    sellerId: string,
    files: ApplicationFiles,
  ): Promise<StoredDocument[]> {
    const entries = this.validate(files);
    const { bucket, client } = this.storage();
    const stored: StoredDocument[] = [];
    try {
      for (const { kind, file } of entries) {
        const storageKey = `seller-verification/${sellerId}/${randomUUID()}.${imageTypes[file.mimetype as ImageType]}`;
        // Include attempted uploads in cleanup in case the storage response is interrupted.
        stored.push({
          kind,
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
    } catch {
      await Promise.allSettled(
        stored.map((doc) =>
          client.send(
            new DeleteObjectCommand({ Bucket: bucket, Key: doc.storageKey }),
          ),
        ),
      );
      throw new ServiceUnavailableException(
        'Could not upload verification photos. Please try again.',
      );
    } finally {
      client.destroy();
    }
  }

  async remove(documents: StoredDocument[]) {
    const { bucket, client } = this.storage();
    try {
      await Promise.allSettled(
        documents.map((doc) =>
          client.send(
            new DeleteObjectCommand({ Bucket: bucket, Key: doc.storageKey }),
          ),
        ),
      );
    } finally {
      client.destroy();
    }
  }

  async read(sellerId: string, documentId: string) {
    const document = await this.prisma.sellerApplicationDocument.findFirst({
      where: { id: documentId, sellerId },
    });
    if (!document)
      throw new NotFoundException('Verification document not found');
    const { bucket, client } = this.storage();
    try {
      const result = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: document.storageKey }),
      );
      if (!result.Body) throw new Error('Empty storage response');
      return {
        bytes: Buffer.from(await result.Body.transformToByteArray()),
        contentType: document.contentType,
      };
    } catch {
      throw new ServiceUnavailableException(
        'Could not load this verification photo. Please try again.',
      );
    } finally {
      client.destroy();
    }
  }
}
