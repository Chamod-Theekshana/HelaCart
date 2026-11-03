import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AccountAccessService } from './account-access.service.js';
import { FirebaseAuthGuard } from './firebase-auth.guard.js';
describe('Account access and revocation enforcement', () => {
  it.each([null, { accessStatus: 'ACTIVE' }])(
    'allows new and active accounts %j',
    async (row) => {
      const db = { user: { findUnique: vi.fn().mockResolvedValue(row) } };
      await expect(
        new AccountAccessService(db as never).assertActive('verified-uid'),
      ).resolves.toBeUndefined();
      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { firebaseUid: 'verified-uid' },
        select: { accessStatus: true },
      });
    },
  );
  it('blocks suspended accounts independently of token claims', async () => {
    await expect(
      new AccountAccessService({
        user: { findUnique: async () => ({ accessStatus: 'SUSPENDED' }) },
      } as never).assertActive('uid'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('fails closed if account status cannot be checked', async () => {
    await expect(
      new AccountAccessService({
        user: {
          findUnique: async () => {
            throw Error('Database unavailable');
          },
        },
      } as never).assertActive('uid'),
    ).rejects.toThrow('Database unavailable');
  });
  const context = (authorization?: string) => ({
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization } }),
    }),
  });
  it('checks revoked sessions for regular authenticated routes', async () => {
    const firebase = {
        verifyIdToken: vi.fn().mockResolvedValue({ uid: 'uid' }),
      },
      access = { assertActive: vi.fn() };
    await expect(
      new FirebaseAuthGuard(firebase as never, access as never).canActivate(
        context('Bearer token') as never,
      ),
    ).resolves.toBe(true);
    expect(firebase.verifyIdToken).toHaveBeenCalledWith('token', true);
    expect(access.assertActive).toHaveBeenCalledWith('uid');
  });
  it('preserves a suspension response as forbidden rather than invalid token', async () => {
    const guard = new FirebaseAuthGuard(
      { verifyIdToken: async () => ({ uid: 'uid' }) } as never,
      {
        assertActive: async () => {
          throw new ForbiddenException('Suspended');
        },
      } as never,
    );
    await expect(
      guard.canActivate(context('Bearer token') as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('rejects revoked tokens before querying account permissions', async () => {
    const access = { assertActive: vi.fn() },
      guard = new FirebaseAuthGuard(
        {
          verifyIdToken: async () => {
            throw Error('revoked');
          },
        } as never,
        access as never,
      );
    await expect(
      guard.canActivate(context('Bearer token') as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(access.assertActive).not.toHaveBeenCalled();
  });
});
