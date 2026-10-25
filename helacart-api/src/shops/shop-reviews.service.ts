import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import {
  ReviewPhotosService,
  reviewPhotoSelect,
} from './review-photos.service.js';
import type { ReviewPhotoFile } from './review-photo-storage.service.js';
import {
  ShopsService,
  paginated,
  publishedReview,
  ratingSummary,
} from './shops.service.js';
import {
  ModerateShopReviewDto,
  ReportShopReviewDto,
  ShopReplyDto,
  ShopReportsDto,
  ShopReviewsDto,
  WriteShopReviewDto,
} from './shops.dto.js';

export const publicShopReview = {
  id: true,
  buyerName: true,
  rating: true,
  comment: true,
  reply: true,
  repliedAt: true,
  createdAt: true,
  updatedAt: true,
  photos: reviewPhotoSelect,
} as const;

@Injectable()
export class ShopReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly shops: ShopsService,
    private readonly catalog: CatalogService,
    private readonly photos: ReviewPhotosService,
  ) {}

  private async viewer(identity: DecodedIdToken) {
    if (!identity.email_verified)
      throw new ForbiddenException(
        'Verify your email before reviewing or reporting a shop',
      );
    return this.auth.getOrCreateProfile(identity);
  }

  async list(slug: string, query: ShopReviewsDto) {
    const shop = await this.shops.approved(slug);
    const where = {
      sellerId: shop.id,
      ...publishedReview,
      ...(query.rating ? { rating: query.rating } : {}),
    };
    const orderBy: Prisma.ShopReviewOrderByWithRelationInput[] =
      query.sort === 'highest'
        ? [{ rating: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
        : query.sort === 'lowest'
          ? [{ rating: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }]
          : [{ createdAt: 'desc' }, { id: 'desc' }];
    const [items, total, counts] = await Promise.all([
      this.prisma.shopReview.findMany({
        where,
        select: publicShopReview,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.shopReview.count({ where }),
      this.prisma.shopReview.groupBy({
        by: ['rating'],
        where: { sellerId: shop.id, ...publishedReview },
        _count: { _all: true },
      }),
    ]);
    return {
      ...paginated(
        items.map((item) => ({ ...item, verifiedPurchase: true })),
        total,
        query,
      ),
      summary: ratingSummary(counts),
    };
  }

  async access(slug: string, identity: DecodedIdToken) {
    const user = await this.viewer(identity);
    const shop = await this.shops.approved(slug);
    const member = await this.prisma.sellerMember.findUnique({
      where: { sellerId_userId: { sellerId: shop.id, userId: user.id } },
      select: { role: true },
    });
    if (member) return { canReply: true, orders: [], myReviews: [] };
    const [orders, reviews] = await Promise.all([
      this.prisma.sellerOrder.findMany({
        where: {
          sellerId: shop.id,
          status: 'DELIVERED',
          order: { buyerId: user.id },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          createdAt: true,
          shopReview: {
            select: {
              id: true,
              rating: true,
              comment: true,
              isHidden: true,
              deletedAt: true,
              photos: reviewPhotoSelect,
            },
          },
        },
      }),
      this.prisma.shopReview.findMany({
        where: { sellerId: shop.id, buyerId: user.id, deletedAt: null },
        take: 1000,
        orderBy: { createdAt: 'desc' },
        select: {
          ...publicShopReview,
          sellerOrderId: true,
          isHidden: true,
          sellerOrder: { select: { createdAt: true, status: true } },
        },
      }),
    ]);
    // Keep older reviews editable even when their order is outside the recent-order list.
    const recentIds = new Set(orders.map((order) => order.id));
    const olderOrders = reviews
      .filter(
        (review) =>
          !recentIds.has(review.sellerOrderId) &&
          review.sellerOrder.status === 'DELIVERED',
      )
      .map((review) => ({
        id: review.sellerOrderId,
        createdAt: review.sellerOrder.createdAt,
        shopReview: {
          id: review.id,
          rating: review.rating,
          comment: review.comment,
          isHidden: review.isHidden,
          deletedAt: null,
          photos: review.photos,
        },
      }));
    return {
      canReply: false,
      orders: [...orders, ...olderOrders],
      myReviews: reviews.map(({ sellerOrder: _order, ...review }) => review),
    };
  }

  async save(
    slug: string,
    sellerOrderId: string,
    identity: DecodedIdToken,
    dto: WriteShopReviewDto,
    files: ReviewPhotoFile[] = [],
  ) {
    const user = await this.viewer(identity);
    const shop = await this.shops.approved(slug);
    const member = await this.prisma.sellerMember.findUnique({
      where: { sellerId_userId: { sellerId: shop.id, userId: user.id } },
      select: { role: true },
    });
    if (member)
      throw new ForbiddenException('Shop members cannot review their own shop');
    const purchase = await this.prisma.sellerOrder.findFirst({
      where: {
        id: sellerOrderId,
        sellerId: shop.id,
        status: 'DELIVERED',
        order: { buyerId: user.id },
      },
      select: { id: true },
    });
    if (!purchase)
      throw new ForbiddenException(
        'A delivered order from this shop is required to write a review',
      );
    const current = await this.prisma.shopReview.findUnique({
      where: { sellerOrderId },
      select: {
        id: true,
        buyerId: true,
        isHidden: true,
        updatedAt: true,
        photoVersion: true,
        photos: reviewPhotoSelect,
      },
    });
    if (current && (current.buyerId !== user.id || current.isHidden))
      throw new ForbiddenException('This review cannot be edited');
    const activeIds = current?.photos?.map((photo) => photo.id) ?? [];
    const keepIds = dto.keepPhotoIds ?? activeIds;
    if (keepIds.some((id) => !activeIds.includes(id)))
      throw new BadRequestException(
        'Only photos already attached to your review can be retained',
      );
    const photoChange = files.length > 0 || dto.keepPhotoIds !== undefined;
    const reviewId = current?.id ?? randomUUID();
    const persist = async (tx: Prisma.TransactionClient) => {
      if (current) {
        const result = await tx.shopReview.updateMany({
          where: {
            id: current.id,
            buyerId: user.id,
            sellerId: shop.id,
            isHidden: false,
            ...(photoChange
              ? {
                  updatedAt: current.updatedAt,
                  photoVersion: current.photoVersion,
                }
              : {}),
          },
          data: {
            rating: dto.rating,
            comment: dto.comment,
            deletedAt: null,
            ...(photoChange ? { photoVersion: { increment: 1 } } : {}),
          },
        });
        if (!result.count)
          throw new ConflictException(
            'This review has changed. Refresh and try again',
          );
        return { id: current.id };
      }
      return tx.shopReview.create({
        data: {
          id: reviewId,
          sellerId: shop.id,
          buyerId: user.id,
          sellerOrderId,
          buyerName: user.name?.trim().slice(0, 100) || 'Verified buyer',
          rating: dto.rating,
          comment: dto.comment,
        },
        select: { id: true },
      });
    };
    try {
      return photoChange
        ? await this.photos.replace(reviewId, keepIds, files, persist)
        : await persist(this.prisma);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'This order already has a review. Refresh to edit it',
        );
      throw error;
    }
  }

  async remove(slug: string, id: string, identity: DecodedIdToken) {
    const user = await this.viewer(identity);
    const shop = await this.shops.approved(slug);
    const result = await this.prisma.shopReview.updateMany({
      where: { id, sellerId: shop.id, buyerId: user.id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (!result.count) throw new NotFoundException('Your review was not found');
    return { deleted: true };
  }

  async reply(
    sellerId: string,
    reviewId: string,
    identity: DecodedIdToken,
    dto: ShopReplyDto | null,
  ) {
    const user = await this.catalog.requireSellerMember(
      sellerId,
      identity,
      true,
    );
    const result = await this.prisma.shopReview.updateMany({
      where: { id: reviewId, sellerId, ...publishedReview },
      data: {
        reply: dto?.reply ?? null,
        replyUserId: dto ? user.id : null,
        repliedAt: dto ? new Date() : null,
      },
    });
    if (!result.count)
      throw new NotFoundException('Published review not found for this shop');
    return { saved: true };
  }

  async report(
    slug: string,
    reviewId: string,
    identity: DecodedIdToken,
    dto: ReportShopReviewDto,
  ) {
    const user = await this.viewer(identity);
    const shop = await this.shops.approved(slug);
    const review = await this.prisma.shopReview.findFirst({
      where: { id: reviewId, sellerId: shop.id, ...publishedReview },
      select: {
        id: true,
        buyerId: true,
        comment: true,
        rating: true,
        photos: reviewPhotoSelect,
      },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (review.buyerId === user.id)
      throw new ForbiddenException(
        'Use edit or delete to manage your own review',
      );
    try {
      await this.prisma.shopReviewReport.create({
        data: {
          reviewId,
          reporterUserId: user.id,
          reason: dto.reason,
          commentSnapshot: review.comment,
          ratingSnapshot: review.rating,
          photoSnapshotIds: review.photos?.map((photo) => photo.id) ?? [],
        },
      });
      return { reported: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('You have already reported this review');
      throw error;
    }
  }

  async reports(query: ShopReportsDto) {
    const where = { status: query.status };
    const [items, total] = await Promise.all([
      this.prisma.shopReviewReport.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          reason: true,
          status: true,
          commentSnapshot: true,
          ratingSnapshot: true,
          photoSnapshotIds: true,
          createdAt: true,
          moderationNote: true,
          reviewedAt: true,
          review: {
            select: {
              ...publicShopReview,
              isHidden: true,
              deletedAt: true,
              seller: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      }),
      this.prisma.shopReviewReport.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  async moderate(
    id: string,
    identity: DecodedIdToken,
    dto: ModerateShopReviewDto,
  ) {
    const user = await this.auth.getOrCreateProfile(identity);
    return this.prisma.$transaction(async (tx) => {
      const report = await tx.shopReviewReport.findUnique({
        where: { id },
        select: { reviewId: true, status: true },
      });
      if (!report) throw new NotFoundException('Review report not found');
      const result = await tx.shopReviewReport.updateMany({
        where: { id, status: 'OPEN' },
        data: {
          status: dto.action === 'HIDE' ? 'ACTIONED' : 'DISMISSED',
          moderatorUserId: user.id,
          moderationNote: dto.note,
          reviewedAt: new Date(),
        },
      });
      if (!result.count)
        throw new ConflictException('This report has already been reviewed');
      if (dto.action === 'HIDE')
        await tx.shopReview.update({
          where: { id: report.reviewId },
          data: { isHidden: true },
        });
      return { reviewed: true };
    });
  }
}
