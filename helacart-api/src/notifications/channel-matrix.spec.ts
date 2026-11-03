import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuthService } from '../auth/auth.service.js';
import { channelsFor, nextAttemptDelay } from './channel-matrix.js';
import { NotificationsService } from './notifications.service.js';

describe('Notification channel matrix', () => {
  it.each([
    ['ORDER_PLACED', 'SELLER', undefined, ['PUSH', 'EMAIL', 'SMS']],
    ['ORDER_PLACED', 'BUYER', undefined, ['PUSH']],
    ['ORDER_UPDATED', 'BUYER', 'SHIPPED', ['PUSH', 'EMAIL', 'SMS']],
    ['ORDER_UPDATED', 'BUYER', 'DELIVERY_FAILED', ['PUSH', 'EMAIL', 'SMS']],
    ['ORDER_UPDATED', 'BUYER', 'CANCELLED', ['PUSH', 'EMAIL', 'SMS']],
    ['ORDER_UPDATED', 'BUYER', 'ACCEPTED', ['PUSH', 'EMAIL']],
    ['ORDER_UPDATED', 'BUYER', 'DELIVERED', ['PUSH', 'EMAIL']],
    ['ORDER_TRACKING_UPDATED', 'BUYER', undefined, ['PUSH', 'EMAIL']],
    ['ORDER_UPDATED', 'SELLER', 'CANCELLED', ['PUSH']],
    ['RETURN_REQUESTED', 'SELLER', undefined, ['PUSH', 'EMAIL']],
    ['RETURN_REVIEWED', 'BUYER', undefined, ['PUSH', 'EMAIL']],
    ['REFUND_UPDATED', 'BUYER', undefined, ['PUSH', 'EMAIL']],
    ['SUPPORT_UPDATED', 'ADMIN', undefined, ['PUSH', 'EMAIL']],
    ['SELLER_STATUS_CHANGED', 'SELLER', undefined, ['PUSH', 'EMAIL']],
    ['STOCK_LOW', 'SELLER', undefined, ['PUSH']],
    ['FAVORITE_PRICE_DROP', 'BUYER', undefined, ['PUSH']],
    ['COMMISSION_REMINDER', 'SELLER', undefined, ['PUSH']],
  ] as const)('%s to %s (%s)', (type, audience, status, expected) => {
    expect(channelsFor(type, audience, status)).toEqual(expected);
  });

  it('backs off retries and gives up after five attempts', () => {
    expect(nextAttemptDelay(1)).toBe(60_000);
    expect(nextAttemptDelay(2)).toBe(300_000);
    expect(nextAttemptDelay(4)).toBe(3_600_000);
    expect(nextAttemptDelay(5)).toBeNull();
  });

  it('queues outbox deliveries in the same transaction as the notification', async () => {
    const tx = {
      notification: {
        create: vi.fn().mockResolvedValue({
          id: 'notice-1',
          userId: 'buyer-1',
          type: 'ORDER_UPDATED',
        }),
        createManyAndReturn: vi.fn().mockResolvedValue([
          { id: 'notice-2', userId: 'member-1', type: 'ORDER_PLACED' },
          { id: 'notice-3', userId: 'member-2', type: 'ORDER_PLACED' },
        ]),
      },
      sellerMember: {
        findMany: vi.fn().mockResolvedValue([
          { userId: 'member-1', sellerId: 'shop-1' },
          { userId: 'member-2', sellerId: 'shop-1' },
        ]),
      },
      notificationDelivery: { createMany: vi.fn() },
    };
    const service = new NotificationsService(
      {} as PrismaService,
      {} as AuthService,
    );
    await service.forUser(
      tx as never,
      'buyer-1',
      'ORDER_UPDATED',
      'so-1',
      'Shipped',
      '/orders?order=o-1',
      { audience: 'BUYER', orderStatus: 'SHIPPED' },
    );
    expect(tx.notificationDelivery.createMany).toHaveBeenLastCalledWith({
      data: ['PUSH', 'EMAIL', 'SMS'].map((channel) => ({
        notificationId: 'notice-1',
        userId: 'buyer-1',
        channel,
      })),
      skipDuplicates: true,
    });
    await service.forSellerOrders(tx as never, [
      { id: 'so-1', sellerId: 'shop-1' },
    ]);
    expect(tx.notificationDelivery.createMany).toHaveBeenLastCalledWith({
      data: expect.arrayContaining([
        { notificationId: 'notice-2', userId: 'member-1', channel: 'SMS' },
        { notificationId: 'notice-3', userId: 'member-2', channel: 'EMAIL' },
      ]),
      skipDuplicates: true,
    });
    expect(
      tx.notificationDelivery.createMany.mock.calls[1][0].data,
    ).toHaveLength(6);
  });
});
