import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { bearerSubjectKey, RequestLimitGuard } from './request-limit.guard.js';

const jwt = (sub: string) =>
  `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(
    JSON.stringify({ sub }),
  ).toString('base64url')}.signature`;
const request = (overrides: Record<string, unknown>) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        ip: '198.51.100.7',
        path: '/api/v1/me/orders/checkout',
        method: 'POST',
        headers: {},
        ...overrides,
      }),
    }),
  }) as unknown as ExecutionContext;
const configured = (values: Record<string, unknown>) =>
  new RequestLimitGuard({
    get: (key: string) => values[key],
  } as unknown as ConfigService);

describe('Request limit guard', () => {
  it('limits support and refund writes in their own window', () => {
    const guard = new RequestLimitGuard();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          ip: '192.0.2.11',
          path: '/api/v1/me/after-sales/support',
          method: 'POST',
        }),
      }),
    } as unknown as ExecutionContext;
    for (let n = 0; n < 20; n++) expect(guard.canActivate(context)).toBe(true);
    expect(() => guard.canActivate(context)).toThrow('Too many requests');
  });
  it('limits repeated write attempts while leaving liveness accessible', () => {
    const guard = new RequestLimitGuard();
    const context = (path: string) =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({ ip: '192.0.2.42', path, method: 'POST' }),
        }),
      }) as unknown as ExecutionContext;
    const checkout = context('/api/v1/me/orders/checkout');
    for (let i = 0; i < 20; i++) expect(guard.canActivate(checkout)).toBe(true);
    expect(() => guard.canActivate(checkout)).toThrow('Too many requests');
    expect(guard.canActivate(context('/api/v1/health'))).toBe(true);
  });
  it('buckets authenticated writes per token subject behind one NAT address', () => {
    const guard = new RequestLimitGuard();
    for (const buyer of ['buyer-a', 'buyer-b', 'buyer-c']) {
      const context = request({
        headers: { authorization: `Bearer ${jwt(buyer)}` },
      });
      for (let i = 0; i < 20; i++)
        expect(guard.canActivate(context)).toBe(true);
      expect(() => guard.canActivate(context)).toThrow('Too many requests');
    }
  });

  it('keeps a per-IP ceiling of multiplier x limit for authenticated callers', () => {
    const guard = configured({
      RATE_LIMIT_WRITE_PER_MINUTE: 2,
      RATE_LIMIT_AUTHENTICATED_IP_MULTIPLIER: 3,
    });
    let allowed = 0;
    for (let buyer = 0; buyer < 10; buyer++) {
      const context = request({
        headers: { authorization: `Bearer ${jwt(`buyer-${buyer}`)}` },
      });
      try {
        guard.canActivate(context);
        allowed++;
      } catch {
        // Ceiling reached for this address.
      }
    }
    expect(allowed).toBe(6);
  });

  it('lets the storefront server skip only the general bucket with the internal token', () => {
    const token = 't'.repeat(32);
    const guard = configured({
      INTERNAL_API_TOKEN: token,
      RATE_LIMIT_GENERAL_PER_MINUTE: 3,
    });
    const internal = request({
      path: '/api/v1/products',
      method: 'GET',
      headers: { 'x-helacart-internal': token },
    });
    for (let i = 0; i < 10; i++) expect(guard.canActivate(internal)).toBe(true);
    const forged = request({
      path: '/api/v1/products',
      method: 'GET',
      headers: { 'x-helacart-internal': 'wrong' },
    });
    for (let i = 0; i < 3; i++) guard.canActivate(forged);
    expect(() => guard.canActivate(forged)).toThrow('Too many requests');
  });

  it('derives a stable hashed key from the token subject', () => {
    expect(bearerSubjectKey(`Bearer ${jwt('uid-1')}`)).toBe(
      bearerSubjectKey(`Bearer ${jwt('uid-1')}`),
    );
    expect(bearerSubjectKey(`Bearer ${jwt('uid-1')}`)).not.toBe(
      bearerSubjectKey(`Bearer ${jwt('uid-2')}`),
    );
    expect(bearerSubjectKey(`Bearer ${jwt('uid-1')}`)).not.toContain('uid-1');
    expect(bearerSubjectKey('Bearer opaque')).toMatch(/^[0-9a-f]{24}$/);
    expect(bearerSubjectKey(undefined)).toBeUndefined();
  });
});
