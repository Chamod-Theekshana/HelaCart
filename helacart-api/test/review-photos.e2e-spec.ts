import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { FirebaseAdminService } from '../src/auth/firebase-admin.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ReviewPhotoStorageService } from '../src/shops/review-photo-storage.service.js';
import { configureApp } from '../src/configure-app.js';
describe('Review photos HTTP flow', () => {
  let app: INestApplication<Server>;
  const sellerId = 'c68e7c7c-7ad8-40b8-b2a1-a76c9a7b931c',
    buyerId = '5720886d-9210-461c-9e93-d0176b019eed',
    orderId = 'fd72a1b7-a16e-43f8-bf99-6e84f0e7db57',
    reviewId = '44a84ea8-e101-467f-b6ec-3c54cf953348',
    photoId = '0daa6d81-a735-436d-afad-1a999c283a9e',
    reportId = 'ec72c7f2-44aa-43f0-8ff4-de9880f601ed';
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const stored = {
    id: photoId,
    storageKey: `review-photos/${reviewId}/${photoId}.png`,
    contentType: 'image/png',
    byteSize: png.length,
  };
  const db = {
    user: { upsert: vi.fn() },
    seller: { findFirst: vi.fn() },
    sellerMember: { findUnique: vi.fn() },
    sellerOrder: { findFirst: vi.fn() },
    shopReview: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    shopReviewPhoto: {
      createMany: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    },
    shopReviewReport: { findFirst: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  };
  const firebase = { verifyIdToken: vi.fn() };
  let storage: ReviewPhotoStorageService;
  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .overrideProvider(FirebaseAdminService)
      .useValue(firebase)
      .compile();
    app = fixture.createNestApplication();
    configureApp(app);
    await app.init();
    storage = app.get(ReviewPhotoStorageService);
    vi.spyOn(storage, 'upload');
    vi.spyOn(storage, 'remove');
    vi.spyOn(storage, 'read');
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    for (const group of [
      db.user,
      db.seller,
      db.sellerMember,
      db.sellerOrder,
      db.shopReview,
      db.shopReviewPhoto,
      db.shopReviewReport,
    ])
      for (const mock of Object.values(group)) mock.mockReset();
    firebase.verifyIdToken.mockImplementation((token: string) =>
      Promise.resolve({
        uid: token,
        email: `${token}@example.com`,
        email_verified: token !== 'unverified',
      }),
    );
    db.user.upsert.mockResolvedValue({ id: buyerId, name: 'Nimali' });
    db.seller.findFirst.mockResolvedValue({ id: sellerId });
    db.sellerMember.findUnique.mockResolvedValue(null);
    db.sellerOrder.findFirst.mockResolvedValue({ id: orderId });
    db.shopReview.create.mockResolvedValue({ id: reviewId });
    db.shopReview.updateMany.mockResolvedValue({ count: 1 });
    db.$transaction.mockImplementation((callback: (tx: typeof db) => unknown) =>
      callback(db),
    );
    vi.mocked(storage.upload).mockResolvedValue([stored]);
    vi.mocked(storage.remove).mockResolvedValue(undefined);
    vi.mocked(storage.read).mockResolvedValue({
      bytes: png,
      contentType: 'image/png',
    });
  });
  const root = '/api/v1/shops/island-crafts';
  it('saves multipart review text and photo metadata together', async () => {
    await request(app.getHttpServer())
      .put(`${root}/reviews/${orderId}`)
      .auth('buyer', { type: 'bearer' })
      .field('rating', '5')
      .field('comment', 'Beautiful product and careful packaging.')
      .field('keepPhotoIds', '[]')
      .attach('photos', png, {
        filename: 'received.png',
        contentType: 'image/png',
      })
      .expect(200);
    expect(storage.upload).toHaveBeenCalledOnce();
    expect(db.shopReviewPhoto.createMany).toHaveBeenCalledWith({
      data: [{ ...stored, reviewId: expect.any(String) }],
    });
  });
  it('keeps photo uploads optional for text-only reviews', async () => {
    await request(app.getHttpServer())
      .put(`${root}/reviews/${orderId}`)
      .auth('buyer', { type: 'bearer' })
      .send({ rating: 5, comment: 'A great shopping experience.' })
      .expect(200);
    expect(storage.upload).not.toHaveBeenCalled();
  });
  it('rejects unsupported images and oversized attachments', async () => {
    await request(app.getHttpServer())
      .put(`${root}/reviews/${orderId}`)
      .auth('buyer', { type: 'bearer' })
      .field('rating', '5')
      .field('comment', 'A great shopping experience.')
      .attach('photos', Buffer.from('<svg/>'), {
        filename: 'x.svg',
        contentType: 'image/svg+xml',
      })
      .expect(400);
    await request(app.getHttpServer())
      .put(`${root}/reviews/${orderId}`)
      .auth('buyer', { type: 'bearer' })
      .field('rating', '5')
      .field('comment', 'A great shopping experience.')
      .attach('photos', Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: 'huge.png',
        contentType: 'image/png',
      })
      .expect(413);
    expect(db.shopReview.create).not.toHaveBeenCalled();
  });
  it('rejects four photos and malformed retained IDs', async () => {
    let call = request(app.getHttpServer())
      .put(`${root}/reviews/${orderId}`)
      .auth('buyer', { type: 'bearer' })
      .field('rating', '5')
      .field('comment', 'A great shopping experience.');
    for (let index = 0; index < 4; index++)
      call = call.attach('photos', png, {
        filename: `${index}.png`,
        contentType: 'image/png',
      });
    await call.expect(400);
    await request(app.getHttpServer())
      .put(`${root}/reviews/${orderId}`)
      .auth('buyer', { type: 'bearer' })
      .field('rating', '5')
      .field('comment', 'A great shopping experience.')
      .field('keepPhotoIds', '["not-a-uuid"]')
      .expect(400);
  });
  it('rejects another review photo ID and more than three retained/new photos', async () => {
    db.shopReview.findUnique.mockResolvedValue({
      id: reviewId,
      buyerId,
      isHidden: false,
      photos: [],
    });
    await request(app.getHttpServer())
      .put(`${root}/reviews/${orderId}`)
      .auth('buyer', { type: 'bearer' })
      .field('rating', '5')
      .field('comment', 'A great shopping experience.')
      .field('keepPhotoIds', JSON.stringify([photoId]))
      .expect(400);
    expect(storage.upload).not.toHaveBeenCalled();
  });
  it('requires delivered-order ownership before photo uploads', async () => {
    db.sellerOrder.findFirst.mockResolvedValue(null);
    await request(app.getHttpServer())
      .put(`${root}/reviews/${orderId}`)
      .auth('buyer', { type: 'bearer' })
      .field('rating', '5')
      .field('comment', 'A great shopping experience.')
      .attach('photos', png, { filename: 'x.png', contentType: 'image/png' })
      .expect(403);
    expect(storage.upload).not.toHaveBeenCalled();
  });
  it('rejects hidden-review photo changes', async () => {
    db.shopReview.findUnique.mockResolvedValue({
      id: reviewId,
      buyerId,
      isHidden: true,
      photos: [],
    });
    await request(app.getHttpServer())
      .put(`${root}/reviews/${orderId}`)
      .auth('buyer', { type: 'bearer' })
      .field('rating', '5')
      .field('comment', 'A great shopping experience.')
      .field('keepPhotoIds', '[]')
      .expect(403);
    expect(storage.upload).not.toHaveBeenCalled();
  });
  it('removes omitted attachments and guards concurrent photo edits', async () => {
    const updatedAt = new Date();
    db.shopReview.findUnique.mockResolvedValue({
      id: reviewId,
      buyerId,
      isHidden: false,
      updatedAt,
      photoVersion: 2,
      photos: [{ id: photoId }],
    });
    vi.mocked(storage.upload).mockResolvedValue([]);
    await request(app.getHttpServer())
      .put(`${root}/reviews/${orderId}`)
      .auth('buyer', { type: 'bearer' })
      .field('rating', '4')
      .field('comment', 'Updated review without a photo.')
      .field('keepPhotoIds', '[]')
      .expect(200);
    expect(db.shopReview.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ photoVersion: 2, updatedAt }),
        data: expect.objectContaining({ photoVersion: { increment: 1 } }),
      }),
    );
    expect(db.shopReviewPhoto.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { reviewId, deletedAt: null, id: { notIn: [] } },
      }),
    );
  });
  it('returns photo bytes with cross-origin rendering and no caching', async () => {
    db.shopReviewPhoto.findFirst.mockResolvedValue(stored);
    const response = await request(app.getHttpServer())
      .get(`${root}/reviews/${reviewId}/photos/${photoId}`)
      .expect(200)
      .expect('Content-Type', /image\/png/)
      .expect('Cache-Control', 'private, no-store')
      .expect('Cross-Origin-Resource-Policy', 'cross-origin');
    expect(response.body).toEqual(png);
  });
  it('returns 404 before reading objects belonging to hidden/deleted/other reviews', async () => {
    db.shopReviewPhoto.findFirst.mockResolvedValue(null);
    await request(app.getHttpServer())
      .get(`${root}/reviews/${reviewId}/photos/${photoId}`)
      .expect(404);
    expect(storage.read).not.toHaveBeenCalled();
  });
  it('keeps reported photo snapshots for administrator moderation', async () => {
    db.shopReview.findFirst.mockResolvedValue({
      id: reviewId,
      buyerId: 'other',
      rating: 4,
      comment: 'Review being reported.',
      photos: [{ id: photoId }],
    });
    await request(app.getHttpServer())
      .post(`${root}/reviews/${reviewId}/report`)
      .auth('buyer', { type: 'bearer' })
      .send({ reason: 'Photo contains inappropriate content.' })
      .expect(201);
    expect(db.shopReviewReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ photoSnapshotIds: [photoId] }),
      }),
    );
  });
  it('requires admin access to view reported hidden photos', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/admin/shop-review-reports/${reportId}/photos/${photoId}`)
      .auth('buyer', { type: 'bearer' })
      .expect(403);
    db.shopReviewReport.findFirst.mockResolvedValue({ reviewId });
    db.shopReviewPhoto.findFirst.mockResolvedValue(stored);
    await request(app.getHttpServer())
      .get(`/api/v1/admin/shop-review-reports/${reportId}/photos/${photoId}`)
      .auth('admin-uid', { type: 'bearer' })
      .expect(200);
  });
});
