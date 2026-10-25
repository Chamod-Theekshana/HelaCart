import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { AuthenticatedRequest } from '../auth/firebase-auth.guard.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
const formats = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

@Injectable()
export class ShopImagesService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}
  async upload(
    sellerId: string,
    kind: string,
    identity: DecodedIdToken,
    request: AuthenticatedRequest,
  ) {
    await this.catalog.requireSellerMember(sellerId, identity, true);
    if (kind !== 'logo' && kind !== 'cover')
      throw new BadRequestException('Choose logo or cover');
    const mime = request.headers['content-type']
      ?.split(';')[0]
      ?.trim() as keyof typeof formats;
    if (!Object.hasOwn(formats, mime))
      throw new BadRequestException('Use JPEG, PNG or WebP');
    const maximum = 5 * 1024 * 1024;
    if (Number(request.headers['content-length']) > maximum)
      throw new BadRequestException('Image must be at most 5 MB');
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
      const bytes = Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk as Uint8Array);
      size += bytes.length;
      if (size > maximum)
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
    const bucket = this.config.get<string>('R2_BUCKET');
    const account = this.config.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('R2_SECRET_ACCESS_KEY');
    const publicBase = this.config.get<string>('R2_PUBLIC_BASE_URL');
    if (!bucket || !account || !accessKeyId || !secretAccessKey || !publicBase)
      throw new ServiceUnavailableException(
        'Shop image storage is not configured',
      );
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${account}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
    const key = `shops/${sellerId}/${kind}/${randomUUID()}.${formats[mime]}`;
    const imageUrl = `${publicBase.replace(/\/$/, '')}/${key}`;
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: bytes,
          ContentType: mime,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      await this.prisma.seller.update({
        where: { id: sellerId, status: 'APPROVED' },
        data: kind === 'logo' ? { logoUrl: imageUrl } : { coverUrl: imageUrl },
      });
      return { imageUrl };
    } catch (error) {
      await client
        .send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
        .catch(() => undefined);
      throw error;
    } finally {
      client.destroy();
    }
  }
  async remove(sellerId: string, kind: string, identity: DecodedIdToken) {
    await this.catalog.requireSellerMember(sellerId, identity, true);
    if (kind !== 'logo' && kind !== 'cover')
      throw new BadRequestException('Choose logo or cover');
    await this.prisma.seller.update({
      where: { id: sellerId, status: 'APPROVED' },
      data: kind === 'logo' ? { logoUrl: null } : { coverUrl: null },
    });
    return { removed: true };
  }
}
