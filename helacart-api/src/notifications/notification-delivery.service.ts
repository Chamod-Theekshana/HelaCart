import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  NotificationChannel,
  NotificationDeliveryStatus,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ChannelProvidersService,
  type SendResult,
} from './channel-providers.service.js';
import { nextAttemptDelay } from './channel-matrix.js';
import { normalizeSriLankanMobile } from '../common/phone.js';

type DueDelivery = {
  id: string;
  channel: NotificationChannel;
  attempts: number;
  userId: string;
  notification: {
    id: string;
    type: string;
    message: string;
    href: string | null;
  };
  user: {
    email: string;
    emailVerified: boolean;
    accessStatus: string;
    notificationPreference: {
      push: boolean;
      email: boolean;
      sms: boolean;
    } | null;
    phone: string | null;
    verifiedPhones: { phone: string }[];
    devices: { token: string }[];
    memberships: { seller: { contactPhone: string | null } }[];
  };
};

export type DeliveryOutcome = {
  status: NotificationDeliveryStatus;
  error?: string;
  retry?: boolean;
};

/** Processes the NotificationDelivery outbox (called by the worker). */
@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ChannelProvidersService,
    private readonly config: ConfigService,
  ) {}

  /**
   * `shouldStop` is checked before each send so a slow provider cannot keep a
   * worker tick running past its advisory-lock holder transaction.
   */
  async processDue(limit = 50, shouldStop: () => boolean = () => false) {
    const due = (await this.prisma.notificationDelivery.findMany({
      where: { status: 'PENDING', nextAttemptAt: { lte: new Date() } },
      orderBy: [{ nextAttemptAt: 'asc' }, { id: 'asc' }],
      take: limit,
      select: {
        id: true,
        channel: true,
        attempts: true,
        userId: true,
        notification: {
          select: { id: true, type: true, message: true, href: true },
        },
        user: {
          select: {
            email: true,
            emailVerified: true,
            accessStatus: true,
            phone: true,
            memberships: {
              where: { role: 'OWNER' },
              take: 1,
              select: { seller: { select: { contactPhone: true } } },
            },
            notificationPreference: {
              select: { push: true, email: true, sms: true },
            },
            verifiedPhones: {
              orderBy: { verifiedAt: 'desc' },
              take: 1,
              select: { phone: true },
            },
            devices: {
              orderBy: { updatedAt: 'desc' },
              take: 20,
              select: { token: true },
            },
          },
        },
      },
    })) as DueDelivery[];
    let sent = 0;
    let processed = 0;
    for (const delivery of due) {
      if (shouldStop()) break;
      const outcome = await this.deliver(delivery);
      if (outcome.status === 'SENT') sent++;
      await this.record(delivery, outcome);
      processed++;
    }
    return { processed, sent };
  }

  async deliver(delivery: DueDelivery): Promise<DeliveryOutcome> {
    const { user, notification, channel } = delivery;
    if (user.accessStatus === 'DELETED')
      return { status: 'SKIPPED', error: 'Account deleted' };
    const preference = user.notificationPreference;
    if (
      (channel === 'PUSH' && preference?.push === false) ||
      (channel === 'EMAIL' && preference?.email === false) ||
      (channel === 'SMS' && preference?.sms === false)
    )
      return { status: 'SKIPPED', error: 'Disabled by the recipient' };
    const link = notification.href
      ? `${this.config.get<string>('APP_WEB_BASE_URL') ?? 'https://helacart.lk'}${notification.href}`
      : undefined;
    let result: SendResult;
    if (channel === 'EMAIL') {
      if (!this.providers.emailEnabled)
        return { status: 'SKIPPED', error: 'Email is not configured' };
      if (!user.emailVerified || user.email.endsWith('.invalid'))
        return { status: 'SKIPPED', error: 'No verified email address' };
      result = await this.providers.sendEmail(
        user.email,
        `HelaCart: ${notification.message.slice(0, 90)}`,
        `${notification.message}\n\n${link ? `View details: ${link}\n\n` : ''}You can change notification settings in your HelaCart account.`,
      );
    } else if (channel === 'SMS') {
      if (!this.providers.smsEnabled)
        return { status: 'SKIPPED', error: 'SMS is not configured' };
      // Prefer an OTP-verified number; fall back to the profile number and,
      // for shop owners, the admin-reviewed shop contact number.
      const phone =
        user.verifiedPhones[0]?.phone ??
        normalizeSriLankanMobile(user.phone) ??
        normalizeSriLankanMobile(user.memberships[0]?.seller.contactPhone);
      if (!phone)
        return { status: 'SKIPPED', error: 'No mobile number on file' };
      result = await this.providers.sendSms(
        phone,
        `HelaCart: ${notification.message}`.slice(0, 300),
      );
    } else {
      if (!this.providers.pushEnabled)
        return { status: 'SKIPPED', error: 'Push is disabled' };
      const tokens = user.devices.map((device) => device.token);
      if (!tokens.length)
        return { status: 'SKIPPED', error: 'No registered devices' };
      const push = await this.providers.sendPush(tokens, {
        title: 'HelaCart',
        body: notification.message.slice(0, 240),
        data: {
          notificationId: notification.id,
          type: notification.type,
          href: notification.href ?? '',
        },
      });
      if (push.invalidTokens.length)
        await this.prisma.deviceToken.deleteMany({
          where: { token: { in: push.invalidTokens } },
        });
      result = push;
    }
    if (result.ok) return { status: 'SENT' };
    return { status: 'FAILED', error: result.error, retry: result.retryable };
  }

  private async record(delivery: DueDelivery, outcome: DeliveryOutcome) {
    const attempts = delivery.attempts + 1;
    const delay =
      outcome.status === 'FAILED' && outcome.retry
        ? nextAttemptDelay(attempts)
        : null;
    const status: NotificationDeliveryStatus =
      delay !== null ? 'PENDING' : outcome.status;
    if (outcome.status === 'FAILED' && delay === null)
      this.logger.warn(
        `Notification delivery ${delivery.id} (${delivery.channel}) failed permanently: ${outcome.error ?? 'unknown error'}`,
      );
    await this.prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status,
        attempts,
        lastError: outcome.error?.slice(0, 500) ?? null,
        ...(outcome.status === 'SENT' ? { sentAt: new Date() } : {}),
        ...(delay !== null
          ? { nextAttemptAt: new Date(Date.now() + delay) }
          : {}),
      },
    });
  }
}
