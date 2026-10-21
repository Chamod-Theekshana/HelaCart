import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import {
  Prisma,
  ProductStatus,
  SellerOrderStatus,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import {
  CatalogService,
  privateProduct,
  publicProduct,
} from '../catalog/catalog.service.js';
import {
  ApplicationQuery,
  ListQuery,
  OrderQuery,
  ProductQuery,
  PublicCatalogQuery,
  ReturnQuery,
} from './workspace.dto.js';

export function listPage<T>(items: T[], total: number, query: ListQuery) {
  return {
    items,
    total,
    page: query.page,
    pageSize: query.limit,
    pages: Math.max(1, Math.ceil(total / query.limit)),
  };
}
export function uuidPrefix(value?: string) {
  if (!value || !/^#?[a-f\d-]{3,36}$/i.test(value)) return undefined;
  const hex = value.replace(/^#/, '').replaceAll('-', '').toLowerCase();
  if (hex.length > 32 || hex.length < 3) return undefined;
  const uuid = (text: string) =>
    `${text.slice(0, 8)}-${text.slice(8, 12)}-${text.slice(12, 16)}-${text.slice(16, 20)}-${text.slice(20)}`;
  return { gte: uuid(hex.padEnd(32, '0')), lte: uuid(hex.padEnd(32, 'f')) };
}
const sellerPart = {
  seller: { select: { id: true, name: true, slug: true } },
  items: true,
  events: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  returnRequest: { select: { id: true, status: true } },
} satisfies Prisma.SellerOrderInclude;
const orderInclude = {
  sellerOrders: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: sellerPart,
  },
} satisfies Prisma.OrderInclude;
const sellerOrderInclude = {
  ...sellerPart,
  order: {
    select: {
      id: true,
      recipient: true,
      phone: true,
      line1: true,
      line2: true,
      city: true,
      district: true,
      postalCode: true,
      createdAt: true,
    },
  },
} satisfies Prisma.SellerOrderInclude;
const returnInclude = {
  sellerOrder: {
    select: {
      id: true,
      orderId: true,
      sellerId: true,
      seller: { select: { id: true, name: true, slug: true } },
      items: true,
    },
  },
} satisfies Prisma.ReturnRequestInclude;
export const unreconciledCod = {
  status: 'DELIVERED',
  paymentCollectedAt: { not: null },
  codReconciliations: { none: { decision: 'RECONCILED' } },
} satisfies Prisma.SellerOrderWhereInput;
const text = (q: string) => ({ contains: q, mode: 'insensitive' as const });
const readTransactionOptions = {
  isolationLevel: 'RepeatableRead' as const,
  timeout: 15_000,
  maxWait: 10_000,
};
function orderSearch(query: OrderQuery): Prisma.OrderWhereInput {
  const prefix = uuidPrefix(query.q);
  return {
    ...(query.status
      ? { sellerOrders: { some: { status: query.status } } }
      : {}),
    ...(query.q
      ? {
          OR: [
            { recipient: text(query.q) },
            { district: text(query.q) },
            { sellerOrders: { some: { seller: { name: text(query.q) } } } },
            ...(prefix
              ? [{ id: prefix }, { sellerOrders: { some: { id: prefix } } }]
              : []),
          ],
        }
      : {}),
  };
}
@Injectable()
export class WorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly catalog: CatalogService,
  ) {}
  private async viewer(identity: DecodedIdToken) {
    if (!identity.email_verified)
      throw new ForbiddenException('Verify your email to view account records');
    return this.auth.getOrCreateProfile(identity);
  }
  async publicCatalog(query: PublicCatalogQuery) {
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    )
      throw new BadRequestException(
        'Minimum price must not exceed maximum price',
      );
    const price = Prisma.sql`COALESCE(offer."priceLkrMinor",p."priceLkrMinor")`;
    const conditions = [
      Prisma.sql`p."status"='APPROVED' AND s."status"='APPROVED' AND c."isActive"=TRUE`,
    ];
    if (query.q)
      conditions.push(
        Prisma.sql`position(lower(${query.q}) in lower(p."title"))>0`,
      );
    if (query.category) conditions.push(Prisma.sql`c."slug"=${query.category}`);
    if (query.minPrice !== undefined)
      conditions.push(Prisma.sql`${price}>=${query.minPrice}`);
    if (query.maxPrice !== undefined)
      conditions.push(Prisma.sql`${price}<=${query.maxPrice}`);
    if (query.inStock) conditions.push(Prisma.sql`offer.available=TRUE`);
    const from = Prisma.sql`FROM "Product" p JOIN "Seller" s ON s."id"=p."sellerId" JOIN "Category" c ON c."id"=p."categoryId" LEFT JOIN LATERAL(SELECT v."priceLkrMinor",(v."onHand">v."reserved") AS available FROM "ProductVariant" v WHERE v."productId"=p."id" ORDER BY (v."onHand">v."reserved") DESC,v."position" ASC,v."id" ASC LIMIT 1) offer ON TRUE WHERE ${Prisma.join(conditions, ' AND ')}`;
    const sort =
      query.sort === 'price-asc'
        ? Prisma.sql`${price} ASC,p."id" ASC`
        : query.sort === 'price-desc'
          ? Prisma.sql`${price} DESC,p."id" ASC`
          : query.sort === 'name'
            ? Prisma.sql`p."title" ASC,p."id" ASC`
            : Prisma.sql`p."createdAt" DESC,p."id" DESC`;
    return this.prisma.$transaction(async (tx) => {
      const [ids, counts] = await Promise.all([
        tx.$queryRaw<{ id: string; price: number }[]>(
          Prisma.sql`SELECT p."id",${price} AS price ${from} ORDER BY ${sort} LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`,
        ),
        tx.$queryRaw<{ total: bigint }[]>(
          Prisma.sql`SELECT count(*) AS total ${from}`,
        ),
      ]);
      const rows = ids.length
        ? await tx.product.findMany({
            where: {
              id: { in: ids.map((row) => row.id) },
              status: 'APPROVED',
              seller: { status: 'APPROVED' },
              category: { isActive: true },
            },
            select: publicProduct,
          })
        : [];
      return listPage(
        ids.flatMap((id) =>
          rows
            .filter((row) => row.id === id.id)
            .map((row) => ({
              ...this.catalog.withAvailability(row),
              listingPriceLkrMinor: id.price,
            })),
        ),
        Number(counts[0]?.total ?? 0),
        query,
      );
    }, readTransactionOptions);
  }
  async buyerOrders(identity: DecodedIdToken, query: OrderQuery) {
    const user = await this.viewer(identity);
    const where: Prisma.OrderWhereInput = {
      buyerId: user.id,
      ...orderSearch(query),
    };
    return this.prisma.$transaction(async (tx) => {
      const [items, total] = await Promise.all([
        tx.order.findMany({
          where,
          include: orderInclude,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        tx.order.count({ where }),
      ]);
      return listPage(items, total, query);
    }, readTransactionOptions);
  }
  async buyerReturns(identity: DecodedIdToken, query: ReturnQuery) {
    const user = await this.viewer(identity);
    return this.returns(query, user.id);
  }
  async buyerNotifications(identity: DecodedIdToken, query: ListQuery) {
    const user = await this.viewer(identity);
    const where = { userId: user.id };
    return this.prisma.$transaction(async (tx) => {
      const [items, total] = await Promise.all([
        tx.notification.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        tx.notification.count({ where }),
      ]);
      return listPage(items, total, query);
    }, readTransactionOptions);
  }
  async buyerSummary(identity: DecodedIdToken) {
    const user = await this.viewer(identity);
    const [
      orders,
      activeSellerOrders,
      addresses,
      unreadNotifications,
      returns,
    ] = await Promise.all([
      this.prisma.order.count({ where: { buyerId: user.id } }),
      this.prisma.sellerOrder.count({
        where: {
          order: { buyerId: user.id },
          status: { notIn: ['DELIVERED', 'CANCELLED'] },
        },
      }),
      this.prisma.buyerAddress.count({
        where: { userId: user.id, isActive: true },
      }),
      this.prisma.notification.count({
        where: { userId: user.id, readAt: null },
      }),
      this.prisma.returnRequest.count({ where: { buyerId: user.id } }),
    ]);
    return {
      orders,
      activeSellerOrders,
      addresses,
      unreadNotifications,
      returns,
    };
  }
  async sellerOrders(
    sellerId: string,
    identity: DecodedIdToken,
    query: OrderQuery,
  ) {
    await this.catalog.requireSellerMember(sellerId, identity, false);
    const prefix = uuidPrefix(query.q);
    const where: Prisma.SellerOrderWhereInput = {
      sellerId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { order: { recipient: text(query.q) } },
              ...(prefix ? [{ id: prefix }, { orderId: prefix }] : []),
            ],
          }
        : {}),
    };
    return this.prisma.$transaction(async (tx) => {
      const [items, total] = await Promise.all([
        tx.sellerOrder.findMany({
          where,
          include: sellerOrderInclude,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        tx.sellerOrder.count({ where }),
      ]);
      return listPage(items, total, query);
    }, readTransactionOptions);
  }
  async adminOrders(query: OrderQuery) {
    const where = orderSearch(query);
    return this.prisma.$transaction(async (tx) => {
      const [items, total] = await Promise.all([
        tx.order.findMany({
          where,
          include: orderInclude,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        tx.order.count({ where }),
      ]);
      return listPage(items, total, query);
    }, readTransactionOptions);
  }
  async returns(query: ReturnQuery, buyerId?: string) {
    const prefix = uuidPrefix(query.q);
    const where: Prisma.ReturnRequestWhereInput = {
      ...(buyerId ? { buyerId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { reason: text(query.q) },
              { sellerOrder: { seller: { name: text(query.q) } } },
              ...(prefix
                ? [
                    { id: prefix },
                    { sellerOrderId: prefix },
                    { sellerOrder: { orderId: prefix } },
                    { buyerId: prefix },
                  ]
                : []),
            ],
          }
        : {}),
    };
    return this.prisma.$transaction(async (tx) => {
      const [items, total] = await Promise.all([
        tx.returnRequest.findMany({
          where,
          include: returnInclude,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        tx.returnRequest.count({ where }),
      ]);
      return listPage(items, total, query);
    }, readTransactionOptions);
  }
  async cod(query: ListQuery) {
    const prefix = uuidPrefix(query.q);
    const where: Prisma.SellerOrderWhereInput = {
      ...unreconciledCod,
      ...(query.q
        ? {
            OR: [
              { seller: { name: text(query.q) } },
              ...(prefix
                ? [{ id: prefix }, { sellerId: prefix }, { orderId: prefix }]
                : []),
            ],
          }
        : {}),
    };
    return this.prisma.$transaction(async (tx) => {
      const [items, total] = await Promise.all([
        tx.sellerOrder.findMany({
          where,
          include: {
            seller: { select: { name: true } },
            order: { select: { id: true } },
            codReconciliations: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        tx.sellerOrder.count({ where }),
      ]);
      return listPage(items, total, query);
    }, readTransactionOptions);
  }
  async applications(query: ApplicationQuery) {
    const prefix = uuidPrefix(query.q);
    const where: Prisma.SellerWhereInput = {
      status: query.status,
      ...(query.q
        ? {
            OR: [
              { name: text(query.q) },
              { slug: text(query.q) },
              {
                members: {
                  some: { role: 'OWNER', user: { email: text(query.q) } },
                },
              },
              ...(prefix ? [{ id: prefix }] : []),
            ],
          }
        : {}),
    };
    return this.prisma.$transaction(async (tx) => {
      const [items, total] = await Promise.all([
        tx.seller.findMany({
          where,
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            contactPhone: true,
            pickupAddress: true,
            status: true,
            createdAt: true,
            identityDocumentType: true,
            updatedAt: true,
            documents: {
              select: {
                id: true,
                kind: true,
                contentType: true,
                byteSize: true,
              },
            },
            reviews: {
              select: { decision: true, reason: true, createdAt: true },
              orderBy: { createdAt: 'desc' },
              take: 10,
            },
            members: {
              where: { role: 'OWNER' },
              select: {
                user: {
                  select: { id: true, email: true, emailVerified: true },
                },
              },
            },
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        tx.seller.count({ where }),
      ]);
      return listPage(items, total, query);
    }, readTransactionOptions);
  }
  async products(
    query: ProductQuery,
    sellerId?: string,
    identity?: DecodedIdToken,
  ) {
    if (sellerId && identity)
      await this.catalog.requireSellerMember(sellerId, identity, false);
    const clauses: Prisma.Sql[] = [];
    if (sellerId) clauses.push(Prisma.sql`p."sellerId"=${sellerId}::uuid`);
    if (query.status)
      clauses.push(Prisma.sql`p."status"=${query.status}::"ProductStatus"`);
    if (query.categoryId)
      clauses.push(Prisma.sql`p."categoryId"=${query.categoryId}::uuid`);
    if (query.q)
      clauses.push(
        Prisma.sql`(position(lower(${query.q}) in lower(p."title"))>0 OR position(lower(${query.q}) in lower(p."sku"))>0 OR position(lower(${query.q}) in lower(c."name"))>0 OR position(lower(${query.q}) in lower(s."name"))>0)`,
      );
    if (query.stock === 'LOW')
      clauses.push(
        Prisma.sql`EXISTS(SELECT 1 FROM "ProductVariant" v WHERE v."productId"=p."id" AND v."onHand"-v."reserved"<=5)`,
      );
    if (query.stock === 'READY')
      clauses.push(
        Prisma.sql`EXISTS(SELECT 1 FROM "ProductVariant" v WHERE v."productId"=p."id") AND NOT EXISTS(SELECT 1 FROM "ProductVariant" v WHERE v."productId"=p."id" AND v."onHand"-v."reserved"<=5)`,
      );
    const from = Prisma.sql`FROM "Product" p JOIN "Category" c ON c."id"=p."categoryId" JOIN "Seller" s ON s."id"=p."sellerId" WHERE ${clauses.length ? Prisma.join(clauses, ' AND ') : Prisma.sql`TRUE`}`;
    return this.prisma.$transaction(async (tx) => {
      const [ids, counts] = await Promise.all([
        tx.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT p."id" ${from} ORDER BY p."createdAt" DESC,p."id" DESC LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`,
        ),
        tx.$queryRaw<{ total: bigint }[]>(
          Prisma.sql`SELECT count(*) AS total ${from}`,
        ),
      ]);
      const rows = ids.length
        ? await tx.product.findMany({
            where: {
              id: { in: ids.map((row) => row.id) },
              ...(sellerId ? { sellerId } : {}),
            },
            select: privateProduct,
          })
        : [];
      return listPage(
        ids.flatMap((id) => rows.filter((row) => row.id === id.id)),
        Number(counts[0]?.total ?? 0),
        query,
      );
    }, readTransactionOptions);
  }
  async inventory(
    sellerId: string,
    identity: DecodedIdToken,
    query: ProductQuery,
  ) {
    await this.catalog.requireSellerMember(sellerId, identity, false);
    const clauses = [Prisma.sql`v."sellerId"=${sellerId}::uuid`];
    if (query.q)
      clauses.push(
        Prisma.sql`(position(lower(${query.q}) in lower(v."sku"))>0 OR position(lower(${query.q}) in lower(p."title"))>0)`,
      );
    if (query.stock === 'LOW')
      clauses.push(Prisma.sql`v."onHand"-v."reserved"<=5`);
    if (query.stock === 'READY')
      clauses.push(Prisma.sql`v."onHand"-v."reserved">5`);
    if (query.status)
      clauses.push(Prisma.sql`p."status"=${query.status}::"ProductStatus"`);
    if (query.categoryId)
      clauses.push(Prisma.sql`p."categoryId"=${query.categoryId}::uuid`);
    const from = Prisma.sql`FROM "ProductVariant" v JOIN "Product" p ON p."id"=v."productId" WHERE ${Prisma.join(clauses, ' AND ')}`;
    return this.prisma.$transaction(async (tx) => {
      const [ids, counts] = await Promise.all([
        tx.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT v."id" ${from} ORDER BY p."title",v."position",v."id" LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`,
        ),
        tx.$queryRaw<{ total: bigint }[]>(
          Prisma.sql`SELECT count(*) AS total ${from}`,
        ),
      ]);
      const rows = ids.length
        ? await tx.productVariant.findMany({
            where: { sellerId, id: { in: ids.map((row) => row.id) } },
            include: {
              product: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                  imageUrls: true,
                },
              },
            },
          })
        : [];
      return listPage(
        ids.flatMap((id) =>
          rows
            .filter((row) => row.id === id.id)
            .map(({ product, ...variant }) => ({ product, variant })),
        ),
        Number(counts[0]?.total ?? 0),
        query,
      );
    }, readTransactionOptions);
  }
  async sellerSummary(sellerId: string, identity: DecodedIdToken) {
    await this.catalog.requireSellerMember(sellerId, identity, false);
    const [products, orders, stock, categories] = await Promise.all([
      this.prisma.product.groupBy({
        by: ['status'],
        where: { sellerId },
        _count: { _all: true },
      }),
      this.prisma.sellerOrder.groupBy({
        by: ['status'],
        where: { sellerId },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<
        {
          variants: bigint;
          onHand: bigint | null;
          reserved: bigint | null;
          low: bigint;
          out: bigint;
          lowProducts: bigint;
        }[]
      >`SELECT count(*) AS variants,sum("onHand") AS "onHand",sum("reserved") AS reserved,count(*) FILTER(WHERE "onHand"-"reserved"<=5) AS low,count(*) FILTER(WHERE "onHand"-"reserved"<=0) AS out,count(DISTINCT "productId") FILTER(WHERE "onHand"-"reserved"<=5) AS "lowProducts" FROM "ProductVariant" WHERE "sellerId"=${sellerId}::uuid`,
      this.prisma.category.findMany({
        where: { products: { some: { sellerId } } },
        select: { id: true, name: true, slug: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    const productCounts = Object.fromEntries(
        Object.values(ProductStatus).map((status) => [
          status,
          products.find((row) => row.status === status)?._count._all ?? 0,
        ]),
      ),
      orderCounts = Object.fromEntries(
        Object.values(SellerOrderStatus).map((status) => [
          status,
          orders.find((row) => row.status === status)?._count._all ?? 0,
        ]),
      );
    const row = stock[0];
    return {
      productCounts,
      orderCounts,
      totalProducts: products.reduce((sum, row) => sum + row._count._all, 0),
      totalOrders: orders.reduce((sum, row) => sum + row._count._all, 0),
      activeOrders: orders
        .filter((row) => !['DELIVERED', 'CANCELLED'].includes(row.status))
        .reduce((sum, row) => sum + row._count._all, 0),
      variants: Number(row?.variants ?? 0),
      onHand: Number(row?.onHand ?? 0),
      reserved: Number(row?.reserved ?? 0),
      lowStock: Number(row?.low ?? 0),
      outOfStock: Number(row?.out ?? 0),
      lowStockProducts: Number(row?.lowProducts ?? 0),
      categories,
    };
  }
  async adminSummary() {
    const [
      pendingApplications,
      pendingProducts,
      pendingReturns,
      unreconciledCollections,
      orders,
      openReviewReports,
      statuses,
    ] = await Promise.all([
      this.prisma.seller.count({ where: { status: 'PENDING' } }),
      this.prisma.product.count({ where: { status: 'PENDING' } }),
      this.prisma.returnRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.sellerOrder.count({ where: unreconciledCod }),
      this.prisma.order.count(),
      this.prisma.shopReviewReport.count({ where: { status: 'OPEN' } }),
      this.prisma.sellerOrder.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);
    return {
      pendingApplications,
      pendingProducts,
      pendingReturns,
      unreconciledCollections,
      orders,
      openReviewReports,
      orderStatusCounts: Object.fromEntries(
        statuses.map((row) => [row.status, row._count._all]),
      ),
    };
  }
}
