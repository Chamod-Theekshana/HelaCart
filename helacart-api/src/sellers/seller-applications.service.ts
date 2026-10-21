import { randomUUID } from 'node:crypto';
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
  SellerDocumentKind,
} from '../generated/prisma/client.js';
import { AuthService } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateSellerApplicationDto } from './dto/create-seller-application.dto.js';
import { adminVerificationSelect } from './shop-verification.service.js';
import { ApproveSellerApplicationDto } from './dto/approve-seller-application.dto.js';
import {
  SellerDocumentsService,
  type ApplicationFiles,
} from './seller-documents.service.js';

const sellerDetails = {
  id: true,
  name: true,
  slug: true,
  description: true,
  contactPhone: true,
  pickupAddress: true,
  status: true,
  isVerified: true,
  verifiedAt: true,
  createdAt: true,
  updatedAt: true,
  identityDocumentType: true,
  documents: {
    select: { id: true, kind: true, contentType: true, byteSize: true },
    orderBy: { kind: 'asc' as const },
  },
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
    private readonly documents: SellerDocumentsService,
  ) {}

  async apply(
    identity: DecodedIdToken,
    dto: CreateSellerApplicationDto,
    files: ApplicationFiles = {},
  ) {
    if (!identity.email_verified) {
      throw new ForbiddenException(
        'Verify your email before applying as a seller',
      );
    }
    this.documents.validate(files);
    const profile = await this.auth.getOrCreateProfile(identity);
    if (
      await this.prisma.seller.findUnique({
        where: { slug: dto.slug },
        select: { id: true },
      })
    )
      throw new ConflictException('Seller slug already exists');
    const sellerId = randomUUID();
    const uploaded = await this.documents.upload(sellerId, files);
    try {
      return await this.prisma.seller.create({
        data: {
          id: sellerId,
          name: dto.name,
          slug: dto.slug,
          description: dto.description || null,
          contactPhone: dto.contactPhone,
          pickupAddress: dto.pickupAddress,
          identityDocumentType: dto.identityDocumentType,
          documents: { create: uploaded },
          members: { create: { userId: profile.id, role: 'OWNER' } },
        },
        select: sellerDetails,
      });
    } catch (error) {
      await this.documents.remove(uploaded);
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
        ...adminVerificationSelect,
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
    options: ApproveSellerApplicationDto = {},
  ) {
    const profile = await this.auth.getOrCreateProfile(reviewer);
    const verifyShop =
      decision === SellerReviewDecision.APPROVED && options.verifyShop === true;
    const verifiedAt = verifyShop ? new Date() : null;
    return this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.seller.updateMany({
          where: {
            id: sellerId,
            status: SellerStatus.PENDING,
            ...(verifyShop
              ? { isVerified: false, verificationVersion: 0 }
              : {}),
            ...(decision === SellerReviewDecision.APPROVED
              ? {
                  identityDocumentType: { not: null },
                  AND: [
                    {
                      documents: {
                        some: { kind: SellerDocumentKind.IDENTITY_FRONT },
                      },
                    },
                    {
                      documents: {
                        some: { kind: SellerDocumentKind.IDENTITY_BACK },
                      },
                    },
                  ],
                }
              : {}),
          },
          data: {
            ...(verifyShop
              ? { isVerified: true, verifiedAt, verificationVersion: 1 }
              : {}),
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
            'Seller application has already been reviewed or required identity photos are missing',
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

        if (verifyShop) {
          await tx.sellerVerification.create({
            data: {
              sellerId,
              reviewerUserId: profile.id,
              isVerified: true,
              version: 1,
              reason: options.verificationReason!,
              createdAt: verifiedAt!,
            },
          });
        }

        return tx.seller.findUniqueOrThrow({
          where: { id: sellerId },
          select: sellerDetails,
        });
      },
      { timeout: 15_000, maxWait: 10_000 },
    );
  }
}
