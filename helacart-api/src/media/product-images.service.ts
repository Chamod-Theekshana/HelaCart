import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
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

const maxBytes = 5 * 1024 * 1024;
const allowed = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;
type AllowedMime = keyof typeof allowed;

@Injectable()
export class ProductImagesService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  async upload(
    sellerId: string,
    productId: string,
    identity: DecodedIdToken,
    request: AuthenticatedRequest,
  ) {
    await this.catalog.requireSellerMember(sellerId, identity, true);
    const type = request.headers['content-type']
      ?.split(';')[0]
      ?.trim() as AllowedMime;
    if (!Object.hasOwn(allowed, type))
      throw new BadRequestException('Use JPEG, PNG or WebP');
    const length = Number(request.headers['content-length']);
    if (Number.isFinite(length) && length > maxBytes)
      throw new BadRequestException('Image must be at most 5 MB');
    const product = await this.prisma.product.findFirst({
      where: { id: productId, sellerId },
      select: { id: true, status: true, imageUrls: true },
    });
    if (!product)
      throw new ConflictException('Product not found for this seller');
    if (product.status === 'PENDING' || product.imageUrls.length >= 5)
      throw new ConflictException(
        'Product is pending review or already has five images',
      );
    const bucket = this.config.get<string>('R2_BUCKET');
    const account = this.config.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('R2_SECRET_ACCESS_KEY');
    const publicBase = this.config.get<string>('R2_PUBLIC_BASE_URL');
    if (!bucket || !account || !accessKeyId || !secretAccessKey || !publicBase)
      throw new ServiceUnavailableException(
        'R2 product image storage is not configured',
      );
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
      const bytes = Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk as Uint8Array);
      size += bytes.length;
      if (size > maxBytes)
        throw new BadRequestException('Image must be at most 5 MB');
      chunks.push(bytes);
    }
    const body = Buffer.concat(chunks);
    if (!this.matches(type, body))
      throw new BadRequestException('Image bytes do not match Content-Type');
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${account}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
    const key = `products/${sellerId}/${productId}/${randomUUID()}.${allowed[type]}`;
    const imageUrl = `${publicBase.replace(/\/$/, '')}/${key}`;
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: type,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      const updated = await this.prisma.$queryRaw<Array<{ id: string }>>`
        UPDATE "Product" AS p SET "imageUrls" = array_append(p."imageUrls", ${imageUrl}),
          "status" = 'DRAFT', "updatedAt" = NOW()
        WHERE p."id" = ${productId}::uuid AND p."sellerId" = ${sellerId}::uuid
          AND p."status" IN ('DRAFT', 'REJECTED', 'APPROVED', 'HIDDEN')
          AND cardinality(p."imageUrls") < 5
          AND EXISTS (SELECT 1 FROM "Seller" s WHERE s."id" = p."sellerId" AND s."status" = 'APPROVED')
        RETURNING p."id"`;
      if (!updated.length)
        throw new ConflictException('Product changed or image limit reached');
      return { imageUrl, productId, status: 'DRAFT' };
    } catch (error) {
      // A failed product update should not leave an unreferenced public image.
      await client
        .send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
        .catch(() => undefined);
      throw error;
    } finally {
      client.destroy();
    }
  }

  private matches(type: AllowedMime, bytes: Buffer) {
    if (type === 'image/png')
      return (
        bytes.length >= 8 &&
        bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      );
    if (type === 'image/jpeg')
      return (
        bytes.length >= 4 &&
        bytes[0] === 255 &&
        bytes[1] === 216 &&
        bytes[2] === 255 &&
        bytes[bytes.length - 2] === 255 &&
        bytes[bytes.length - 1] === 217
      );
    return (
      bytes.length >= 12 &&
      bytes.toString('ascii', 0, 4) === 'RIFF' &&
      bytes.toString('ascii', 8, 12) === 'WEBP'
    );
  }
}
