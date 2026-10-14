import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import {
  Prisma,
  SellerReviewDecision,
  SellerStatus,
} from '../generated/prisma/client.js';
import { AuthService } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateSellerApplicationDto } from './dto/create-seller-application.dto.js';

const sellerDetails = {
  id: true,
  name: true,
  slug: true,
  description: true,
  contactPhone: true,
  pickupAddress: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  reviews: {
    select: {
      decision: true,
      reason: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' as const },
    take: 10,
  },
} as const;

@Injectable()
export class SellerApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async apply(identity: DecodedIdToken, dto: CreateSellerApplicationDto) {
    if (!identity.email_verified) {
      throw new ForbiddenException(
        'Verify your email before applying as a seller',
      );
    }
    const profile = await this.auth.getOrCreateProfile(identity);
    try {
      return await this.prisma.seller.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description || null,
          contactPhone: dto.contactPhone,
          pickupAddress: dto.pickupAddress,
          members: { create: { userId: profile.id, role: 'OWNER' } },
        },
        select: sellerDetails,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Seller slug already exists');
      }
      throw error;
    }
  }

  async mine(identity: DecodedIdToken) {
    const profile = await this.auth.getOrCreateProfile(identity);
    return this.prisma.seller.findMany({
      where: { members: { some: { userId: profile.id, role: 'OWNER' } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: sellerDetails,
    });
  }

  async list(status: SellerStatus = SellerStatus.PENDING) {
    return this.prisma.seller.findMany({
      where: { status },
      orderBy: { createdAt: 'asc' },
      take: 50,
      select: {
        ...sellerDetails,
        members: {
          where: { role: 'OWNER' as const },
          select: {
            user: { select: { id: true, email: true, emailVerified: true } },
          },
        },
      },
    });
  }

  async review(
    sellerId: string,
    reviewer: DecodedIdToken,
    decision: SellerReviewDecision,
    reason?: string,
  ) {
    const profile = await this.auth.getOrCreateProfile(reviewer);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.seller.updateMany({
        where: { id: sellerId, status: SellerStatus.PENDING },
        data: {
          status:
            decision === SellerReviewDecision.APPROVED
              ? SellerStatus.APPROVED
              : SellerStatus.REJECTED,
        },
      });
      if (updated.count !== 1) {
        const seller = await tx.seller.findUnique({
          where: { id: sellerId },
          select: { id: true },
        });
        if (!seller)
          throw new NotFoundException('Seller application not found');
        throw new ConflictException(
          'Seller application has already been reviewed',
        );
      }

      await tx.sellerReview.create({
        data: {
          sellerId,
          reviewerUserId: profile.id,
          decision,
          reason: reason ?? null,
        },
      });

      return tx.seller.findUniqueOrThrow({
        where: { id: sellerId },
        select: sellerDetails,
      });
    });
  }
}
