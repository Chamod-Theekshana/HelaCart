import { Injectable, NotFoundException } from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { NotificationType, Prisma } from '../generated/prisma/client.js';
import { AuthService } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async forUser(
    tx: Prisma.TransactionClient,
    userId: string,
    type: NotificationType,
    subjectId: string,
    message: string,
  ) {
    return tx.notification.create({
      data: { userId, type, subjectId, message },
    });
  }

  async forSeller(
    tx: Prisma.TransactionClient,
    sellerId: string,
    type: NotificationType,
    subjectId: string,
    message: string,
  ) {
    const members = await tx.sellerMember.findMany({
      where: { sellerId },
      select: { userId: true },
    });
    if (members.length)
      await tx.notification.createMany({
        data: members.map(({ userId }) => ({
          userId,
          type,
          subjectId,
          message,
        })),
      });
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
