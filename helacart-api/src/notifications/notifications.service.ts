import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { NotificationType, Prisma } from '../generated/prisma/client.js';
import { AuthService } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { channelsFor, type NotificationAudience } from './channel-matrix.js';

export type NotifyOptions = {
  /** Recipient role for the default channel matrix (defaults to BUYER). */
  audience?: NotificationAudience;
  /** New seller-order status, which decides SMS for buyer order updates. */
  orderStatus?: string;
};
type CreatedNotification = {
  id: string;
  userId: string;
  type: NotificationType;
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async forUser(
    tx: Prisma.TransactionClient,
    userId: string,
    type: NotificationType,
    subjectId: string,
    message: string,
    href?: string,
    options: NotifyOptions = {},
  ) {
    href ??= type.startsWith('COMMISSION_')
      ? type === 'COMMISSION_SUBMITTED'
        ? '/admin/commission'
        : '/seller/commission'
      : type.startsWith('RETURN_')
        ? '/account/returns'
        : undefined;
    const notification = await tx.notification.create({
      data: { userId, type, subjectId, message, ...(href ? { href } : {}) },
    });
    await this.enqueue(
      tx,
      [notification],
      options.audience ?? 'BUYER',
      options.orderStatus,
    );
    return notification;
  }

  /**
   * Creates in-app notifications and queues their email/SMS/push deliveries in
   * the same transaction (outbox), so a rolled-back change never notifies.
   */
  async createMany(
    tx: Prisma.TransactionClient,
    rows: Prisma.NotificationCreateManyInput[],
    options: NotifyOptions = {},
  ) {
    if (!rows.length) return [];
    const created = await tx.notification.createManyAndReturn({
      data: rows,
      select: { id: true, userId: true, type: true },
    });
    await this.enqueue(
      tx,
      created,
      options.audience ?? 'BUYER',
      options.orderStatus,
    );
    return created;
  }

  private async enqueue(
    tx: Prisma.TransactionClient,
    notifications: CreatedNotification[],
    audience: NotificationAudience,
    orderStatus?: string,
  ) {
    const data = notifications.flatMap((notification) =>
      channelsFor(notification.type, audience, orderStatus).map((channel) => ({
        notificationId: notification.id,
        userId: notification.userId,
        channel,
      })),
    );
    if (data.length)
      await tx.notificationDelivery.createMany({
        data,
        skipDuplicates: true,
      });
  }

  async forSeller(
    tx: Prisma.TransactionClient,
    sellerId: string,
    type: NotificationType,
    subjectId: string,
    message: string,
    href?: string,
  ) {
    href ??= type.startsWith('COMMISSION_')
      ? '/seller/commission'
      : type.startsWith('RETURN_')
        ? '/seller/orders'
        : undefined;
    const members = await tx.sellerMember.findMany({
      where: { sellerId },
      select: { userId: true },
    });
    await this.createMany(
      tx,
      members.map(({ userId }) => ({
        userId,
        type,
        subjectId,
        message,
        ...(href ? { href } : {}),
      })),
      { audience: 'SELLER' },
    );
  }
  async forSellerOrders(
    tx: Prisma.TransactionClient,
    orders: { id: string; sellerId: string }[],
  ) {
    const members = await tx.sellerMember.findMany({
      where: { sellerId: { in: orders.map((o) => o.sellerId) } },
      select: { sellerId: true, userId: true },
    });
    await this.createMany(
      tx,
      members.map((member) => {
        const order = orders.find((o) => o.sellerId === member.sellerId)!;
        return {
          userId: member.userId,
          type: NotificationType.ORDER_PLACED,
          subjectId: order.id,
          message: 'A new COD order needs fulfillment',
          href: `/seller/orders?order=${order.id}`,
        };
      }),
      { audience: 'SELLER' },
    );
  }
  async forAdmins(
    tx: Prisma.TransactionClient,
    type: NotificationType,
    subjectId: string,
    message: string,
    href: string,
  ) {
    const uids = this.config?.get<string[]>('ADMIN_FIREBASE_UIDS') ?? [];
    if (!uids.length) return;
    const admins = await tx.user.findMany({
      where: { firebaseUid: { in: uids } },
      select: { id: true },
    });
    await this.createMany(
      tx,
      admins.map((a) => ({
        userId: a.id,
        type,
        subjectId,
        message,
        href,
      })),
      { audience: 'ADMIN' },
    );
  }
  async inbox(identity: DecodedIdToken) {
    const user = await this.auth.getOrCreateProfile(identity);
    return this.prisma.$transaction(
      async (tx) => {
        const [items, unreadCount] = await Promise.all([
          tx.notification.findMany({
            where: { userId: user.id },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 8,
          }),
          tx.notification.count({ where: { userId: user.id, readAt: null } }),
        ]);
        return { items, unreadCount };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async markAllRead(identity: DecodedIdToken) {
    const user = await this.auth.getOrCreateProfile(identity);
    const result = await this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { read: true, count: result.count };
  }

  async list(identity: DecodedIdToken) {
    const user = await this.auth.getOrCreateProfile(identity);
    return this.prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(identity: DecodedIdToken, notificationId: string) {
    const user = await this.auth.getOrCreateProfile(identity);
    const updated = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId: user.id },
      data: { readAt: new Date() },
    });
    if (!updated.count) throw new NotFoundException('Notification not found');
    return { read: true };
  }
}
