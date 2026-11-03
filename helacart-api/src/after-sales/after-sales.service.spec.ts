import type { DecodedIdToken } from 'firebase-admin/auth';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuthService } from '../auth/auth.service.js';
import type { CatalogService } from '../catalog/catalog.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import { AfterSalesService } from './after-sales.service.js';
describe('Support retries preserve workspace authorization', () => {
  it.each([
    { role: 'BUYER' as const },
    { role: 'SELLER' as const, sellerId: 'new-shop' },
  ])(
    'does not return an earlier case through another workspace %j',
    async (scope) => {
      const dto = {
        requestKey: 'key',
        title: 'Original support case',
        category: 'OTHER',
        body: 'The original support question',
      };
      const tx = {
        $queryRaw: vi.fn(),
        supportCase: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'old-case',
            sellerId: 'old-shop',
            buyerId: 'other-buyer',
            title: dto.title,
            category: dto.category,
            sellerOrderId: null,
            messages: [{ body: dto.body }],
          }),
        },
      };
      const prisma = {
          $transaction: async (fn: (db: typeof tx) => unknown) => fn(tx),
        },
        auth = { getOrCreateProfile: async () => ({ id: 'same-user' }) },
        catalog = { requireSellerMember: async () => ({ id: 'same-user' }) };
      const service = new AfterSalesService(
        prisma as unknown as PrismaService,
        auth as unknown as AuthService,
        catalog as unknown as CatalogService,
        {} as NotificationsService,
        {} as ConfigService,
      );
      await expect(
        service.createCase(
          { uid: 'same-user', email_verified: true } as DecodedIdToken,
          scope,
          dto,
        ),
      ).rejects.toMatchObject({ status: 404 });
      expect(tx.supportCase.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { messages: { where: { requestKey: 'key' }, take: 1 } },
        }),
      );
    },
  );
});
