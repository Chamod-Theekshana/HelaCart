import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { FirebaseAdminService } from '../src/auth/firebase-admin.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { configureApp } from '../src/configure-app.js';

describe('Public shops and verified reviews HTTP boundaries', () => {
  let app: INestApplication<Server>;
  const sellerId = 'c68e7c7c-7ad8-40b8-b2a1-a76c9a7b931c';
  const buyerId = '5720886d-9210-461c-9e93-d0176b019eed';
  const orderId = 'fd72a1b7-a16e-43f8-bf99-6e84f0e7db57';
  const reviewId = '44a84ea8-e101-467f-b6ec-3c54cf953348';
  const reportId = '0daa6d81-a735-436d-afad-1a999c283a9e';
  const shop = {
    id: sellerId,
    name: 'Island Crafts',
    slug: 'island-crafts',
    isVerified: true,
    description: 'Made with care',
    publicLocation: 'Kandy',
    logoUrl: null,
    coverUrl: null,
    createdAt: new Date('2026-07-01'),
    shippingFeeLkrMinor: 35000,
  };
  const review = {
    id: reviewId,
    buyerName: 'Nimali',
    rating: 5,
    comment: 'Beautiful products and a great shopping experience.',
    reply: null,
    repliedAt: null,
    createdAt: new Date('2026-10-18'),
    updatedAt: new Date('2026-10-18'),
  };
  const database = {
    user: { upsert: vi.fn() },
    seller: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    sellerMember: { findUnique: vi.fn() },
    product: { findMany: vi.fn(), count: vi.fn() },
    category: { findMany: vi.fn() },
    sellerOrder: { findFirst: vi.fn(), findMany: vi.fn() },
    shopReview: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      groupBy: vi.fn(),
      count: vi.fn(),
    },
    shopReviewReport: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  const firebase = { verifyIdToken: vi.fn() };
  const root = '/api/v1/shops/island-crafts';
  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(database)
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
    database.user.upsert.mockImplementation(
      ({ where }: { where: { firebaseUid: string } }) =>
        Promise.resolve({
          id: buyerId,
          name: 'Nimali',
          firebaseUid: where.firebaseUid,
        }),
    );
    database.seller.findFirst.mockImplementation(
      ({ where }: { where: { slug: string } }) =>
        Promise.resolve(where.slug === shop.slug ? shop : null),
    );
    database.seller.count.mockResolvedValue(1);
    database.seller.findMany.mockResolvedValue([
      { ...shop, _count: { products: 1 } },
    ]);
    database.product.count.mockResolvedValue(1);
    database.product.findMany.mockResolvedValue([]);
    database.category.findMany.mockResolvedValue([]);
    database.shopReview.groupBy.mockResolvedValue([
      { sellerId, rating: 5, _count: { _all: 1 } },
    ]);
    database.shopReview.findMany.mockResolvedValue([review]);
    database.shopReview.count.mockResolvedValue(1);
    database.sellerMember.findUnique.mockResolvedValue(null);
    database.sellerOrder.findFirst.mockResolvedValue(null);
    database.shopReview.findUnique.mockResolvedValue(null);
    database.shopReview.updateMany.mockResolvedValue({ count: 1 });
    database.shopReview.create.mockResolvedValue({ id: reviewId });
    database.shopReviewReport.create.mockResolvedValue({ id: reportId });
    database.shopReviewReport.updateMany.mockResolvedValue({ count: 1 });
    database.shopReviewReport.findUnique.mockResolvedValue({
      reviewId,
      status: 'OPEN',
    });
    database.$transaction.mockImplementation(
      (callback: (tx: typeof database) => unknown) => callback(database),
    );
  });
  it('shows a safe approved public profile without contact or document fields', async () => {
    const response = await request(app.getHttpServer()).get(root).expect(200);
    expect(response.body).toMatchObject({
      name: shop.name,
      isVerified: true,
      rating: { average: 5, total: 1 },
      productCount: 1,
    });
    const query = database.seller.findFirst.mock.calls[0]?.[0] as {
      where: unknown;
      select: Record<string, unknown>;
    };
    expect(query.where).toEqual({ slug: shop.slug, status: 'APPROVED' });
    for (const key of [
      'pickupAddress',
      'contactPhone',
      'documents',
      'identityDocumentType',
      'members',
      'verificationHistory',
      'verificationVersion',
      'verifiedAt',
    ])
      expect(query.select).not.toHaveProperty(key);
  });
  it('returns 404 for a missing or unpublished shop', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/shops/pending-shop')
      .expect(404);
  });
  it('paginates shop discovery and rejects unbounded queries', async () => {
    const result = await request(app.getHttpServer())
      .get('/api/v1/shops?q=Crafts&page=1&limit=12')
      .expect(200);
    expect(result.body.items[0]).toMatchObject({
      slug: shop.slug,
      isVerified: true,
      productCount: 1,
    });
    await request(app.getHttpServer())
      .get('/api/v1/shops?limit=1000')
      .expect(400);
  });
  it('only lists approved products within the selected shop and active category', async () => {
    await request(app.getHttpServer())
      .get(
        `${root}/products?category=home&minPrice=100&maxPrice=500&sort=price-asc`,
      )
      .expect(200);
    expect(database.product.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        sellerId,
        status: 'APPROVED',
        seller: { status: 'APPROVED' },
        category: { isActive: true, slug: 'home' },
        priceLkrMinor: { gte: 100, lte: 500 },
      },
      take: 12,
    });
  });
  it('rejects inverted price ranges and invalid review filters', async () => {
    await request(app.getHttpServer())
      .get(`${root}/products?minPrice=1000&maxPrice=100`)
      .expect(400);
    await request(app.getHttpServer())
      .get(`${root}/reviews?sort=random&rating=6`)
      .expect(400);
  });
  it('publishes only visible reviews and safe reviewer fields with aggregate ratings', async () => {
    const result = await request(app.getHttpServer())
      .get(`${root}/reviews?rating=5`)
      .expect(200);
    expect(result.body.items[0]).toMatchObject({
      buyerName: 'Nimali',
      verifiedPurchase: true,
    });
    expect(result.headers['cache-control']).toBe('no-store');
    const query = database.shopReview.findMany.mock.calls[0]?.[0] as {
      where: unknown;
      select: Record<string, unknown>;
    };
    expect(query.where).toMatchObject({
      sellerId,
      isHidden: false,
      deletedAt: null,
      rating: 5,
    });
    expect(query.select).not.toHaveProperty('buyerId');
    expect(query.select).not.toHaveProperty('sellerOrderId');
  });
  it('requires authentication to write, delete, reply or report', async () => {
    await request(app.getHttpServer())
      .put(`${root}/reviews/${orderId}`)
      .send({ rating: 5, comment: review.comment })
      .expect(401);
    await request(app.getHttpServer())
      .delete(`${root}/reviews/${reviewId}`)
      .expect(401);
    await request(app.getHttpServer())
      .post(`${root}/reviews/${reviewId}/report`)
      .send({ reason: 'A misleading review' })
      .expect(401);
    await request(app.getHttpServer())
      .put(`/api/v1/sellers/${sellerId}/reviews/${reviewId}/reply`)
      .send({ reply: 'Thank you!' })
      .expect(401);
  });
  it('requires a verified email before review writes', async () => {
    await request(app.getHttpServer())
      .put(`${root}/reviews/${orderId}`)
      .auth('unverified', { type: 'bearer' })
      .send({ rating: 5, comment: review.comment })
      .expect(403);
    expect(database.shopReview.create).not.toHaveBeenCalled();
  });
  it('requires the authenticated buyer to own a delivered order from this exact shop', async () => {
    await request(app.getHttpServer())
      .put(`${root}/reviews/${orderId}`)
      .auth('buyer', { type: 'bearer' })
      .send({ rating: 5, comment: review.comment })
      .expect(403);
    expect(database.sellerOrder.findFirst.mock.calls[0]?.[0]).toMatchObject({
      where: { id: orderId, sellerId, status: 'DELIVERED', order: { buyerId } },
    });
    expect(database.shopReview.create).not.toHaveBeenCalled();
  });
  it('rejects self reviews by shop members', async () => {
    database.sellerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      seller: { status: 'APPROVED' },
    });
    await request(app.getHttpServer())
      .put(`${root}/reviews/${orderId}`)
      .auth('buyer', { type: 'bearer' })
      .send({ rating: 5, comment: review.comment })
      .expect(403);
    expect(database.sellerOrder.findFirst).not.toHaveBeenCalled();
  });
  it('rejects invalid stars, whitespace comments and client-supplied buyer identity', async () => {
    await request(app.getHttpServer())
      .put(`${root}/reviews/${orderId}`)
      .auth('buyer', { type: 'bearer' })
      .send({ rating: 6, comment: review.comment })
      .expect(400);
    await request(app.getHttpServer())
      .put(`${root}/reviews/${orderId}`)
      .auth('buyer', { type: 'bearer' })
      .send({ rating: 5, comment: '          ' })
      .expect(400);
    await request(app.getHttpServer())
      .put(`${root}/reviews/${orderId}`)
      .auth('buyer', { type: 'bearer' })
      .send({ rating: 5, comment: review.comment, buyerId: 'someone-else' })
      .expect(400);
  });
  it('creates one review using server-owned buyer identity', async () => {
    database.sellerOrder.findFirst.mockResolvedValue({ id: orderId });
    await request(app.getHttpServer())
      .put(`${root}/reviews/${orderId}`)
      .auth('buyer', { type: 'bearer' })
      .send({ rating: 5, comment: review.comment })
      .expect(200);
    expect(database.shopReview.create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        buyerId,
        sellerId,
        sellerOrderId: orderId,
        buyerName: 'Nimali',
        rating: 5,
      },
    });
  });
  it('edits an existing review instead of adding duplicate order reviews', async () => {
    database.sellerOrder.findFirst.mockResolvedValue({ id: orderId });
    database.shopReview.findUnique.mockResolvedValue({
      id: reviewId,
      buyerId,
      isHidden: false,
    });
    await request(app.getHttpServer())
      .put(`${root}/reviews/${orderId}`)
      .auth('buyer', { type: 'bearer' })
      .send({ rating: 4, comment: 'Updated after using this product.' })
      .expect(200);
    expect(database.shopReview.updateMany.mock.calls[0]?.[0]).toMatchObject({
      where: { id: reviewId, buyerId, sellerId, isHidden: false },
      data: { rating: 4, deletedAt: null },
    });
    expect(database.shopReview.create).not.toHaveBeenCalled();
  });
  it('does not allow a hidden review to be restored or edited', async () => {
    database.sellerOrder.findFirst.mockResolvedValue({ id: orderId });
    database.shopReview.findUnique.mockResolvedValue({
      id: reviewId,
      buyerId,
      isHidden: true,
    });
    await request(app.getHttpServer())
      .put(`${root}/reviews/${orderId}`)
      .auth('buyer', { type: 'bearer' })
      .send({ rating: 5, comment: review.comment })
      .expect(403);
    expect(database.shopReview.updateMany).not.toHaveBeenCalled();
  });
  it('cannot delete a different buyer review', async () => {
    database.shopReview.updateMany.mockResolvedValue({ count: 0 });
    await request(app.getHttpServer())
      .delete(`${root}/reviews/${reviewId}`)
      .auth('buyer', { type: 'bearer' })
      .expect(404);
    expect(database.shopReview.updateMany.mock.calls[0]?.[0]).toMatchObject({
      where: { id: reviewId, buyerId, sellerId, deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });
  it('only permits replies to the current member shop', async () => {
    database.sellerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      seller: { status: 'APPROVED' },
    });
    database.shopReview.updateMany.mockResolvedValue({ count: 0 });
    await request(app.getHttpServer())
      .put(`/api/v1/sellers/${sellerId}/reviews/${reviewId}/reply`)
      .auth('owner', { type: 'bearer' })
      .send({ reply: 'Thank you very much!' })
      .expect(404);
    expect(database.shopReview.updateMany.mock.calls[0]?.[0]).toMatchObject({
      where: { sellerId, id: reviewId, isHidden: false, deletedAt: null },
    });
  });
  it('blocks nonmembers from changing the shop or replying', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/sellers/${sellerId}/shop`)
      .auth('buyer', { type: 'bearer' })
      .send({ name: 'Stolen shop', description: '', publicLocation: '' })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/api/v1/sellers/${sellerId}/reviews/${reviewId}/reply`)
      .auth('buyer', { type: 'bearer' })
      .expect(403);
  });
  it('saves a report snapshot without exposing the reporter publicly', async () => {
    database.shopReview.findFirst.mockResolvedValue({
      ...review,
      buyerId: 'another-buyer',
    });
    await request(app.getHttpServer())
      .post(`${root}/reviews/${reviewId}/report`)
      .auth('buyer', { type: 'bearer' })
      .send({ reason: 'This contains abusive language.' })
      .expect(201);
    expect(database.shopReviewReport.create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        reviewId,
        reporterUserId: buyerId,
        commentSnapshot: review.comment,
        ratingSnapshot: 5,
      },
    });
  });
  it('protects report moderation with administrator access', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/shop-review-reports')
      .auth('buyer', { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/shop-review-reports/${reportId}`)
      .auth('buyer', { type: 'bearer' })
      .send({ action: 'HIDE', note: 'Abusive review content.' })
      .expect(403);
  });
  it('lets an administrator hide a review and audit the decision atomically', async () => {
    // setup-env.ts permits admin-uid, matching the real AdminGuard allowlist.
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/shop-review-reports/${reportId}`)
      .auth('admin-uid', { type: 'bearer' })
      .send({ action: 'HIDE', note: 'Abusive review content.' })
      .expect(200);
    expect(database.shopReview.update.mock.calls[0]?.[0]).toMatchObject({
      where: { id: reviewId },
      data: { isHidden: true },
    });
    expect(
      database.shopReviewReport.updateMany.mock.calls[0]?.[0],
    ).toMatchObject({
      where: { id: reportId, status: 'OPEN' },
      data: { status: 'ACTIONED', moderatorUserId: buyerId },
    });
  });
});
