import type { ExecutionContext } from '@nestjs/common';
import { RequestLimitGuard } from './request-limit.guard.js';

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
});
