import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import {
  FirebaseAuthGuard,
  isAdminPath,
  VerifiedTokenCache,
  verifiedTokenCache,
} from './firebase-auth.guard.js';
import { AdminGuard } from '../sellers/admin.guard.js';

const context = (request: Record<string, unknown>) =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as never;

describe('Firebase token verification cache', () => {
  const config = (seconds: number) =>
    ({
      get: (key: string) =>
        key === 'AUTH_TOKEN_CACHE_SECONDS' ? seconds : undefined,
    }) as unknown as ConfigService;
  beforeEach(() => verifiedTokenCache.clear());

  it('verifies once with revocation checks and reuses the result', async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const firebase = {
      verifyIdToken: vi.fn().mockResolvedValue({ uid: 'uid-1', exp }),
    };
    const access = { assertActive: vi.fn() };
    const guard = new FirebaseAuthGuard(
      firebase as never,
      access as never,
      config(60),
    );
    for (let i = 0; i < 3; i++) {
      const request = { headers: { authorization: 'Bearer cached-token-1' } };
      await expect(guard.canActivate(context(request))).resolves.toBe(true);
      expect(request).toMatchObject({ user: { uid: 'uid-1' } });
    }
    expect(firebase.verifyIdToken).toHaveBeenCalledOnce();
    expect(firebase.verifyIdToken).toHaveBeenCalledWith('cached-token-1', true);
    // Suspension/deletion is still checked on every request.
    expect(access.assertActive).toHaveBeenCalledTimes(3);
  });

  it('does not cache when disabled or after a failed verification', async () => {
    const firebase = {
      verifyIdToken: vi
        .fn()
        .mockRejectedValueOnce(new Error('revoked'))
        .mockResolvedValue({ uid: 'uid-2', exp: Date.now() / 1000 + 60 }),
    };
    const guard = new FirebaseAuthGuard(
      firebase as never,
      { assertActive: vi.fn() } as never,
      config(60),
    );
    await expect(
      guard.canActivate(
        context({ headers: { authorization: 'Bearer cached-token-2' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await guard.canActivate(
      context({ headers: { authorization: 'Bearer cached-token-2' } }),
    );
    expect(firebase.verifyIdToken).toHaveBeenCalledTimes(2);
    const uncached = new FirebaseAuthGuard(
      firebase as never,
      { assertActive: vi.fn() } as never,
      config(0),
    );
    await uncached.canActivate(
      context({ headers: { authorization: 'Bearer uncached-token' } }),
    );
    await uncached.canActivate(
      context({ headers: { authorization: 'Bearer uncached-token' } }),
    );
    expect(firebase.verifyIdToken).toHaveBeenCalledTimes(4);
  });

  it('expires entries at the token expiry and keys by hash', () => {
    const cache = new VerifiedTokenCache(2);
    const now = 1_000_000;
    cache.set(
      'a',
      { uid: 'a', exp: (now + 10_000) / 1000 } as never,
      60_000,
      now,
    );
    expect(cache.get('a', now + 9_999)).toMatchObject({ uid: 'a' });
    expect(cache.get('a', now + 10_000)).toBeUndefined();
    expect(VerifiedTokenCache.key('a')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('stays bounded by evicting the oldest entries', () => {
    const cache = new VerifiedTokenCache(2);
    const now = 1_000_000;
    const identity = (uid: string) =>
      ({ uid, exp: (now + 600_000) / 1000 }) as never;
    cache.set('a', identity('a'), 60_000, now);
    cache.set('b', identity('b'), 60_000, now);
    cache.set('c', identity('c'), 60_000, now);
    expect(cache.size).toBe(2);
    expect(cache.get('a', now)).toBeUndefined();
    expect(cache.get('c', now)).toMatchObject({ uid: 'c' });
  });
});

describe('Admin path detection', () => {
  it.each([
    ['/api/v1/admin/orders', true],
    ['/api/v1/workspace/admin/summary', true],
    ['/admin', true],
    ['/api/v1/me/orders', false],
    ['/api/v1/administrator', false],
    [undefined, false],
  ])('%s -> %s', (path, expected) => {
    expect(isAdminPath(path)).toBe(expected);
  });
});

describe('Admin guard', () => {
  const guard = new AdminGuard({
    getOrThrow: () => ['admin-uid'],
  } as unknown as ConfigService);

  it('reuses the identity verified by FirebaseAuthGuard', () => {
    expect(
      guard.canActivate(
        context({ user: { uid: 'admin-uid', email_verified: true } }),
      ),
    ).toBe(true);
  });

  it('rejects missing, unverified and non-admin identities', () => {
    expect(() => guard.canActivate(context({}))).toThrow(UnauthorizedException);
    expect(() =>
      guard.canActivate(
        context({ user: { uid: 'admin-uid', email_verified: false } }),
      ),
    ).toThrow(ForbiddenException);
    expect(() =>
      guard.canActivate(
        context({ user: { uid: 'seller', email_verified: true } }),
      ),
    ).toThrow(ForbiddenException);
  });
});
