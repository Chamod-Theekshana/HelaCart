import { Injectable } from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { AuthService } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  NotificationPreferencesDto,
  RegisterDeviceDto,
} from './notification-settings.dto.js';

const maxDevicesPerUser = 20;

@Injectable()
export class NotificationSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  /** Upsert by token: a token moving to another account is reassigned. */
  async registerDevice(identity: DecodedIdToken, dto: RegisterDeviceDto) {
    const user = await this.auth.getOrCreateProfile(identity);
    return this.prisma.$transaction(
      async (tx) => {
        const device = await tx.deviceToken.upsert({
          where: { token: dto.token },
          update: {
            userId: user.id,
            platform: dto.platform,
            appVersion: dto.appVersion ?? null,
          },
          create: {
            userId: user.id,
            token: dto.token,
            platform: dto.platform,
            appVersion: dto.appVersion ?? null,
          },
          select: { id: true },
        });
        const stale = await tx.deviceToken.findMany({
          where: { userId: user.id },
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          skip: maxDevicesPerUser,
          select: { id: true },
        });
        if (stale.length)
          await tx.deviceToken.deleteMany({
            where: { id: { in: stale.map((row) => row.id) } },
          });
        return { id: device.id };
      },
      { timeout: 15_000, maxWait: 10_000 },
    );
  }

  async unregisterDevice(identity: DecodedIdToken, token: string) {
    const user = await this.auth.getOrCreateProfile(identity);
    await this.prisma.deviceToken.deleteMany({
      where: { token, userId: user.id },
    });
  }

  async preferences(identity: DecodedIdToken) {
    const user = await this.auth.getOrCreateProfile(identity);
    const row = await this.prisma.notificationPreference.findUnique({
      where: { userId: user.id },
      select: { push: true, email: true, sms: true },
    });
    return row ?? { push: true, email: true, sms: true };
  }

  async savePreferences(
    identity: DecodedIdToken,
    dto: NotificationPreferencesDto,
  ) {
    const user = await this.auth.getOrCreateProfile(identity);
    const data = { push: dto.push, email: dto.email, sms: dto.sms };
    return this.prisma.notificationPreference.upsert({
      where: { userId: user.id },
      update: data,
      create: { userId: user.id, ...data },
      select: { push: true, email: true, sms: true },
    });
  }
}
