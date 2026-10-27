import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import {
  StockAlertQueryDto,
  StockAlertSettingsDto,
} from './business-tools.dto.js';
@Injectable()
export class StockAlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}
  async list(
    sellerId: string,
    identity: DecodedIdToken,
    q: StockAlertQueryDto,
  ) {
    await this.catalog.requireSellerMember(sellerId, identity, false);
    const conditions = [Prisma.sql`v."sellerId"=${sellerId}::uuid`];
    if (q.q)
      conditions.push(
        Prisma.sql`(position(lower(${q.q}) in lower(v.sku))>0 OR position(lower(${q.q}) in lower(p.title))>0)`,
      );
    const available = Prisma.sql`v."onHand"-v.reserved`;
    if (q.level === 'LOW')
      conditions.push(
        Prisma.sql`v."stockAlertsEnabled" AND ${available}>0 AND ${available}<=v."lowStockThreshold"`,
      );
    if (q.level === 'OUT')
      conditions.push(Prisma.sql`v."stockAlertsEnabled" AND ${available}=0`);
    if (q.level === 'DISABLED')
      conditions.push(Prisma.sql`NOT v."stockAlertsEnabled"`);
    const from = Prisma.sql`FROM "ProductVariant" v JOIN "Product" p ON p.id=v."productId" WHERE ${Prisma.join(conditions, ' AND ')}`;
    return this.prisma.$transaction(
      async (tx) => {
        const [items, [count]] = await Promise.all([
          tx.$queryRaw<
            {
              id: string;
              productId: string;
              title: string;
              sku: string;
              status: string;
              onHand: number;
              reserved: number;
              threshold: number;
              enabled: boolean;
              version: number;
              available: number;
            }[]
          >(
            Prisma.sql`SELECT v.id,v."productId",p.title,p.status,v.sku,v."onHand",v.reserved,v."lowStockThreshold" AS threshold,v."stockAlertsEnabled" AS enabled,v."stockSettingsVersion" AS version,${available} AS available ${from} ORDER BY ${available},v.sku,v.id OFFSET ${(q.page - 1) * q.limit} LIMIT ${q.limit}`,
          ),
          tx.$queryRaw<{ total: number }[]>(
            Prisma.sql`SELECT count(*)::integer AS total ${from}`,
          ),
        ]);
        return {
          items,
          total: count.total,
          page: q.page,
          pageSize: q.limit,
          pages: Math.max(1, Math.ceil(count.total / q.limit)),
        };
      },
      {
        timeout: 30000,
        maxWait: 10000,
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );
  }
  async settings(
    sellerId: string,
    id: string,
    identity: DecodedIdToken,
    dto: StockAlertSettingsDto,
  ) {
    await this.catalog.requireSellerMember(sellerId, identity, true);
    const result = await this.prisma.productVariant.updateMany({
      where: {
        id,
        sellerId,
        stockSettingsVersion: dto.version,
        seller: { status: 'APPROVED' },
      },
      data: {
        lowStockThreshold: dto.threshold,
        stockAlertsEnabled: dto.enabled,
        stockSettingsVersion: { increment: 1 },
      },
    });
    if (!result.count) {
      const exists = await this.prisma.productVariant.findFirst({
        where: { id, sellerId },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('Variant not found');
      throw new ConflictException(
        'Alert settings changed. Refresh before saving',
      );
    }
    return { saved: true };
  }
  /** Queue triggers cover checkout, cancellations, reservations, adjustments and listing visibility. */
  async processDirty(limit = 100) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 500)
      throw new Error('Invalid stock-watch batch size');
    const [result] = await this.prisma.$queryRaw<
      { processed: number; notifications: number }[]
    >`
   WITH pending AS MATERIALIZED (
    SELECT w."variantId",w.level AS old_level,v.sku,v."sellerId",p.title,
      CASE WHEN NOT v."stockAlertsEnabled" OR p.status<>'APPROVED' OR s.status<>'APPROVED' OR NOT c."isActive" OR v."onHand"-v.reserved>v."lowStockThreshold" THEN 'CLEAR' WHEN v."onHand"=v.reserved THEN 'OUT' ELSE 'LOW' END AS next_level
    FROM "StockWatch" w JOIN "ProductVariant" v ON v.id=w."variantId" JOIN "Product" p ON p.id=v."productId" JOIN "Seller" s ON s.id=v."sellerId" JOIN "Category" c ON c.id=p."categoryId"
    WHERE w.dirty ORDER BY w."variantId" FOR UPDATE OF w SKIP LOCKED LIMIT ${limit}
   ), updated AS (
    UPDATE "StockWatch" w SET dirty=false,level=p.next_level,"checkedAt"=NOW(),"changedAt"=CASE WHEN w.level<>p.next_level THEN NOW() ELSE w."changedAt" END FROM pending p WHERE w."variantId"=p."variantId" RETURNING w."variantId"
   ), notices AS (
    INSERT INTO "Notification" (id,"userId",type,"subjectId",message,href)
    SELECT gen_random_uuid(),m."userId",'STOCK_LOW'::"NotificationType",p."variantId",left(p.title,120)||' ('||p.sku||'): '||CASE WHEN p.next_level='OUT' THEN 'out of available stock' ELSE 'available stock is low' END,'/seller/stock-alerts'
    FROM pending p JOIN updated x ON x."variantId"=p."variantId" JOIN "SellerMember" m ON m."sellerId"=p."sellerId" JOIN "User" u ON u.id=m."userId"
    WHERE u."accessStatus"='ACTIVE' AND p.next_level<>'CLEAR' AND (p.old_level='CLEAR' OR (p.old_level='LOW' AND p.next_level='OUT')) RETURNING id
   ) SELECT (SELECT count(*)::integer FROM updated) AS processed,(SELECT count(*)::integer FROM notices) AS notifications`;
    return result;
  }
}
