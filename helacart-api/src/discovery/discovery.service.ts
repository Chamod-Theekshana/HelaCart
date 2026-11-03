import { Injectable, NotFoundException } from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import { CatalogService, publicProduct } from '../catalog/catalog.service.js';
import { priceProducts } from './pricing.js';
import { RecommendationQueryDto } from './discovery.dto.js';
@Injectable()
export class DiscoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly catalog: CatalogService,
  ) {}
  async suggest(q: string) {
    const rows = await this.prisma.product.findMany({
      where: {
        status: 'APPROVED',
        seller: { status: 'APPROVED' },
        category: { isActive: true },
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { brand: { contains: q, mode: 'insensitive' } },
          { seller: { name: { contains: q, mode: 'insensitive' } } },
          { category: { name: { contains: q, mode: 'insensitive' } } },
        ],
      },
      take: 6,
      orderBy: [{ title: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        title: true,
        category: { select: { name: true, slug: true } },
        seller: { select: { name: true } },
      },
    });
    return {
      products: rows,
      categories: [
        ...new Map(rows.map((r) => [r.category.slug, r.category])).values(),
      ].slice(0, 4),
    };
  }
  async recommendations(q: RecommendationQueryDto, identity?: DecodedIdToken) {
    const user = identity ? await this.auth.getOrCreateProfile(identity) : null;
    const favoriteCount = user
      ? await this.prisma.productFavorite.count({
          where: { userId: user.id, productId: { not: null } },
        })
      : 0;
    const context = q.productId
      ? await this.prisma.product.findFirst({
          where: {
            id: q.productId,
            status: 'APPROVED',
            seller: { status: 'APPROVED' },
            category: { isActive: true },
          },
          select: { id: true, categoryId: true, sellerId: true },
        })
      : null;
    if (q.productId && !context)
      throw new NotFoundException('Product not found');
    const personal = user
      ? Prisma.sql`COALESCE((SELECT count(*) FROM "ProductFavorite" f JOIN "Product" fp ON fp.id=f."productId" WHERE f."userId"=${user.id}::uuid AND fp."categoryId"=p."categoryId"),0)`
      : Prisma.sql`0::bigint`;
    return this.prisma.$transaction(
      async (tx) => {
        const ids = await tx.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT p.id FROM "Product" p JOIN "Seller" s ON s.id=p."sellerId" JOIN "Category" c ON c.id=p."categoryId" WHERE p.status='APPROVED' AND s.status='APPROVED' AND c."isActive" AND EXISTS(SELECT 1 FROM "ProductVariant" v WHERE v."productId"=p.id AND v."onHand">v.reserved) AND ${context ? Prisma.sql`p.id<>${context.id}::uuid` : Prisma.sql`TRUE`} AND ${user ? Prisma.sql`NOT EXISTS(SELECT 1 FROM "ProductFavorite" f WHERE f."userId"=${user.id}::uuid AND f."productId"=p.id)` : Prisma.sql`TRUE`} ORDER BY ${context ? Prisma.sql`(p."categoryId"=${context.categoryId}::uuid) DESC,` : Prisma.empty} ${personal} DESC,COALESCE((SELECT sum(i.quantity) FROM "OrderItem" i JOIN "ProductVariant" v ON v.id=i."variantId" JOIN "SellerOrder" so ON so.id=i."sellerOrderId" WHERE v."productId"=p.id AND so.status='DELIVERED' AND so."createdAt">NOW()-INTERVAL '90 days'),0) DESC,p."createdAt" DESC,p.id LIMIT ${q.limit}`,
        );
        const rows = await tx.product.findMany({
          where: {
            id: { in: ids.map((r) => r.id) },
            status: 'APPROVED',
            seller: { status: 'APPROVED' },
            category: { isActive: true },
          },
          select: publicProduct,
        });
        const priced = await priceProducts(tx, rows);
        return {
          basis: context
            ? 'RELATED_PRODUCTS'
            : user && favoriteCount > 0
              ? 'YOUR_FAVORITE_CATEGORIES'
              : 'RECENT_DELIVERED_POPULARITY',
          items: ids.flatMap((id) =>
            priced
              .filter((r) => r.id === id.id)
              .map((r) => this.catalog.withAvailability(r)),
          ),
        };
      },
      {
        timeout: 30000,
        maxWait: 10000,
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );
  }
}
