import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { BulkPreviewDto, ToolSearchDto } from './business-tools.dto.js';
import { csvDocument, stockCsv } from './business-tools.utils.js';
const options = { timeout: 45000, maxWait: 10000 };
type StockRow = {
  row: number;
  id: string;
  productId: string;
  title: string;
  sku: string;
  before: number;
  reserved: number;
  after: number;
  delta: number;
  error?: string;
};
type ProductRow = {
  id: string;
  title: string;
  sku: string;
  before: string;
  after: string;
  updatedAt: string;
  error?: string;
};
type Preview = { valid: boolean; rows: (StockRow | ProductRow)[] };
const jobSelect = {
  id: true,
  kind: true,
  reason: true,
  preview: true,
  status: true,
  createdAt: true,
  expiresAt: true,
  appliedAt: true,
} as const;
@Injectable()
export class BulkToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly catalog: CatalogService,
    private readonly config: ConfigService,
  ) {}
  private async actor(
    identity: DecodedIdToken,
    sellerId?: string,
    write = false,
  ) {
    if (sellerId)
      return this.catalog.requireSellerMember(sellerId, identity, write);
    if (
      !identity.email_verified ||
      !this.config
        .getOrThrow<string[]>('ADMIN_FIREBASE_UIDS')
        .includes(identity.uid)
    )
      throw new ForbiddenException('Administrator access required');
    return this.auth.getOrCreateProfile(identity);
  }
  async template(sellerId: string, identity: DecodedIdToken, q: ToolSearchDto) {
    await this.actor(identity, sellerId);
    const where: Prisma.ProductVariantWhereInput = {
      sellerId,
      ...(q.q
        ? {
            OR: [
              { sku: { contains: q.q, mode: 'insensitive' } },
              { product: { title: { contains: q.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const rows = await this.prisma.productVariant.findMany({
      where,
      take: 501,
      orderBy: { sku: 'asc' },
      select: { sku: true, onHand: true },
    });
    if (rows.length > 500)
      throw new BadRequestException(
        'More than 500 variants match. Narrow the search before downloading a stock template',
      );
    return csvDocument([
      ['sku', 'on_hand'],
      ...rows.map((r) => [r.sku, r.onHand]),
    ]);
  }
  async history(
    identity: DecodedIdToken,
    sellerId: string | undefined,
    q: ToolSearchDto,
  ) {
    const actor = await this.actor(identity, sellerId),
      where = { actorId: actor.id, sellerId: sellerId ?? null };
    const [items, total] = await Promise.all([
      this.prisma.bulkJob.findMany({
        where,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          kind: true,
          reason: true,
          status: true,
          createdAt: true,
          expiresAt: true,
          appliedAt: true,
        },
      }),
      this.prisma.bulkJob.count({ where }),
    ]);
    return {
      items,
      total,
      page: q.page,
      pageSize: q.limit,
      pages: Math.max(1, Math.ceil(total / q.limit)),
    };
  }
  async preview(
    identity: DecodedIdToken,
    sellerId: string | undefined,
    dto: BulkPreviewDto,
  ) {
    const actor = await this.actor(identity, sellerId, true);
    const allowed = sellerId
      ? ['STOCK_SET', 'PRODUCT_SUBMIT', 'PRODUCT_HIDE']
      : ['PRODUCT_APPROVE', 'PRODUCT_REJECT'];
    if (!allowed.includes(dto.kind))
      throw new ForbiddenException(
        'This bulk operation is not available in this workspace',
      );
    if (
      dto.kind === 'STOCK_SET'
        ? dto.csv === undefined || dto.productIds !== undefined
        : dto.csv !== undefined || !dto.productIds?.length
    )
      throw new BadRequestException(
        'Stock imports require only CSV; product actions require only product IDs',
      );
    const hash = createHash('sha256')
      .update(
        JSON.stringify({
          sellerId: sellerId ?? null,
          kind: dto.kind,
          reason: dto.reason,
          csv: dto.csv,
          productIds: dto.productIds?.slice().sort(),
        }),
      )
      .digest('hex');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${actor.id}::uuid FOR UPDATE`;
      const existing = await tx.bulkJob.findUnique({
        where: {
          actorId_requestKey: { actorId: actor.id, requestKey: dto.requestKey },
        },
      });
      if (existing) {
        if (
          existing.inputHash !== hash ||
          existing.sellerId !== (sellerId ?? null)
        )
          throw new ConflictException(
            'This request key belongs to a different preview',
          );
        return this.present(existing);
      }
      let rows: (StockRow | ProductRow)[];
      if (dto.kind === 'STOCK_SET') {
        const parsed = stockCsv(dto.csv!),
          variants = await tx.productVariant.findMany({
            where: { sellerId, sku: { in: parsed.map((r) => r.sku) } },
            select: {
              id: true,
              productId: true,
              sku: true,
              onHand: true,
              reserved: true,
              product: { select: { title: true } },
            },
          });
        const bySku = new Map(variants.map((v) => [v.sku, v]));
        rows = parsed.map((r) => {
          const v = bySku.get(r.sku);
          return {
            row: r.row,
            id: v?.id ?? '',
            productId: v?.productId ?? '',
            title: v?.product.title ?? 'Unknown SKU',
            sku: r.sku,
            before: v?.onHand ?? 0,
            reserved: v?.reserved ?? 0,
            after: r.onHand,
            delta: r.onHand - (v?.onHand ?? 0),
            ...(!v
              ? { error: 'SKU does not belong to this shop' }
              : r.onHand < v.reserved
                ? { error: 'On-hand stock cannot be below reserved units' }
                : {}),
          };
        });
      } else {
        const products = await tx.product.findMany({
          where: {
            id: { in: dto.productIds },
            ...(sellerId ? { sellerId } : {}),
          },
          select: {
            id: true,
            title: true,
            sku: true,
            status: true,
            updatedAt: true,
            imageUrls: true,
            seller: { select: { status: true } },
            category: { select: { isActive: true } },
          },
        });
        const byId = new Map(products.map((p) => [p.id, p]));
        const after = {
          PRODUCT_SUBMIT: 'PENDING',
          PRODUCT_HIDE: 'HIDDEN',
          PRODUCT_APPROVE: 'APPROVED',
          PRODUCT_REJECT: 'REJECTED',
        }[dto.kind]!;
        rows = dto.productIds!.map((id) => {
          const p = byId.get(id);
          const validStatus =
            p &&
            (dto.kind === 'PRODUCT_SUBMIT'
              ? ['DRAFT', 'REJECTED'].includes(p.status)
              : dto.kind === 'PRODUCT_HIDE'
                ? p.status === 'APPROVED'
                : p.status === 'PENDING');
          const error = !p
            ? 'Product not found in this workspace'
            : !validStatus
              ? 'Product is not in the required status'
              : dto.kind !== 'PRODUCT_REJECT' && p.seller.status !== 'APPROVED'
                ? 'Shop must be approved'
                : (dto.kind === 'PRODUCT_SUBMIT' ||
                      dto.kind === 'PRODUCT_APPROVE') &&
                    !p.category.isActive
                  ? 'Category is inactive'
                  : (dto.kind === 'PRODUCT_SUBMIT' ||
                        dto.kind === 'PRODUCT_APPROVE') &&
                      !p.imageUrls.length
                    ? 'An image is required'
                    : null;
          return {
            id,
            title: p?.title ?? 'Unavailable product',
            sku: p?.sku ?? '',
            before: p?.status ?? '',
            after,
            updatedAt: p?.updatedAt.toISOString() ?? '',
            ...(error ? { error } : {}),
          };
        });
      }
      const preview = { valid: rows.every((r) => !r.error), rows };
      return tx.bulkJob.create({
        data: {
          actorId: actor.id,
          sellerId: sellerId ?? null,
          requestKey: dto.requestKey,
          kind: dto.kind,
          inputHash: hash,
          reason: dto.reason,
          preview: preview as unknown as Prisma.InputJsonValue,
          expiresAt: new Date(Date.now() + 20 * 60000),
        },
        select: jobSelect,
      });
    }, options);
  }
  private present(row: {
    id: string;
    kind: string;
    reason: string;
    preview: Prisma.JsonValue;
    status: string;
    createdAt: Date;
    expiresAt: Date;
    appliedAt: Date | null;
  }) {
    const {
      id,
      kind,
      reason,
      preview,
      status,
      createdAt,
      expiresAt,
      appliedAt,
    } = row;
    return {
      id,
      kind,
      reason,
      preview,
      status,
      createdAt,
      expiresAt,
      appliedAt,
    };
  }
  async detail(id: string, identity: DecodedIdToken, sellerId?: string) {
    const actor = await this.actor(identity, sellerId);
    const job = await this.prisma.bulkJob.findFirst({
      where: { id, actorId: actor.id, sellerId: sellerId ?? null },
      select: jobSelect,
    });
    if (!job) throw new NotFoundException('Bulk preview not found');
    return job;
  }
  async apply(id: string, identity: DecodedIdToken, sellerId?: string) {
    const actor = await this.actor(identity, sellerId, true);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "BulkJob" WHERE id=${id}::uuid AND "actorId"=${actor.id}::uuid FOR UPDATE`;
      const job = await tx.bulkJob.findFirst({
        where: { id, actorId: actor.id, sellerId: sellerId ?? null },
      });
      if (!job) throw new NotFoundException('Bulk preview not found');
      if (job.status === 'APPLIED') return this.present(job);
      if (job.expiresAt.getTime() <= Date.now())
        throw new ConflictException(
          'This preview expired. Create a new preview',
        );
      const preview = job.preview as unknown as Preview;
      if (
        !preview.valid ||
        !preview.rows.length ||
        preview.rows.some((r) => r.error)
      )
        throw new BadRequestException(
          'Fix invalid rows and create a new preview before applying',
        );
      if (job.kind === 'STOCK_SET') {
        const rows = preview.rows as StockRow[];
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "ProductVariant" WHERE id IN (${Prisma.join(rows.map((r) => Prisma.sql`${r.id}::uuid`))}) ORDER BY id FOR UPDATE`,
        );
        const changes = await tx.$queryRaw<{ id: string }[]>(
          Prisma.sql`UPDATE "ProductVariant" v SET "onHand"=b.after,"updatedAt"=NOW() FROM (VALUES ${Prisma.join(rows.map((r) => Prisma.sql`(${r.id}::uuid,${r.before}::integer,${r.reserved}::integer,${r.after}::integer)`))}) b(id,before,reserved,after) WHERE v.id=b.id AND v."sellerId"=${sellerId}::uuid AND v."onHand"=b.before AND v.reserved=b.reserved AND b.after>=v.reserved AND EXISTS(SELECT 1 FROM "Seller" s WHERE s.id=v."sellerId" AND s.status='APPROVED') RETURNING v.id`,
        );
        if (changes.length !== rows.length)
          throw new ConflictException(
            'Stock or reservations changed since preview. Nothing was applied; create a new preview',
          );
        const movements = rows
          .filter((r) => r.delta !== 0)
          .map((r) => ({
            variantId: r.id,
            actorUserId: actor.id,
            delta: r.delta,
            reason: `Bulk ${job.id}: ${job.reason}`,
          }));
        if (movements.length)
          await tx.inventoryMovement.createMany({ data: movements });
      } else {
        const rows = preview.rows as ProductRow[];
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "Product" WHERE id IN (${Prisma.join(rows.map((r) => Prisma.sql`${r.id}::uuid`))}) ORDER BY id FOR UPDATE`,
        );
        const changed = await tx.$queryRaw<{ id: string }[]>(
          Prisma.sql`UPDATE "Product" p SET status=b.after::"ProductStatus","updatedAt"=NOW() FROM (VALUES ${Prisma.join(rows.map((r) => Prisma.sql`(${r.id}::uuid,${r.before}::text,${r.after}::text,${new Date(r.updatedAt)}::timestamptz)`))}) b(id,before,after,updated_at) WHERE p.id=b.id AND p.status::text=b.before AND p."updatedAt"=b.updated_at AND ${sellerId ? Prisma.sql`p."sellerId"=${sellerId}::uuid` : Prisma.sql`TRUE`} AND ${job.kind === 'PRODUCT_REJECT' ? Prisma.sql`TRUE` : Prisma.sql`EXISTS(SELECT 1 FROM "Seller" s WHERE s.id=p."sellerId" AND s.status='APPROVED')`} AND ${['PRODUCT_SUBMIT', 'PRODUCT_APPROVE'].includes(job.kind) ? Prisma.sql`cardinality(p."imageUrls")>0 AND EXISTS(SELECT 1 FROM "Category" c WHERE c.id=p."categoryId" AND c."isActive")` : Prisma.sql`TRUE`} RETURNING p.id`,
        );
        if (changed.length !== rows.length)
          throw new ConflictException(
            'A product changed since preview. Nothing was applied; create a new preview',
          );
        if (job.kind === 'PRODUCT_APPROVE' || job.kind === 'PRODUCT_REJECT')
          await tx.productReview.createMany({
            data: rows.map((r) => ({
              productId: r.id,
              reviewerUserId: actor.id,
              decision:
                job.kind === 'PRODUCT_APPROVE'
                  ? ('APPROVED' as const)
                  : ('REJECTED' as const),
              reason: job.reason,
            })),
          });
      }
      return tx.bulkJob.update({
        where: { id },
        data: { status: 'APPLIED', appliedAt: new Date() },
        select: jobSelect,
      });
    }, options);
  }
}
