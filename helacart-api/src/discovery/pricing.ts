import { Prisma } from '../generated/prisma/client.js';
export type ActiveOffer = {
  id: string;
  productId: string;
  name: string;
  discountBps: number;
  startsAt: Date;
  endsAt: Date;
};
export function discountedMinor(base: number, bps: number) {
  return Math.max(1, base - Math.floor((base * bps + 5000) / 10000));
}
export async function activeOffers(
  db: Prisma.TransactionClient,
  productIds: string[],
  at = new Date(),
) {
  if (!productIds.length) return new Map<string, ActiveOffer>();
  const offers = await db.promotion.findMany({
    where: {
      productId: { in: [...new Set(productIds)] },
      status: 'APPROVED',
      startsAt: { lte: at },
      endsAt: { gt: at },
    },
    orderBy: [{ discountBps: 'desc' }, { id: 'asc' }],
    select: {
      id: true,
      productId: true,
      name: true,
      discountBps: true,
      startsAt: true,
      endsAt: true,
    },
  });
  const result = new Map<string, ActiveOffer>();
  for (const offer of offers)
    if (!result.has(offer.productId)) result.set(offer.productId, offer);
  return result;
}
export async function priceProducts<
  T extends {
    id: string;
    priceLkrMinor: number;
    variants?: {
      priceLkrMinor: number;
      onHand?: number;
      reserved?: number;
      availableQuantity?: number;
    }[];
  },
>(db: Prisma.TransactionClient, rows: T[], at = new Date()): Promise<T[]> {
  const offers = await activeOffers(
    db,
    rows.map((r) => r.id),
    at,
  );
  return rows.map((row) => {
    const offer = offers.get(row.id);
    const variants = row.variants?.map((v) => ({
      ...v,
      priceLkrMinor: offer
        ? discountedMinor(v.priceLkrMinor, offer.discountBps)
        : v.priceLkrMinor,
      ...(offer
        ? {
            originalPriceLkrMinor: v.priceLkrMinor,
            promotionId: offer.id,
            promotionDiscountBps: offer.discountBps,
          }
        : {}),
    }));
    const available = variants?.filter(
      (v) => (v.availableQuantity ?? (v.onHand ?? 0) - (v.reserved ?? 0)) > 0,
    );
    const prices =
      (available?.length ? available : variants)?.map((v) => v.priceLkrMinor) ??
      [];
    return {
      ...row,
      priceLkrMinor: offer
        ? discountedMinor(row.priceLkrMinor, offer.discountBps)
        : row.priceLkrMinor,
      ...(variants ? { variants } : {}),
      listingPriceLkrMinor: prices.length
        ? Math.min(...prices)
        : row.priceLkrMinor,
      ...(offer
        ? {
            originalPriceLkrMinor: row.priceLkrMinor,
            promotion: {
              id: offer.id,
              name: offer.name,
              discountBps: offer.discountBps,
              endsAt: offer.endsAt,
            },
          }
        : {}),
    } as T;
  });
}
export function offerLateral(at: Date, productAlias = 'p') {
  return Prisma.sql`LEFT JOIN LATERAL(SELECT pr.id,pr."discountBps" FROM "Promotion" pr WHERE pr."productId"=${Prisma.raw(productAlias)}.id AND pr.status='APPROVED' AND pr."startsAt"<=${at} AND pr."endsAt">${at} ORDER BY pr."discountBps" DESC,pr.id LIMIT 1) deal ON TRUE`;
}
export const effectiveVariantPrice = Prisma.sql`GREATEST(1,v."priceLkrMinor"-((v."priceLkrMinor"::bigint*COALESCE(deal."discountBps",0)+5000)/10000))::integer`;
