import { Prisma } from '../generated/prisma/client.js';
import {
  publicProduct,
  type CatalogService,
} from '../catalog/catalog.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import {
  effectiveVariantPrice,
  offerLateral,
  priceProducts,
} from './pricing.js';
export type BrowseQuery = {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  deals?: boolean;
  sort?: string;
  page: number;
  limit: number;
};
export async function browseCatalog(
  prisma: PrismaService,
  catalog: CatalogService,
  query: BrowseQuery,
  sellerId?: string,
) {
  const at = new Date(),
    price = Prisma.sql`COALESCE(offer.price,p."priceLkrMinor")`;
  const conditions = [
    Prisma.sql`p.status='APPROVED' AND s.status='APPROVED' AND c."isActive"`,
  ];
  if (sellerId) conditions.push(Prisma.sql`p."sellerId"=${sellerId}::uuid`);
  const terms =
    query.q?.normalize('NFKC').trim().split(/\s+/).slice(0, 8) ?? [];
  for (const term of terms)
    conditions.push(
      Prisma.sql`position(lower(${term}) in lower(concat_ws(' ',p.title,p.description,p.brand,p.sku,c.name,s.name)))>0`,
    );
  if (query.category) conditions.push(Prisma.sql`c.slug=${query.category}`);
  if (query.minPrice !== undefined)
    conditions.push(Prisma.sql`${price}>=${query.minPrice}`);
  if (query.maxPrice !== undefined)
    conditions.push(Prisma.sql`${price}<=${query.maxPrice}`);
  if (query.inStock) conditions.push(Prisma.sql`offer.available`);
  if (query.deals) conditions.push(Prisma.sql`deal.id IS NOT NULL`);
  const from = Prisma.sql`FROM "Product" p JOIN "Seller" s ON s.id=p."sellerId" JOIN "Category" c ON c.id=p."categoryId" ${offerLateral(at)} LEFT JOIN LATERAL(SELECT ${effectiveVariantPrice} AS price,v."onHand">v.reserved AS available FROM "ProductVariant" v WHERE v."productId"=p.id ORDER BY (v."onHand">v.reserved) DESC,${effectiveVariantPrice},v.position,v.id LIMIT 1) offer ON TRUE WHERE ${Prisma.join(conditions, ' AND ')}`;
  const sort =
    query.sort === 'price-asc'
      ? Prisma.sql`${price},p.id`
      : query.sort === 'price-desc'
        ? Prisma.sql`${price} DESC,p.id`
        : query.sort === 'name'
          ? Prisma.sql`p.title,p.id`
          : query.sort === 'relevance' && query.q
            ? Prisma.sql`(CASE WHEN lower(p.title)=lower(${query.q}) THEN 100 WHEN position(lower(${query.q}) in lower(p.title))=1 THEN 50 ELSE 0 END + ts_rank_cd(to_tsvector('simple',concat_ws(' ',p.title,p.brand,p.description,p.sku)),plainto_tsquery('simple',${query.q}))) DESC,p."createdAt" DESC,p.id`
            : Prisma.sql`p."createdAt" DESC,p.id DESC`;
  return prisma.$transaction(
    async (tx) => {
      const [ids, [count]] = await Promise.all([
        tx.$queryRaw<{ id: string; price: number }[]>(
          Prisma.sql`SELECT p.id,${price} AS price ${from} ORDER BY ${sort} LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`,
        ),
        tx.$queryRaw<{ total: bigint }[]>(
          Prisma.sql`SELECT count(*) AS total ${from}`,
        ),
      ]);
      const rows = ids.length
        ? await tx.product.findMany({
            where: {
              id: { in: ids.map((r) => r.id) },
              status: 'APPROVED',
              seller: { status: 'APPROVED' },
              category: { isActive: true },
            },
            select: publicProduct,
          })
        : [];
      const priced = await priceProducts(tx, rows, at);
      return {
        items: ids.flatMap((id) =>
          priced
            .filter((r) => r.id === id.id)
            .map((r) => ({
              ...catalog.withAvailability(r),
              listingPriceLkrMinor: id.price,
            })),
        ),
        total: Number(count?.total ?? 0),
        page: query.page,
        pageSize: query.limit,
        pages: Math.max(1, Math.ceil(Number(count?.total ?? 0) / query.limit)),
      };
    },
    {
      timeout: 30000,
      maxWait: 10000,
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    },
  );
}
