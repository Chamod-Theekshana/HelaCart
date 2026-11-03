import type { ConfigService } from '@nestjs/config';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { AuthService } from '../auth/auth.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { CommissionReceiptsService } from './commission-receipts.service.js';
import { CommissionService } from './commission.service.js';

describe('Order commission holds', () => {
  function fixture() {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 'shop' }]),
      commissionCharge: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'charge-a',
          sellerId: 'shop',
          sellerOrderId: 'order',
        }),
        findMany: vi.fn().mockResolvedValue([
          { id: 'charge-a', holds: [{ version: 2 }] },
          { id: 'charge-b', holds: [{ version: 2 }] },
        ]),
      },
      commissionHoldEvent: {
        findFirst: vi.fn().mockResolvedValue({ version: 2, held: true }),
        createMany: vi.fn(),
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValue({ chargeId: 'charge-a', version: 3 }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (fn: (db: typeof tx) => unknown) => fn(tx)),
    };
    const notifications = { forSeller: vi.fn() };
    const service = new CommissionService(
      prisma as unknown as PrismaService,
      {
        getOrCreateProfile: vi.fn().mockResolvedValue({ id: 'owner' }),
      } as unknown as AuthService,
      {} as CommissionReceiptsService,
      notifications as unknown as NotificationsService,
      {} as ConfigService,
    );
    return { tx, prisma, notifications, service };
  }
  it('releases all mixed-rate items atomically and preserves each audit version', async () => {
    const { tx, prisma, notifications, service } = fixture();
    await service.hold('charge-a', {} as DecodedIdToken, {
      version: 2,
      held: false,
      reason: 'Dispute settled with buyer after review',
    });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(tx.commissionCharge.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sellerOrderId: 'order' } }),
    );
    expect(tx.commissionHoldEvent.createMany).toHaveBeenCalledOnce();
    expect(tx.commissionHoldEvent.createMany).toHaveBeenCalledWith({
      data: ['charge-a', 'charge-b'].map((chargeId) =>
        expect.objectContaining({
          chargeId,
          version: 3,
          held: false,
          actorId: 'owner',
        }),
      ),
    });
    expect(notifications.forSeller).toHaveBeenCalledOnce();
  });
  it('rejects stale decisions before touching any sibling item', async () => {
    const { tx, service } = fixture();
    await expect(
      service.hold('charge-a', {} as DecodedIdToken, {
        version: 1,
        held: false,
        reason: 'Stale dispute decision must be rejected',
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.commissionHoldEvent.createMany).not.toHaveBeenCalled();
    expect(tx.commissionCharge.findMany).not.toHaveBeenCalled();
  });
});
