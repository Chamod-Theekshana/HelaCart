import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { ChannelProvidersService } from './channel-providers.service.js';
import { NotificationDeliveryService } from './notification-delivery.service.js';

describe('Notification delivery worker step', () => {
  const prisma = {
    notificationDelivery: { findMany: vi.fn(), update: vi.fn() },
    deviceToken: { deleteMany: vi.fn() },
  };
  const providers = {
    emailEnabled: true,
    smsEnabled: true,
    pushEnabled: true,
    sendEmail: vi.fn(),
    sendSms: vi.fn(),
    sendPush: vi.fn(),
  };
  const service = new NotificationDeliveryService(
    prisma as unknown as PrismaService,
    providers as unknown as ChannelProvidersService,
    {
      get: () => 'https://helacart.lk',
    } as unknown as ConfigService,
  );
  const delivery = (
    channel: 'PUSH' | 'EMAIL' | 'SMS',
    user: Record<string, unknown> = {},
    attempts = 0,
  ) => ({
    id: `delivery-${channel}`,
    channel,
    attempts,
    userId: 'user-1',
    notification: {
      id: 'notice-1',
      type: 'ORDER_UPDATED',
      message: 'Your seller order is shipped',
      href: '/orders?order=o-1',
    },
    user: {
      email: 'buyer@example.com',
      emailVerified: true,
      accessStatus: 'ACTIVE',
      phone: null,
      notificationPreference: null,
      verifiedPhones: [{ phone: '+94771234567' }],
      devices: [{ token: 'token-a' }, { token: 'token-b' }],
      memberships: [],
      ...user,
    },
  });

  beforeEach(() => {
    vi.resetAllMocks();
    providers.emailEnabled = true;
    providers.smsEnabled = true;
    providers.pushEnabled = true;
    providers.sendEmail.mockResolvedValue({ ok: true });
    providers.sendSms.mockResolvedValue({ ok: true });
  });

  it('sends email with a full link and records success', async () => {
    prisma.notificationDelivery.findMany.mockResolvedValue([delivery('EMAIL')]);
    expect(await service.processDue()).toEqual({ processed: 1, sent: 1 });
    expect(providers.sendEmail).toHaveBeenCalledWith(
      'buyer@example.com',
      expect.stringContaining('shipped'),
      expect.stringContaining('https://helacart.lk/orders?order=o-1'),
    );
    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-EMAIL' },
      data: expect.objectContaining({
        status: 'SENT',
        attempts: 1,
        sentAt: expect.any(Date),
      }),
    });
  });

  it('honours channel preferences and skips deleted accounts', async () => {
    expect(
      await service.deliver(
        delivery('SMS', {
          notificationPreference: { push: true, email: true, sms: false },
        }) as never,
      ),
    ).toMatchObject({ status: 'SKIPPED' });
    expect(
      await service.deliver(
        delivery('EMAIL', { accessStatus: 'DELETED' }) as never,
      ),
    ).toMatchObject({ status: 'SKIPPED' });
    expect(providers.sendSms).not.toHaveBeenCalled();
    expect(providers.sendEmail).not.toHaveBeenCalled();
  });

  it('falls back to the shop contact number for seller SMS', async () => {
    await service.deliver(
      delivery('SMS', {
        verifiedPhones: [],
        memberships: [{ seller: { contactPhone: '0779876543' } }],
      }) as never,
    );
    expect(providers.sendSms).toHaveBeenCalledWith(
      '+94779876543',
      expect.stringContaining('HelaCart:'),
    );
  });

  it('removes device tokens FCM reports as invalid', async () => {
    providers.sendPush.mockResolvedValue({
      ok: true,
      invalidTokens: ['token-b'],
    });
    const result = await service.deliver(delivery('PUSH') as never);
    expect(result.status).toBe('SENT');
    expect(providers.sendPush).toHaveBeenCalledWith(
      ['token-a', 'token-b'],
      expect.objectContaining({
        data: {
          notificationId: 'notice-1',
          type: 'ORDER_UPDATED',
          href: '/orders?order=o-1',
        },
      }),
    );
    expect(prisma.deviceToken.deleteMany).toHaveBeenCalledWith({
      where: { token: { in: ['token-b'] } },
    });
  });

  it('retries retryable failures with back-off and fails after the last attempt', async () => {
    providers.sendEmail.mockResolvedValue({
      ok: false,
      retryable: true,
      error: 'Resend responded 503',
    });
    prisma.notificationDelivery.findMany.mockResolvedValue([
      delivery('EMAIL', {}, 0),
    ]);
    await service.processDue();
    expect(prisma.notificationDelivery.update).toHaveBeenLastCalledWith({
      where: { id: 'delivery-EMAIL' },
      data: expect.objectContaining({
        status: 'PENDING',
        attempts: 1,
        nextAttemptAt: expect.any(Date),
        lastError: 'Resend responded 503',
      }),
    });
    prisma.notificationDelivery.findMany.mockResolvedValue([
      delivery('EMAIL', {}, 4),
    ]);
    await service.processDue();
    expect(prisma.notificationDelivery.update).toHaveBeenLastCalledWith({
      where: { id: 'delivery-EMAIL' },
      data: expect.objectContaining({ status: 'FAILED', attempts: 5 }),
    });
  });

  it('skips channels whose provider is not configured', async () => {
    providers.smsEnabled = false;
    expect(await service.deliver(delivery('SMS') as never)).toMatchObject({
      status: 'SKIPPED',
      error: 'SMS is not configured',
    });
  });
});
