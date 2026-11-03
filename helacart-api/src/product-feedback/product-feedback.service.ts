import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { ratingSummary, paginated } from '../shops/shops.service.js';
import {
  FeedbackPageDto,
  FeedbackVersionDto,
  WriteProductFeedbackDto,
  ProductReplyDto,
  ReportProductFeedbackDto,
  ProductReportsDto,
  ModerateProductFeedbackDto,
} from './product-feedback.dto.js';

export const visibleProductFeedback = {
  isHidden: false,
  deletedAt: null,
} as const;
export const publicProductFeedback = {
  id: true,
  buyerName: true,
  rating: true,
  comment: true,
  variantLabel: true,
  createdAt: true,
  updatedAt: true,
  reply: true,
  repliedAt: true,
} as const;
const productVisible = {
  status: 'APPROVED',
  seller: { status: 'APPROVED' },
  category: { isActive: true },
} as const;
const txOptions = { timeout: 30000, maxWait: 10000 };
@Injectable()
export class ProductFeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly catalog: CatalogService,
  ) {}
  private async viewer(identity: DecodedIdToken) {
    if (!identity.email_verified)
      throw new ForbiddenException(
        'Verify your email to manage product reviews',
      );
    return this.auth.getOrCreateProfile(identity);
  }
  private async product(
    productId: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const product = await db.product.findFirst({
      where: { id: productId, ...productVisible },
      select: { id: true, sellerId: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }
  async list(productId: string, q: FeedbackPageDto) {
    await this.product(productId);
    return this.prisma.$transaction(
      async (tx) => {
        const where = {
          productId,
          ...visibleProductFeedback,
          ...(q.rating ? { rating: q.rating } : {}),
        };
        const [items, total, groups] = await Promise.all([
          tx.customerProductReview.findMany({
            where,
            skip: (q.page - 1) * q.limit,
            take: q.limit,
            orderBy: [
              ...(q.sort === 'newest'
                ? []
                : [
                    {
                      rating:
                        q.sort === 'highest'
                          ? ('desc' as const)
                          : ('asc' as const),
                    },
                  ]),
              { createdAt: 'desc' },
              { id: 'desc' },
            ],
            select: publicProductFeedback,
          }),
          tx.customerProductReview.count({ where }),
          tx.customerProductReview.groupBy({
            by: ['rating'],
            where: { productId, ...visibleProductFeedback },
            _count: { _all: true },
          }),
        ]);
        return {
          ...paginated(items, total, q),
          summary: ratingSummary(groups),
        };
      },
      {
        ...txOptions,
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );
  }
  async access(productId: string, identity: DecodedIdToken) {
    const user = await this.viewer(identity),
      product = await this.product(productId);
    const [member, purchase, review] = await Promise.all([
      this.prisma.sellerMember.findUnique({
        where: {
          sellerId_userId: { sellerId: product.sellerId, userId: user.id },
        },
        select: { id: true },
      }),
      this.prisma.orderItem.findFirst({
        where: {
          variant: { productId },
          sellerOrder: {
            sellerId: product.sellerId,
            status: 'DELIVERED',
            order: { buyerId: user.id },
          },
        },
        orderBy: { id: 'desc' },
        select: { id: true },
      }),
      this.prisma.customerProductReview.findUnique({
        where: { productId_buyerId: { productId, buyerId: user.id } },
        select: {
          ...publicProductFeedback,
          version: true,
          isHidden: true,
          deletedAt: true,
        },
      }),
    ]);
    return {
      eligible: Boolean(purchase) && !member && !review?.isHidden,
      reason: member
        ? 'Shop members cannot review their own products'
        : review?.isHidden
          ? 'This review is hidden by moderation'
          : !purchase
            ? 'A delivered purchase of this product is required'
            : null,
      review,
    };
  }

  async mine(identity: DecodedIdToken, q: FeedbackPageDto) {
    const user = await this.viewer(identity),
      where = { buyerId: user.id, deletedAt: null };
    const [rows, total] = await Promise.all([
      this.prisma.customerProductReview.findMany({
        where,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          ...publicProductFeedback,
          version: true,
          isHidden: true,
          product: {
            select: {
              id: true,
              title: true,
              status: true,
              seller: { select: { status: true } },
              category: { select: { isActive: true } },
            },
          },
        },
      }),
      this.prisma.customerProductReview.count({ where }),
    ]);
    return paginated(
      rows.map(({ product, ...review }) => ({
        ...review,
        product: { id: product.id, title: product.title },
        canViewProduct:
          product.status === 'APPROVED' &&
          product.seller.status === 'APPROVED' &&
          product.category.isActive,
      })),
      total,
      q,
    );
  }
  async save(
    productId: string,
    identity: DecodedIdToken,
    dto: WriteProductFeedbackDto,
  ) {
    const user = await this.viewer(identity);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id}::uuid FOR UPDATE`;
        const product = await this.product(productId, tx);
        const member = await tx.sellerMember.findUnique({
          where: {
            sellerId_userId: { sellerId: product.sellerId, userId: user.id },
          },
          select: { id: true },
        });
        if (member)
          throw new ForbiddenException(
            'Shop members cannot review their own products',
          );
        const current = await tx.customerProductReview.findUnique({
          where: { productId_buyerId: { productId, buyerId: user.id } },
        });
        if (current?.isHidden)
          throw new ForbiddenException('This review is hidden by moderation');
        if ((current?.version ?? 0) !== dto.version)
          throw new ConflictException(
            'This review changed. Refresh before saving',
          );
        const purchase = await tx.orderItem.findFirst({
          where: {
            variant: { productId },
            sellerOrder: {
              sellerId: product.sellerId,
              status: 'DELIVERED',
              order: { buyerId: user.id },
            },
          },
          orderBy: { id: 'desc' },
          select: { id: true, sku: true, optionValues: true },
        });
        if (!purchase)
          throw new ForbiddenException(
            'A delivered purchase of this product is required',
          );
        if (current) {
          const result = await tx.customerProductReview.updateMany({
            where: { id: current.id, version: dto.version, isHidden: false },
            data: {
              rating: dto.rating,
              comment: dto.comment,
              deletedAt: null,
              version: { increment: 1 },
            },
          });
          if (!result.count)
            throw new ConflictException(
              'This review changed. Refresh before saving',
            );
        } else
          await tx.customerProductReview.create({
            data: {
              productId,
              buyerId: user.id,
              orderItemId: purchase.id,
              buyerName: user.name?.trim().slice(0, 100) || 'Verified buyer',
              variantLabel: (
                Object.values(
                  purchase.optionValues as Record<string, string>,
                ).join(' / ') || purchase.sku
              ).slice(0, 300),
              rating: dto.rating,
              comment: dto.comment,
            },
          });
        return { saved: true };
      }, txOptions);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'This product already has your review. Refresh to edit it',
        );
      throw error;
    }
  }
  async remove(
    productId: string,
    identity: DecodedIdToken,
    dto: FeedbackVersionDto,
  ) {
    const user = await this.viewer(identity);
    const result = await this.prisma.customerProductReview.updateMany({
      where: {
        productId,
        buyerId: user.id,
        version: dto.version,
        deletedAt: null,
      },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });
    if (!result.count)
      throw new ConflictException(
        'Your review changed. Refresh before deleting',
      );
    return { deleted: true };
  }
  async sellerList(
    sellerId: string,
    identity: DecodedIdToken,
    q: FeedbackPageDto,
  ) {
    await this.catalog.requireSellerMember(sellerId, identity, false);
    const where = {
      product: { sellerId },
      deletedAt: null,
      ...(q.rating ? { rating: q.rating } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.customerProductReview.findMany({
        where,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          ...publicProductFeedback,
          version: true,
          isHidden: true,
          product: { select: { id: true, title: true } },
        },
      }),
      this.prisma.customerProductReview.count({ where }),
    ]);
    return paginated(items, total, q);
  }
  async reply(
    sellerId: string,
    id: string,
    identity: DecodedIdToken,
    dto: ProductReplyDto,
  ) {
    const user = await this.catalog.requireSellerMember(
      sellerId,
      identity,
      true,
    );
    const result = await this.prisma.customerProductReview.updateMany({
      where: {
        id,
        product: { sellerId },
        version: dto.version,
        ...visibleProductFeedback,
      },
      data: {
        reply: dto.reply || null,
        replyUserId: dto.reply ? user.id : null,
        repliedAt: dto.reply ? new Date() : null,
        version: { increment: 1 },
      },
    });
    if (!result.count)
      throw new ConflictException(
        'Published review not found or changed. Refresh before replying',
      );
    return { saved: true };
  }
  async report(
    productId: string,
    id: string,
    identity: DecodedIdToken,
    dto: ReportProductFeedbackDto,
  ) {
    const user = await this.viewer(identity);
    await this.product(productId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const review = await tx.customerProductReview.findFirst({
          where: { id, productId, ...visibleProductFeedback },
          select: { buyerId: true, rating: true, comment: true },
        });
        if (!review) throw new NotFoundException('Review not found');
        if (review.buyerId === user.id)
          throw new ForbiddenException(
            'Use edit or delete to manage your own review',
          );
        await tx.customerProductReviewReport.create({
          data: {
            reviewId: id,
            reporterId: user.id,
            reason: dto.reason,
            ratingSnapshot: review.rating,
            commentSnapshot: review.comment,
          },
        });
        return { reported: true };
      }, txOptions);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('You have already reported this review');
      throw error;
    }
  }
  async reports(q: ProductReportsDto) {
    const where = { status: q.status };
    const [items, total] = await Promise.all([
      this.prisma.customerProductReviewReport.findMany({
        where,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          reason: true,
          ratingSnapshot: true,
          commentSnapshot: true,
          status: true,
          note: true,
          reviewedAt: true,
          createdAt: true,
          review: {
            select: {
              ...publicProductFeedback,
              isHidden: true,
              deletedAt: true,
              product: {
                select: {
                  id: true,
                  title: true,
                  seller: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.customerProductReviewReport.count({ where }),
    ]);
    return paginated(items, total, q);
  }
  async moderate(
    id: string,
    identity: DecodedIdToken,
    dto: ModerateProductFeedbackDto,
  ) {
    const user = await this.viewer(identity);
    return this.prisma.$transaction(async (tx) => {
      const report = await tx.customerProductReviewReport.findUnique({
        where: { id },
        select: { reviewId: true },
      });
      if (!report) throw new NotFoundException('Review report not found');
      const result = await tx.customerProductReviewReport.updateMany({
        where: { id, status: 'OPEN' },
        data: {
          status: dto.action === 'HIDE' ? 'ACTIONED' : 'DISMISSED',
          note: dto.note,
          moderatorId: user.id,
          reviewedAt: new Date(),
        },
      });
      if (!result.count)
        throw new ConflictException('This report has already been reviewed');
      if (dto.action === 'HIDE')
        await tx.customerProductReview.update({
          where: { id: report.reviewId },
          data: { isHidden: true, version: { increment: 1 } },
        });
      return { reviewed: true };
    }, txOptions);
  }
}
