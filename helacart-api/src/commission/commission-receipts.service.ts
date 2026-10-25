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

export const receiptMaxBytes = 5 * 1024 * 1024;
export type ReceiptFile = { buffer: Buffer; mimetype: string; size: number };
export type StoredReceipt = {
  storageKey: string;
  contentType: string;
  byteSize: number;
};
@Injectable()
export class CommissionReceiptsService {
  constructor(private readonly config: ConfigService) {}
  validate(file?: ReceiptFile): asserts file is ReceiptFile {
    if (
      !file?.buffer?.length ||
      file.size !== file.buffer.length ||
      file.size > receiptMaxBytes
    )
      throw new BadRequestException(
        'Add one receipt image between 1 byte and 5 MB',
      );
    const b = file.buffer;
    const valid =
      file.mimetype === 'image/png'
        ? b.length >= 8 &&
          b
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : file.mimetype === 'image/jpeg'
          ? b.length >= 4 &&
            b[0] === 255 &&
            b[1] === 216 &&
            b[2] === 255 &&
            b.at(-2) === 255 &&
            b.at(-1) === 217
          : file.mimetype === 'image/webp' &&
            b.length >= 12 &&
            b.toString('ascii', 0, 4) === 'RIFF' &&
            b.toString('ascii', 8, 12) === 'WEBP';
    if (!valid)
      throw new BadRequestException(
        'Receipt must be a JPEG, PNG or WebP image matching its file type',
      );
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
        'Private payment receipt storage is not configured',
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
  async upload(sellerId: string, file: ReceiptFile): Promise<StoredReceipt> {
    this.validate(file);
    const { bucket, client } = this.storage();
    const storageKey = `commission-receipts/${sellerId}/${randomUUID()}`;
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
  async remove(receipt: StoredReceipt) {
    const { bucket, client } = this.storage();
    try {
      await client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: receipt.storageKey }),
      );
    } finally {
      client.destroy();
    }
  }
  async read(receipt: StoredReceipt) {
    if (!receipt.storageKey.startsWith('commission-receipts/'))
      throw new ServiceUnavailableException('Receipt unavailable');
    const { bucket, client } = this.storage();
    try {
      const object = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: receipt.storageKey }),
      );
      if (!object.Body || (object.ContentLength ?? 0) > receiptMaxBytes)
        throw new ServiceUnavailableException('Receipt unavailable');
      const bytes = Buffer.from(await object.Body.transformToByteArray());
      if (bytes.length !== receipt.byteSize)
        throw new ServiceUnavailableException('Receipt unavailable');
      return { bytes, contentType: receipt.contentType };
    } finally {
      client.destroy();
    }
  }
}
