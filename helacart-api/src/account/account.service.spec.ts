import type { DecodedIdToken } from 'firebase-admin/auth';
import type { AuthService } from '../auth/auth.service.js';
import type { FirebaseAdminService } from '../auth/firebase-admin.service.js';
import type { ProfilePhotoStorageService } from '../auth/profile-photo-storage.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AccountService, deletedEmail } from './account.service.js';

describe('Account deletion (PDPA)', () => {
  const identity = { uid: 'firebase-uid', email: 'b@x.lk' } as DecodedIdToken;
  const userId = '9b1f6d3e-2f8a-4b6d-8a7c-1e2d3c4b5a69';
  const model = () => ({
    count: vi.fn().mockResolvedValue(0),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  });
  const tx = {
    $queryRaw: vi.fn(),
    sellerOrder: model(),
    returnRequest: model(),
    sellerMember: model(),
    user: model(),
    accountAccessChange: model(),
    buyerAddress: model(),
    sellerTeamChange: model(),
    deviceToken: model(),
    cartItem: model(),
    productFavorite: model(),
    verifiedPhone: model(),
    phoneVerification: model(),
    notificationPreference: model(),
    notificationDelivery: model(),
  };
  const prisma = { $transaction: vi.fn() };
  const firebase = { deleteUser: vi.fn() };
  const photos = { remove: vi.fn() };
  const service = new AccountService(
    prisma as unknown as PrismaService,
    {
      getOrCreateProfile: async () => ({ id: userId }),
    } as unknown as AuthService,
    firebase as unknown as FirebaseAdminService,
    photos as unknown as ProfilePhotoStorageService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    for (const delegate of [tx.sellerOrder, tx.returnRequest, tx.sellerMember])
      delegate.count.mockResolvedValue(0);
    tx.sellerMember.findMany.mockResolvedValue([]);
    tx.user.findUniqueOrThrow.mockResolvedValue({
      firebaseUid: 'firebase-uid',
      avatarStorageKey: 'profile-photos/user/avatar.png',
      accessVersion: 2,
    });
    prisma.$transaction.mockImplementation((fn: (db: typeof tx) => unknown) =>
      fn(tx),
    );
    firebase.deleteUser.mockResolvedValue(undefined);
    photos.remove.mockResolvedValue(undefined);
  });

  it('refuses while seller orders or returns are open', async () => {
    tx.sellerOrder.count.mockResolvedValue(1);
    await expect(service.deleteAccount(identity)).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({ code: 'ACCOUNT_HAS_OPEN_ORDERS' }),
    });
    expect(tx.sellerOrder.count).toHaveBeenCalledWith({
      where: {
        order: { buyerId: userId },
        status: {
          in: ['PLACED', 'ACCEPTED', 'PACKED', 'SHIPPED', 'DELIVERY_FAILED'],
        },
      },
    });
    tx.sellerOrder.count.mockResolvedValue(0);
    tx.returnRequest.count.mockResolvedValue(1);
    await expect(service.deleteAccount(identity)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ACCOUNT_HAS_OPEN_ORDERS' }),
    });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(firebase.deleteUser).not.toHaveBeenCalled();
  });

  it('refuses while the user owns a shop that was not rejected', async () => {
    tx.sellerMember.count.mockResolvedValue(1);
    await expect(service.deleteAccount(identity)).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({ code: 'ACCOUNT_OWNS_SHOP' }),
    });
    expect(tx.sellerMember.count).toHaveBeenCalledWith({
      where: {
        userId,
        role: 'OWNER',
        seller: { status: { not: 'REJECTED' } },
      },
    });
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('anonymises personal data, keeps orders and deletes the Firebase user', async () => {
    tx.sellerMember.findMany.mockResolvedValue([
      { id: 'membership-1', sellerId: 'shop-1' },
    ]);
    await service.deleteAccount(identity);
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: expect.objectContaining({
        name: null,
        phone: null,
        email: deletedEmail(userId),
        avatarStorageKey: null,
        accessStatus: 'DELETED',
        accessVersion: 3,
      }),
    });
    expect(deletedEmail(userId)).toBe(
      `deleted-${userId}@deleted.helacart.invalid`,
    );
    expect(tx.accountAccessChange.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'DELETED', version: 3 }),
    });
    expect(tx.buyerAddress.updateMany).toHaveBeenCalledWith({
      where: { userId },
      data: expect.objectContaining({ isActive: false, phone: '' }),
    });
    expect(tx.sellerMember.delete).toHaveBeenCalledWith({
      where: { id: 'membership-1' },
    });
    for (const delegate of [
      tx.deviceToken,
      tx.cartItem,
      tx.productFavorite,
      tx.verifiedPhone,
    ])
      expect(delegate.deleteMany).toHaveBeenCalledWith({ where: { userId } });
    expect(photos.remove).toHaveBeenCalledWith(
      'profile-photos/user/avatar.png',
    );
    expect(firebase.deleteUser).toHaveBeenCalledWith('firebase-uid');
  });

  it('keeps the account blocked even if Firebase deletion fails', async () => {
    firebase.deleteUser.mockRejectedValue(new Error('network'));
    await expect(service.deleteAccount(identity)).resolves.toBeUndefined();
    expect(tx.user.update).toHaveBeenCalled();
  });
});
