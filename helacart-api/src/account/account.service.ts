import { Injectable, Logger } from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import { FirebaseAdminService } from '../auth/firebase-admin.service.js';
import { ProfilePhotoStorageService } from '../auth/profile-photo-storage.service.js';
import { apiError } from '../common/api-error.js';
import { describeError } from '../common/describe-error.js';
import { openSellerOrderStatuses } from '../commerce/order-state.js';

export function deletedEmail(userId: string) {
  return `deleted-${userId}@deleted.helacart.invalid`;
}

/** PDPA (No. 9 of 2022) data export and account deletion (contract §8). */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly firebase: FirebaseAdminService,
    private readonly photos: ProfilePhotoStorageService,
  ) {}

  async exportData(identity: DecodedIdToken) {
    const user = await this.auth.getOrCreateProfile(identity);
    const userId = user.id;
    const [
      profile,
      addresses,
      orders,
      returns,
      shopReviews,
      productReviews,
      favorites,
      supportCases,
      notifications,
      verifiedPhones,
      preferences,
    ] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          emailVerified: true,
          name: true,
          phone: true,
          createdAt: true,
          updatedAt: true,
          accessStatus: true,
          memberships: {
            select: {
              role: true,
              createdAt: true,
              seller: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      }),
      this.prisma.buyerAddress.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.order.findMany({
        where: { buyerId: userId },
        orderBy: { createdAt: 'asc' },
        include: {
          sellerOrders: {
            include: {
              items: true,
              events: { orderBy: { createdAt: 'asc' } },
              shipment: true,
              seller: { select: { name: true, slug: true } },
            },
          },
        },
      }),
      this.prisma.returnRequest.findMany({
        where: { buyerId: userId },
        orderBy: { createdAt: 'asc' },
        include: { items: true },
      }),
      this.prisma.shopReview.findMany({
        where: { buyerId: userId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.customerProductReview.findMany({
        where: { buyerId: userId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.productFavorite.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.supportCase.findMany({
        where: { OR: [{ openerId: userId }, { buyerId: userId }] },
        orderBy: { createdAt: 'asc' },
        include: {
          messages: {
            where: { authorId: userId },
            orderBy: { createdAt: 'asc' },
            select: { id: true, body: true, createdAt: true },
          },
        },
      }),
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5000,
      }),
      this.prisma.verifiedPhone.findMany({
        where: { userId },
        select: { phone: true, verifiedAt: true },
      }),
      this.prisma.notificationPreference.findUnique({
        where: { userId },
        select: { push: true, email: true, sms: true },
      }),
    ]);
    const exportedAt = new Date();
    return {
      filename: `helacart-data-${exportedAt.toISOString().slice(0, 10)}.json`,
      body: Buffer.from(
        JSON.stringify(
          {
            exportedAt,
            profile,
            verifiedPhones,
            notificationPreferences: preferences ?? {
              push: true,
              email: true,
              sms: true,
            },
            addresses,
            orders,
            returns,
            reviews: { shops: shopReviews, products: productReviews },
            favorites,
            supportCases,
            notifications,
          },
          null,
          2,
        ),
      ),
    };
  }

  async deleteAccount(identity: DecodedIdToken) {
    const user = await this.auth.getOrCreateProfile(identity);
    const userId = user.id;
    const removed = await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId}::uuid FOR UPDATE`;
        const [openOrders, openReturns, ownedShops] = await Promise.all([
          tx.sellerOrder.count({
            where: {
              order: { buyerId: userId },
              status: { in: [...openSellerOrderStatuses] },
            },
          }),
          tx.returnRequest.count({
            where: { buyerId: userId, status: { in: ['PENDING', 'APPROVED'] } },
          }),
          tx.sellerMember.count({
            where: {
              userId,
              role: 'OWNER',
              seller: { status: { not: 'REJECTED' } },
            },
          }),
        ]);
        if (openOrders || openReturns)
          throw apiError(
            409,
            'ACCOUNT_HAS_OPEN_ORDERS',
            'Finish or cancel your open orders and returns before deleting your account',
          );
        if (ownedShops)
          throw apiError(
            409,
            'ACCOUNT_OWNS_SHOP',
            'Transfer or close your shop with HelaCart support before deleting your account',
          );
        const current = await tx.user.findUniqueOrThrow({
          where: { id: userId },
          select: {
            firebaseUid: true,
            avatarStorageKey: true,
            accessVersion: true,
          },
        });
        const version = current.accessVersion + 1;
        // Order, ledger and review rows stay for accounting; personal data goes.
        await tx.user.update({
          where: { id: userId },
          data: {
            name: null,
            phone: null,
            email: deletedEmail(userId),
            emailVerified: false,
            avatarStorageKey: null,
            avatarContentType: null,
            avatarByteSize: null,
            photoVersion: { increment: 1 },
            accessStatus: 'DELETED',
            accessVersion: version,
          },
        });
        await tx.accountAccessChange.create({
          data: {
            userId,
            actorId: userId,
            version,
            status: 'DELETED',
            reason: 'Account deleted at the request of its owner',
          },
        });
        await tx.buyerAddress.updateMany({
          where: { userId },
          data: {
            isActive: false,
            isDefault: false,
            recipient: 'Deleted',
            phone: '',
            line1: '',
            line2: null,
            city: '',
            district: '',
            postalCode: '',
          },
        });
        const managerships = await tx.sellerMember.findMany({
          where: { userId, role: 'MANAGER' },
          select: { id: true, sellerId: true },
        });
        for (const membership of managerships) {
          await tx.sellerMember.delete({ where: { id: membership.id } });
          await tx.sellerTeamChange.create({
            data: {
              sellerId: membership.sellerId,
              actorId: userId,
              memberUserId: userId,
              action: 'REMOVED',
              reason: 'Team member deleted their HelaCart account',
            },
          });
        }
        await tx.deviceToken.deleteMany({ where: { userId } });
        await tx.cartItem.deleteMany({ where: { userId } });
        await tx.productFavorite.deleteMany({ where: { userId } });
        await tx.verifiedPhone.deleteMany({ where: { userId } });
        await tx.phoneVerification.deleteMany({ where: { userId } });
        await tx.notificationPreference.deleteMany({ where: { userId } });
        await tx.notificationDelivery.updateMany({
          where: { userId, status: 'PENDING' },
          data: { status: 'SKIPPED', lastError: 'Account deleted' },
        });
        return current;
      },
      { timeout: 30_000, maxWait: 10_000 },
    );
    if (removed.avatarStorageKey)
      await this.photos
        .remove(removed.avatarStorageKey)
        .catch((error: unknown) =>
          this.logger.warn(
            `Deleted account photo needs storage cleanup: ${describeError(error)}`,
          ),
        );
    try {
      await this.firebase.deleteUser(removed.firebaseUid);
    } catch (error) {
      // Access is already blocked by accessStatus=DELETED; retry from the runbook.
      this.logger.error(
        `Firebase user for deleted account ${userId} could not be removed: ${describeError(error)}`,
      );
    }
  }
}
