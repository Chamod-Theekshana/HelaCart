import { ForbiddenException } from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuthService } from '../auth/auth.service.js';
import type { CatalogService } from '../catalog/catalog.service.js';
import type { ShopsService } from './shops.service.js';
import { ShopReviewsService } from './shop-reviews.service.js';
import type { ReviewPhotosService } from './review-photos.service.js';

describe('Review ownership, moderation and historical access', () => {
  const database = {
    sellerMember: { findUnique: vi.fn() },
    sellerOrder: { findFirst: vi.fn(), findMany: vi.fn() },
    shopReview: {
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
    shopReviewReport: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  const auth = { getOrCreateProfile: vi.fn() };
  const shops = { approved: vi.fn() };
  const catalog = { requireSellerMember: vi.fn() };
  const identity = { uid: 'buyer', email_verified: true } as DecodedIdToken;
  const service = new ShopReviewsService(
    database as unknown as PrismaService,
    auth as unknown as AuthService,
    shops as unknown as ShopsService,
    catalog as unknown as CatalogService,
    {} as ReviewPhotosService,
  );
  beforeEach(() => {
    vi.resetAllMocks();
    auth.getOrCreateProfile.mockResolvedValue({ id: 'buyer', name: 'Nimali' });
    shops.approved.mockResolvedValue({ id: 'shop' });
    database.sellerMember.findUnique.mockResolvedValue(null);
    database.sellerOrder.findFirst.mockResolvedValue({ id: 'order' });
    database.$transaction.mockImplementation(
      (callback: (tx: typeof database) => unknown) => callback(database),
    );
  });
  it('rejects editing a review owned by a different buyer', async () => {
    database.shopReview.findUnique.mockResolvedValue({
      id: 'review',
      buyerId: 'another-buyer',
      isHidden: false,
    });
    await expect(
      service.save('shop', 'order', identity, {
        rating: 5,
        comment: 'Excellent experience.',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(database.shopReview.updateMany).not.toHaveBeenCalled();
  });
  it('turns simultaneous first-review conflicts into a helpful 409', async () => {
    database.shopReview.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(
      service.save('shop', 'order', identity, {
        rating: 5,
        comment: 'Excellent experience.',
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('retains older delivered orders so their reviews can still be edited', async () => {
    database.sellerOrder.findMany.mockResolvedValue([
      { id: 'recent', createdAt: new Date(), shopReview: null },
    ]);
    const date = new Date('2025-01-01');
    database.shopReview.findMany.mockResolvedValue([
      {
        id: 'older-review',
        sellerOrderId: 'older-order',
        rating: 4,
        comment: 'Still a good product.',
        isHidden: false,
        sellerOrder: { createdAt: date, status: 'DELIVERED' },
      },
    ]);
    const access = await service.access('shop', identity);
    expect(access.orders).toContainEqual({
      id: 'older-order',
      createdAt: date,
      shopReview: {
        id: 'older-review',
        rating: 4,
        comment: 'Still a good product.',
        isHidden: false,
        deletedAt: null,
      },
    });
    expect(access.myReviews[0]).not.toHaveProperty('sellerOrder');
  });
  it('keeps repeat reports unique for each reporter', async () => {
    database.shopReview.findUnique.mockResolvedValue(null);
    const prisma = database as typeof database & {
      shopReview: { findFirst: ReturnType<typeof vi.fn> };
    };
    prisma.shopReview.findFirst = vi.fn().mockResolvedValue({
      id: 'review',
      buyerId: 'other',
      comment: 'Original text',
      rating: 1,
    });
    database.shopReviewReport.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(
      service.report('shop', 'review', identity, {
        reason: 'Abusive language in review.',
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('refuses to overwrite a report decision already processed by another admin', async () => {
    database.shopReviewReport.findUnique.mockResolvedValue({
      reviewId: 'review',
      status: 'ACTIONED',
    });
    database.shopReviewReport.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.moderate('report', identity, {
        action: 'DISMISS',
        note: 'Already reviewed elsewhere.',
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
