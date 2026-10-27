import { AccountAccessService } from '../src/auth/account-access.service.js';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { FirebaseAdminService } from '../src/auth/firebase-admin.service.js';
import { configureApp } from '../src/configure-app.js';
import { Prisma } from '../src/generated/prisma/client.js';
describe('Package 1 read APIs and buyer cancellation', () => {
  let app: INestApplication<Server>;
  const sellerId = 'c68e7c7c-7ad8-40b8-b2a1-a76c9a7b931c',
    buyerId = '5720886d-9210-461c-9e93-d0176b019eed',
    orderId = 'fd72a1b7-a16e-43f8-bf99-6e84f0e7db57',
    partId = '44a84ea8-e101-467f-b6ec-3c54cf953348',
    variantId = '0daa6d81-a735-436d-afad-1a999c283a9e';
  const db = {
    promotion: { findMany: async () => [] },
    user: { upsert: vi.fn() },
    seller: { count: vi.fn(), findMany: vi.fn() },
    sellerMember: { findUnique: vi.fn(), findMany: vi.fn() },
    product: { count: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
    category: { findMany: vi.fn() },
    productVariant: { findMany: vi.fn(), update: vi.fn() },
    order: { findMany: vi.fn(), count: vi.fn() },
    sellerOrder: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
      groupBy: vi.fn(),
    },
    sellerOrderEvent: { create: vi.fn() },
    inventoryMovement: { create: vi.fn() },
    returnRequest: { findMany: vi.fn(), count: vi.fn() },
    notification: {
      count: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
    },
    buyerAddress: { count: vi.fn() },
    shopReviewReport: { count: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  };
  const firebase = { verifyIdToken: vi.fn() };
  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .overrideProvider(AccountAccessService)
      .useValue({ assertActive: async () => {} })
      .overrideProvider(FirebaseAdminService)
      .useValue(firebase)
      .compile();
    app = fixture.createNestApplication();
    configureApp(app);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    vi.resetAllMocks();
    firebase.verifyIdToken.mockImplementation((token: string) =>
      Promise.resolve({
        uid: token,
        email: `${token}@example.com`,
        email_verified: token !== 'unverified',
      }),
    );
    db.user.upsert.mockResolvedValue({ id: buyerId });
    db.sellerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      seller: { status: 'APPROVED' },
    });
    db.$transaction.mockImplementation((callback: (tx: typeof db) => unknown) =>
      callback(db),
    );
    db.order.findMany.mockResolvedValue([{ id: orderId, sellerOrders: [] }]);
    db.order.count.mockResolvedValue(121);
    db.sellerOrder.findMany.mockResolvedValue([]);
    db.sellerOrder.count.mockResolvedValue(98);
    db.returnRequest.findMany.mockResolvedValue([]);
    db.returnRequest.count.mockResolvedValue(72);
    db.notification.findMany.mockResolvedValue([]);
    db.notification.count.mockResolvedValue(103);
    db.buyerAddress.count.mockResolvedValue(3);
    db.seller.count.mockResolvedValue(160);
    db.product.count.mockResolvedValue(201);
    db.shopReviewReport.count.mockResolvedValue(4);
    db.product.groupBy.mockResolvedValue([
      { status: 'APPROVED', _count: { _all: 160 } },
      { status: 'DRAFT', _count: { _all: 50 } },
    ]);
    db.sellerOrder.groupBy.mockResolvedValue([
      { status: 'PLACED', _count: { _all: 80 } },
      { status: 'DELIVERED', _count: { _all: 300 } },
    ]);
    db.category.findMany.mockResolvedValue([]);
    db.$queryRaw.mockImplementation((query: Prisma.Sql) =>
      Promise.resolve(
        !query.sql || query.sql.includes('sum("onHand")')
          ? [
              {
                variants: 250n,
                onHand: 2000n,
                reserved: 100n,
                low: 15n,
                out: 3n,
                lowProducts: 9n,
              },
            ]
          : query.sql.startsWith('SELECT count(*)')
            ? [{ total: 121n }]
            : [],
      ),
    );
  });
  it('protects all private list families', async () => {
    for (const path of [
      '/workspace/me/orders',
      '/workspace/me/returns',
      `/workspace/sellers/${sellerId}/products`,
      '/workspace/admin/orders',
    ])
      await request(app.getHttpServer())
        .get('/api/v1' + path)
        .expect(401);
  });
  it('rejects unverified accounts, oversized pages and invalid statuses', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/workspace/me/orders')
      .auth('unverified', { type: 'bearer' })
      .expect(403);
    for (const query of ['limit=500', 'page=0', 'status=INVALID'])
      await request(app.getHttpServer())
        .get('/api/v1/workspace/me/orders?' + query)
        .auth('buyer', { type: 'bearer' })
        .expect(400);
  });
  it('keeps buyer page 4 scoped to the signed-in buyer with a full count', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/workspace/me/orders?page=4&limit=20&q=%23fd72a1b7')
      .auth('buyer', { type: 'bearer' })
      .expect(200);
    expect(response.body).toMatchObject({ page: 4, total: 121, pages: 7 });
    expect(db.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ buyerId }),
        skip: 60,
        take: 20,
      }),
    );
    expect(db.order.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ buyerId }) }),
    );
  });
  it('includes existing return status and order event history', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/workspace/me/orders')
      .auth('buyer', { type: 'bearer' })
      .expect(200);
    expect(db.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          sellerOrders: expect.objectContaining({
            select: expect.objectContaining({
              returnRequests: {
                select: { id: true, status: true },
                orderBy: { createdAt: 'desc' },
              },
              events: expect.any(Object),
            }),
          }),
        }),
      }),
    );
  });
  it('paginates buyer return history without accepting another buyer ID', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/workspace/me/returns?page=4&status=RESOLVED')
      .auth('buyer', { type: 'bearer' })
      .expect(200);
    expect(db.returnRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ buyerId, status: 'RESOLVED' }),
        skip: 60,
        take: 20,
      }),
    );
    await request(app.getHttpServer())
      .get('/api/v1/workspace/me/returns?buyerId=someone-else')
      .auth('buyer', { type: 'bearer' })
      .expect(400);
  });
  it('counts buyer KPIs independently from visible pages', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/workspace/me/summary')
      .auth('buyer', { type: 'bearer' })
      .expect(200);
    expect(response.body).toEqual({
      orders: 121,
      activeSellerOrders: 98,
      addresses: 3,
      unreadNotifications: 103,
      returns: 72,
    });
    expect(db.sellerOrder.count).toHaveBeenCalledWith({
      where: {
        order: { buyerId },
        status: { notIn: ['DELIVERED', 'CANCELLED'] },
      },
    });
  });
  it('gates seller queries before reading any data', async () => {
    db.sellerMember.findUnique.mockResolvedValue(null);
    await request(app.getHttpServer())
      .get(`/api/v1/workspace/sellers/${sellerId}/products?page=4`)
      .auth('buyer', { type: 'bearer' })
      .expect(403);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
  it('keeps seller pagination and counters scoped to that store', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/workspace/sellers/${sellerId}/orders?page=4`)
      .auth('seller', { type: 'bearer' })
      .expect(200);
    expect(db.sellerOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sellerId }, skip: 60, take: 20 }),
    );
    const response = await request(app.getHttpServer())
      .get(`/api/v1/workspace/sellers/${sellerId}/summary`)
      .auth('seller', { type: 'bearer' })
      .expect(200);
    expect(response.body).toMatchObject({
      totalProducts: 210,
      totalOrders: 380,
      activeOrders: 80,
      lowStock: 15,
      variants: 250,
      onHand: 2000,
      productCounts: { APPROVED: 160, REJECTED: 0 },
    });
  });
  it('requires administrator access for all platform-wide queues', async () => {
    for (const path of [
      'summary',
      'orders',
      'products',
      'returns',
      'seller-applications',
      'cod',
    ])
      await request(app.getHttpServer())
        .get('/api/v1/workspace/admin/' + path)
        .auth('buyer', { type: 'bearer' })
        .expect(403);
  });
  it('returns aggregate admin totals instead of the current page length', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/workspace/admin/summary')
      .auth('admin-uid', { type: 'bearer' })
      .expect(200);
    expect(response.body).toMatchObject({
      pendingApplications: 160,
      pendingProducts: 201,
      pendingReturns: 72,
      unreconciledCollections: 98,
      orders: 121,
      orderStatusCounts: { PLACED: 80, DELIVERED: 300 },
    });
  });
  it('paginates old admin applications and COD collections', async () => {
    db.seller.findMany.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get('/api/v1/workspace/admin/seller-applications?page=4&q=store')
      .auth('admin-uid', { type: 'bearer' })
      .expect(200);
    expect(db.seller.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 60,
        take: 20,
        where: expect.objectContaining({ status: 'PENDING' }),
      }),
    );
    await request(app.getHttpServer())
      .get('/api/v1/workspace/admin/cod?page=4')
      .auth('admin-uid', { type: 'bearer' })
      .expect(200);
    expect(db.sellerOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 60,
        where: expect.objectContaining({
          status: 'DELIVERED',
          codReconciliations: { none: { decision: 'RECONCILED' } },
        }),
      }),
    );
  });
  it('filters the catalog before pagination and keeps user input parameterized', async () => {
    await request(app.getHttpServer())
      .get(
        '/api/v1/catalog/products?page=4&minPrice=100&maxPrice=500&inStock=true&sort=price-asc&q=drop%20table',
      )
      .expect(200);
    const query = db.$queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(query.sql).toContain('LATERAL');
    expect(query.sql).toContain('offer.available');
    expect(query.sql).toContain("p.status='APPROVED'");
    expect(query.sql).not.toContain('drop table');
    expect(query.values).toContain('drop');
    expect(query.values).toContain('table');
    expect(query.values.slice(-2)).toEqual([20, 60]);
  });
  it('rejects invalid public filters and inverted prices', async () => {
    for (const query of [
      'minPrice=500&maxPrice=1',
      'sort=random',
      'inStock=maybe',
      'limit=1000',
      'minPrice=-1',
    ])
      await request(app.getHttpServer())
        .get('/api/v1/catalog/products?' + query)
        .expect(400);
  });
  it('uses the same displayed variant price for filtering results', async () => {
    db.$queryRaw.mockImplementation((query: Prisma.Sql) =>
      Promise.resolve(
        query.sql.startsWith('SELECT count(*)')
          ? [{ total: 1n }]
          : [{ id: orderId, price: 9000 }],
      ),
    );
    db.product.findMany.mockResolvedValue([
      {
        id: orderId,
        title: 'Product',
        priceLkrMinor: 1000,
        variants: [
          {
            id: variantId,
            position: 0,
            sku: 'SKU',
            optionValues: {},
            priceLkrMinor: 9000,
            onHand: 7,
            reserved: 2,
          },
        ],
      },
    ]);
    const response = await request(app.getHttpServer())
      .get('/api/v1/catalog/products?minPrice=8500')
      .expect(200);
    expect(response.body.items[0]).toMatchObject({
      listingPriceLkrMinor: 9000,
      variants: [{ availableQuantity: 5 }],
    });
    expect(response.body.items[0].variants[0]).not.toHaveProperty('onHand');
  });
  it('cancels only an owned PLACED delivery, restores stock and records history', async () => {
    db.sellerOrder.findFirst.mockResolvedValue({
      id: partId,
      status: 'PLACED',
      items: [{ variantId, quantity: 2 }],
    });
    db.sellerOrder.updateMany.mockResolvedValue({ count: 1 });
    db.sellerOrder.findUniqueOrThrow.mockResolvedValue({
      id: partId,
      sellerId,
      order: { buyerId },
    });
    db.sellerMember.findMany.mockResolvedValue([{ userId: buyerId }]);
    await request(app.getHttpServer())
      .patch(`/api/v1/me/orders/${orderId}/seller-orders/${partId}/cancel`)
      .auth('buyer', { type: 'bearer' })
      .expect(200);
    expect(db.sellerOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: partId, orderId, order: { buyerId } },
      }),
    );
    expect(db.productVariant.update).toHaveBeenCalledWith({
      where: { id: variantId },
      data: { onHand: { increment: 2 } },
    });
    expect(db.sellerOrderEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: 'PLACED',
          toStatus: 'CANCELLED',
        }),
      }),
    );
  });
  it('does not restock a foreign, accepted or concurrently changed order', async () => {
    db.sellerOrder.findFirst.mockResolvedValue(null);
    await request(app.getHttpServer())
      .patch(`/api/v1/me/orders/${orderId}/seller-orders/${partId}/cancel`)
      .auth('buyer', { type: 'bearer' })
      .expect(404);
    db.sellerOrder.findFirst.mockResolvedValue({
      id: partId,
      status: 'ACCEPTED',
      items: [],
    });
    await request(app.getHttpServer())
      .patch(`/api/v1/me/orders/${orderId}/seller-orders/${partId}/cancel`)
      .auth('buyer', { type: 'bearer' })
      .expect(409);
    db.sellerOrder.findFirst.mockResolvedValue({
      id: partId,
      status: 'PLACED',
      items: [],
    });
    db.sellerOrder.updateMany.mockResolvedValue({ count: 0 });
    await request(app.getHttpServer())
      .patch(`/api/v1/me/orders/${orderId}/seller-orders/${partId}/cancel`)
      .auth('buyer', { type: 'bearer' })
      .expect(409);
    expect(db.productVariant.update).not.toHaveBeenCalled();
  });
});
