import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import {
  BusinessReportQueryDto,
  BusinessExportQueryDto,
} from './business-tools.dto.js';
import {
  csvDocument,
  reportRange,
  safeNumber,
  sumReportIntegers,
} from './business-tools.utils.js';
type MetricRow = {
  day: string;
  orders: bigint;
  merchandise: bigint;
  shipping: bigint;
  units: bigint;
};
type MoneyRow = {
  day: string;
  refundMerchandise: bigint;
  refundShipping: bigint;
  commissionAccrued: bigint;
  commissionCollected: bigint;
};
@Injectable()
export class BusinessReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly config: ConfigService,
  ) {}
  async report(
    identity: DecodedIdToken,
    sellerId: string | undefined,
    q: BusinessReportQueryDto,
  ) {
    if (sellerId)
      await this.catalog.requireSellerMember(sellerId, identity, false);
    else if (
      !identity.email_verified ||
      !this.config
        .getOrThrow<string[]>('ADMIN_FIREBASE_UIDS')
        .includes(identity.uid)
    )
      throw new ForbiddenException('Administrator access required');
    const range = reportRange(q.from, q.to);
    const scope = (alias: string) =>
      sellerId
        ? Prisma.sql`${Prisma.raw(alias)}."sellerId"=${sellerId}::uuid`
        : Prisma.sql`TRUE`;
    const between = (field: Prisma.Sql) =>
      Prisma.sql`${field}>=${range.start} AND ${field}<${range.end}`;
    const orders = Prisma.sql`WITH deliveries AS (
   SELECT so.*,COALESCE((SELECT min(e."createdAt") FROM "SellerOrderEvent" e WHERE e."sellerOrderId"=so.id AND e."toStatus"='DELIVERED'),so."paymentCollectedAt") AS delivered_at
   FROM "SellerOrder" so WHERE so.status='DELIVERED' AND ${scope('so')}
  ), sales AS (SELECT * FROM deliveries WHERE ${between(Prisma.sql`delivered_at`)})`;
    const financial = Prisma.sql`WITH money AS (
   SELECT r."reviewedAt" AS event_at,r."merchandiseMinor"::bigint AS refund_merch,r."shippingMinor"::bigint AS refund_shipping,0::bigint AS commission_accrued,0::bigint AS commission_collected FROM "RefundRecord" r WHERE r.status='APPROVED' AND ${scope('r')}
   UNION ALL SELECT x."createdAt",-r."merchandiseMinor"::bigint,-r."shippingMinor"::bigint,0,0 FROM "RefundReversal" x JOIN "RefundRecord" r ON r.id=x."refundRecordId" WHERE ${scope('r')}
   UNION ALL SELECT c."createdAt",0,0,c."amountMinor",0 FROM "CommissionCharge" c WHERE ${scope('c')}
   UNION ALL SELECT c."createdAt",0,0,-c."creditMinor",0 FROM "CommissionRefund" c WHERE ${scope('c')}
   UNION ALL SELECT c."createdAt",0,0,c."amountMinor",0 FROM "CommissionCorrection" c WHERE c."refundId" IS NOT NULL AND ${scope('c')}
   UNION ALL SELECT p."reviewedAt",0,0,0,p."amountMinor" FROM "CommissionPayment" p WHERE p.status='APPROVED' AND ${scope('p')}
   UNION ALL SELECT c."createdAt",0,0,0,-c."amountMinor" FROM "CommissionCorrection" c WHERE c."paymentId" IS NOT NULL AND ${scope('c')}
  )`;
    return this.prisma.$transaction(
      async (tx) => {
        const [
          dailySales,
          dailyMoney,
          statuses,
          [care],
          [inventory],
          products,
          shops,
        ] = await Promise.all([
          tx.$queryRaw<MetricRow[]>(
            Prisma.sql`${orders} SELECT (s.delivered_at AT TIME ZONE 'Asia/Colombo')::date::text AS day,count(*)::bigint AS orders,COALESCE(sum(s."subtotalLkrMinor"),0)::bigint AS merchandise,COALESCE(sum(s."shippingLkrMinor"),0)::bigint AS shipping,COALESCE(sum((SELECT sum(i.quantity) FROM "OrderItem" i WHERE i."sellerOrderId"=s.id)),0)::bigint AS units FROM sales s GROUP BY 1 ORDER BY 1`,
          ),
          tx.$queryRaw<MoneyRow[]>(
            Prisma.sql`${financial} SELECT (event_at AT TIME ZONE 'Asia/Colombo')::date::text AS day,sum(refund_merch)::bigint AS "refundMerchandise",sum(refund_shipping)::bigint AS "refundShipping",sum(commission_accrued)::bigint AS "commissionAccrued",sum(commission_collected)::bigint AS "commissionCollected" FROM money WHERE ${between(Prisma.sql`event_at`)} GROUP BY 1 ORDER BY 1`,
          ),
          tx.$queryRaw<{ status: string; count: bigint }[]>(
            Prisma.sql`SELECT so.status::text,count(*)::bigint AS count FROM "SellerOrder" so WHERE ${scope('so')} AND ${between(Prisma.sql`so."createdAt"`)} GROUP BY so.status`,
          ),
          tx.$queryRaw<{ returns: bigint; support: bigint }[]>(
            Prisma.sql`SELECT (SELECT count(*) FROM "ReturnRequest" r JOIN "SellerOrder" so ON so.id=r."sellerOrderId" WHERE ${scope('so')} AND ${between(Prisma.sql`r."createdAt"`)})::bigint AS returns,(SELECT count(*) FROM "SupportCase" sc WHERE ${scope('sc')} AND ${between(Prisma.sql`sc."createdAt"`)})::bigint AS support`,
          ),
          tx.$queryRaw<
            {
              variants: bigint;
              onHand: bigint;
              reserved: bigint;
              low: bigint;
              out: bigint;
            }[]
          >(
            Prisma.sql`SELECT count(*)::bigint AS variants,COALESCE(sum(v."onHand"),0)::bigint AS "onHand",COALESCE(sum(v.reserved),0)::bigint AS reserved,count(*) FILTER(WHERE v."stockAlertsEnabled" AND v."onHand">v.reserved AND v."onHand"-v.reserved<=v."lowStockThreshold")::bigint AS low,count(*) FILTER(WHERE v."onHand"=v.reserved)::bigint AS out FROM "ProductVariant" v WHERE ${scope('v')}`,
          ),
          tx.$queryRaw<
            {
              id: string;
              title: string;
              sku: string;
              units: bigint;
              merchandise: bigint;
              orders: bigint;
            }[]
          >(
            Prisma.sql`${orders} SELECT v."productId" AS id,COALESCE(p.title,max(i."productTitle")) AS title,p.sku,sum(i.quantity)::bigint AS units,sum(i."lineLkrMinor")::bigint AS merchandise,count(DISTINCT s.id)::bigint AS orders FROM sales s JOIN "OrderItem" i ON i."sellerOrderId"=s.id JOIN "ProductVariant" v ON v.id=i."variantId" JOIN "Product" p ON p.id=v."productId" GROUP BY v."productId",p.title,p.sku ORDER BY merchandise DESC,v."productId" LIMIT 5001`,
          ),
          sellerId
            ? Promise.resolve([])
            : tx.$queryRaw<
                {
                  id: string;
                  name: string;
                  orders: bigint;
                  merchandise: bigint;
                  shipping: bigint;
                }[]
              >(
                Prisma.sql`${orders} SELECT s."sellerId" AS id,sh.name,count(*)::bigint AS orders,sum(s."subtotalLkrMinor")::bigint AS merchandise,sum(s."shippingLkrMinor")::bigint AS shipping FROM sales s JOIN "Seller" sh ON sh.id=s."sellerId" GROUP BY s."sellerId",sh.name ORDER BY merchandise DESC,s."sellerId" LIMIT 5001`,
              ),
        ]);
        if (products.length > 5000 || shops.length > 5000)
          throw new BadRequestException(
            'This report has more than 5000 product or shop rows. Choose a shorter period',
          );
        const salesByDay = new Map(dailySales.map((r) => [r.day, r])),
          moneyByDay = new Map(dailyMoney.map((r) => [r.day, r]));
        const daily = Array.from({ length: range.days }, (_, i) => {
          const day = new Date(
              Date.parse(range.from + 'T00:00:00Z') + i * 86400000,
            )
              .toISOString()
              .slice(0, 10),
            s = salesByDay.get(day),
            m = moneyByDay.get(day);
          const grossMerchandiseMinor = safeNumber(s?.merchandise),
            shippingMinor = safeNumber(s?.shipping),
            refundMerchandiseMinor = safeNumber(m?.refundMerchandise),
            refundShippingMinor = safeNumber(m?.refundShipping);
          return {
            day,
            deliveredOrders: safeNumber(s?.orders),
            units: safeNumber(s?.units),
            grossMerchandiseMinor,
            shippingMinor,
            codMinor: sumReportIntegers([grossMerchandiseMinor, shippingMinor]),
            refundMerchandiseMinor,
            refundShippingMinor,
            netMerchandiseMinor: sumReportIntegers([
              grossMerchandiseMinor,
              -refundMerchandiseMinor,
            ]),
            commissionAccruedMinor: safeNumber(m?.commissionAccrued),
            commissionCollectedMinor: safeNumber(m?.commissionCollected),
          };
        });
        const keys = [
          'deliveredOrders',
          'units',
          'grossMerchandiseMinor',
          'shippingMinor',
          'codMinor',
          'refundMerchandiseMinor',
          'refundShippingMinor',
          'netMerchandiseMinor',
          'commissionAccruedMinor',
          'commissionCollectedMinor',
        ] as const;
        const totals = Object.fromEntries(
          keys.map((key) => [
            key,
            sumReportIntegers(daily.map((row) => row[key])),
          ]),
        );
        return {
          from: range.from,
          to: range.to,
          timeZone: 'Asia/Colombo',
          generatedAt: new Date().toISOString(),
          sellerId: sellerId ?? null,
          totals,
          daily,
          orderStatuses: statuses.map((r) => ({
            status: r.status,
            count: safeNumber(r.count),
          })),
          customerCare: {
            returnsOpened: safeNumber(care.returns),
            supportOpened: safeNumber(care.support),
          },
          inventory: {
            variants: safeNumber(inventory.variants),
            onHand: safeNumber(inventory.onHand),
            reserved: safeNumber(inventory.reserved),
            available:
              safeNumber(inventory.onHand) - safeNumber(inventory.reserved),
            low: safeNumber(inventory.low),
            out: safeNumber(inventory.out),
          },
          products: products.map(({ merchandise, ...r }) => ({
            ...r,
            units: safeNumber(r.units),
            orders: safeNumber(r.orders),
            merchandiseMinor: safeNumber(merchandise),
          })),
          shops: shops.map((r) => ({
            id: r.id,
            name: r.name,
            orders: safeNumber(r.orders),
            merchandiseMinor: safeNumber(r.merchandise),
            shippingMinor: safeNumber(r.shipping),
          })),
        };
      },
      {
        timeout: 45000,
        maxWait: 10000,
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );
  }
  async export(
    identity: DecodedIdToken,
    sellerId: string | undefined,
    q: BusinessExportQueryDto,
  ) {
    const report = await this.report(identity, sellerId, q);
    if (q.section === 'PRODUCTS')
      return csvDocument([
        [
          'product_id',
          'product',
          'sku',
          'units_delivered',
          'delivered_shop_orders',
          'gross_merchandise_lkr',
        ],
        ...report.products.map((r) => [
          r.id,
          r.title,
          r.sku,
          r.units,
          r.orders,
          r.merchandiseMinor / 100,
        ]),
      ]);
    if (q.section === 'SHOPS') {
      if (sellerId)
        throw new ForbiddenException(
          'Shop comparison is available to administrators',
        );
      return csvDocument([
        [
          'shop_id',
          'shop',
          'delivered_shop_orders',
          'gross_merchandise_lkr',
          'shipping_lkr',
        ],
        ...report.shops.map((r) => [
          r.id,
          r.name,
          r.orders,
          r.merchandiseMinor / 100,
          r.shippingMinor / 100,
        ]),
      ]);
    }
    if (q.section === 'SUMMARY')
      return csvDocument([
        ['metric', 'value', 'unit'],
        ...Object.entries(report.totals).map(([key, value]) => [
          key,
          key.endsWith('Minor') ? value / 100 : value,
          key.endsWith('Minor') ? 'LKR' : 'count',
        ]),
        ...Object.entries(report.inventory).map(([key, value]) => [
          'current_inventory_' + key,
          value,
          'units',
        ]),
        ['returns_opened', report.customerCare.returnsOpened, 'count'],
        ['support_opened', report.customerCare.supportOpened, 'count'],
      ]);
    return csvDocument([
      [
        'date_asia_colombo',
        'delivered_shop_orders',
        'units',
        'gross_merchandise_lkr',
        'shipping_lkr',
        'delivered_cod_total_lkr',
        'verified_refund_merchandise_lkr',
        'verified_refund_shipping_lkr',
        'net_merchandise_lkr',
        'net_commission_accrued_lkr',
        'verified_commission_collected_lkr',
      ],
      ...report.daily.map((r) => [
        r.day,
        r.deliveredOrders,
        r.units,
        r.grossMerchandiseMinor / 100,
        r.shippingMinor / 100,
        r.codMinor / 100,
        r.refundMerchandiseMinor / 100,
        r.refundShippingMinor / 100,
        r.netMerchandiseMinor / 100,
        r.commissionAccruedMinor / 100,
        r.commissionCollectedMinor / 100,
      ]),
    ]);
  }
}
