import type { ExecutionContext } from '@nestjs/common';
import { RequestLimitGuard } from './request-limit.guard.js';

describe('Request limit guard', () => {
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
