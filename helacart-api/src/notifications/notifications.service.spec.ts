import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuthService } from '../auth/auth.service.js';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { NotificationsService } from './notifications.service.js';
describe('Notification inbox ownership', () => {
  const identity = { uid: 'buyer' } as DecodedIdToken;
  it('counts all unread records while returning a small ordered inbox', async () => {
    const tx = {
      notification: {
        findMany: vi.fn().mockResolvedValue([{ id: 'notice' }]),
        count: vi.fn().mockResolvedValue(57),
      },
    };
    const prisma = {
      $transaction: async (fn: (db: typeof tx) => unknown) => fn(tx),
    };
    const service = new NotificationsService(
      prisma as unknown as PrismaService,
      {
        getOrCreateProfile: async () => ({ id: 'user-a' }),
      } as unknown as AuthService,
    );
    expect(await service.inbox(identity)).toEqual({
      items: [{ id: 'notice' }],
      unreadCount: 57,
    });
    expect(tx.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-a' }, take: 8 }),
    );
    expect(tx.notification.count).toHaveBeenCalledWith({
      where: { userId: 'user-a', readAt: null },
    });
  });
  it('marks only this account’s unread records', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 7 });
    const service = new NotificationsService(
      { notification: { updateMany } } as unknown as PrismaService,
      {
        getOrCreateProfile: async () => ({ id: 'user-a' }),
      } as unknown as AuthService,
    );
    expect(await service.markAllRead(identity)).toEqual({
      read: true,
      count: 7,
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-a', readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });
});
