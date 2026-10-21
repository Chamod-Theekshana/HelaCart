import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { AuthService } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateShopVerificationDto } from './dto/update-shop-verification.dto.js';

// Audit details are intentionally available only to admin queries.
export const adminVerificationSelect = {
  isVerified: true,
  verifiedAt: true,
  verificationVersion: true,
  verificationHistory: {
    select: {
      id: true,
      isVerified: true,
      reason: true,
      createdAt: true,
      version: true,
      reviewer: { select: { id: true, email: true } },
    },
    orderBy: { version: 'desc' as const },
    take: 20,
  },
} as const;

@Injectable()
export class ShopVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async update(
    sellerId: string,
    identity: DecodedIdToken,
    dto: UpdateShopVerificationDto,
  ) {
    const reviewer = await this.auth.getOrCreateProfile(identity);
    return this.prisma.$transaction(
      async (tx) => {
        const now = new Date();
        const result = await tx.seller.updateMany({
          where: {
            id: sellerId,
            isVerified: !dto.isVerified,
            verificationVersion: dto.expectedVersion,
            ...(dto.isVerified
              ? {
                  status: 'APPROVED' as const,
                  identityDocumentType: { not: null },
                  AND: [
                    {
                      documents: { some: { kind: 'IDENTITY_FRONT' as const } },
                    },
                    { documents: { some: { kind: 'IDENTITY_BACK' as const } } },
                  ],
                }
              : {}),
          },
          data: {
            isVerified: dto.isVerified,
            verifiedAt: dto.isVerified ? now : null,
            verificationVersion: { increment: 1 },
          },
        });
        if (result.count !== 1) {
          const shop = await tx.seller.findUnique({
            where: { id: sellerId },
            select: { id: true },
          });
          if (!shop) throw new NotFoundException('Shop not found');
          throw new ConflictException(
            'Reload the application before continuing. Verification requires an approved shop with both identity photos and a current verification decision.',
          );
        }
        await tx.sellerVerification.create({
          data: {
            sellerId,
            reviewerUserId: reviewer.id,
            isVerified: dto.isVerified,
            reason: dto.reason,
            version: dto.expectedVersion + 1,
            createdAt: now,
          },
        });
        return tx.seller.findUniqueOrThrow({
          where: { id: sellerId },
          select: adminVerificationSelect,
        });
      },
      { timeout: 15_000, maxWait: 10_000 },
    );
  }
}
