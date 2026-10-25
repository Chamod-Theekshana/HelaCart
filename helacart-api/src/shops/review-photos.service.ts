import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  ReviewPhotoStorageService,
  type ReviewPhotoFile,
} from './review-photo-storage.service.js';
import { publishedReview } from './shops.service.js';
export const reviewPhotoSelect = {
  where: { deletedAt: null },
  orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  select: { id: true },
} satisfies Prisma.ShopReviewPhotoFindManyArgs;
@Injectable()
export class ReviewPhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ReviewPhotoStorageService,
  ) {}
  async replace(
    reviewId: string,
    keepIds: string[],
    files: ReviewPhotoFile[],
    persist: (tx: Prisma.TransactionClient) => Promise<{ id: string }>,
  ) {
    if (keepIds.length + files.length > 3)
      throw new BadRequestException('Add at most 3 review photos');
    this.storage.validate(files);
    const stored = await this.storage.upload(reviewId, files);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const saved = await persist(tx);
        await tx.shopReviewPhoto.updateMany({
          where: { reviewId, deletedAt: null, id: { notIn: keepIds } },
          data: { deletedAt: new Date() },
        });
        if (stored.length)
          await tx.shopReviewPhoto.createMany({
            data: stored.map((photo) => ({ ...photo, reviewId })),
          });
        return saved;
      });
    } catch (error) {
      await this.storage.remove(stored);
      throw error;
    }
  }
  async publicPhoto(slug: string, reviewId: string, id: string) {
    const photo = await this.prisma.shopReviewPhoto.findFirst({
      where: {
        id,
        reviewId,
        deletedAt: null,
        review: { ...publishedReview, seller: { slug, status: 'APPROVED' } },
      },
      select: { storageKey: true, contentType: true, byteSize: true },
    });
    if (!photo) throw new NotFoundException('Review photo not found');
    return this.storage.read(photo);
  }
  async adminPhoto(reportId: string, id: string) {
    const report = await this.prisma.shopReviewReport.findFirst({
      where: { id: reportId, photoSnapshotIds: { has: id } },
      select: { reviewId: true },
    });
    if (!report) throw new NotFoundException('Reported photo not found');
    const photo = await this.prisma.shopReviewPhoto.findFirst({
      where: { id, reviewId: report.reviewId },
      select: { storageKey: true, contentType: true, byteSize: true },
    });
    if (!photo) throw new NotFoundException('Reported photo not found');
    return this.storage.read(photo);
  }
}
