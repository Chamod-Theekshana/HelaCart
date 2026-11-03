import {
  adminOrderActions,
  allowedSources,
  attentionPlacedCutoff,
  autoCancelCutoff,
  canTransition,
  reasonRequired,
  restoresStock,
  statusMessage,
} from './order-state.js';

describe('Seller order state machine', () => {
  it.each([
    ['PLACED', 'ACCEPTED', 'SELLER'],
    ['ACCEPTED', 'PACKED', 'SELLER'],
    ['PACKED', 'SHIPPED', 'SELLER'],
    ['DELIVERY_FAILED', 'SHIPPED', 'SELLER'],
    ['SHIPPED', 'DELIVERED', 'SELLER'],
    ['SHIPPED', 'DELIVERED', 'BUYER'],
    ['SHIPPED', 'DELIVERED', 'ADMIN'],
    ['DELIVERY_FAILED', 'DELIVERED', 'ADMIN'],
    ['SHIPPED', 'DELIVERY_FAILED', 'SELLER'],
    ['SHIPPED', 'DELIVERY_FAILED', 'ADMIN'],
    ['DELIVERY_FAILED', 'RETURNED_TO_SELLER', 'SELLER'],
    ['DELIVERY_FAILED', 'RETURNED_TO_SELLER', 'ADMIN'],
    ['SHIPPED', 'RETURNED_TO_SELLER', 'ADMIN'],
    ['PLACED', 'CANCELLED', 'SELLER'],
    ['PLACED', 'CANCELLED', 'BUYER'],
    ['SHIPPED', 'CANCELLED', 'ADMIN'],
    ['DELIVERY_FAILED', 'CANCELLED', 'ADMIN'],
    ['PLACED', 'CANCELLED', 'SYSTEM'],
  ] as const)('allows %s -> %s by %s', (from, to, actor) => {
    expect(canTransition(from, to, actor)).toBe(true);
  });

  it.each([
    ['SHIPPED', 'CANCELLED', 'SELLER'],
    ['SHIPPED', 'CANCELLED', 'BUYER'],
    ['ACCEPTED', 'CANCELLED', 'BUYER'],
    ['PACKED', 'CANCELLED', 'BUYER'],
    ['DELIVERY_FAILED', 'DELIVERED', 'SELLER'],
    ['DELIVERY_FAILED', 'DELIVERED', 'BUYER'],
    ['PLACED', 'DELIVERED', 'BUYER'],
    ['SHIPPED', 'RETURNED_TO_SELLER', 'SELLER'],
    ['DELIVERY_FAILED', 'DELIVERY_FAILED', 'ADMIN'],
    ['ACCEPTED', 'CANCELLED', 'SYSTEM'],
    ['DELIVERED', 'CANCELLED', 'ADMIN'],
    ['CANCELLED', 'ACCEPTED', 'SELLER'],
    ['RETURNED_TO_SELLER', 'SHIPPED', 'SELLER'],
    ['PLACED', 'SHIPPED', 'SELLER'],
  ] as const)('rejects %s -> %s by %s', (from, to, actor) => {
    expect(canTransition(from, to, actor)).toBe(false);
  });

  it('matches the admin action table of the contract', () => {
    expect(allowedSources(adminOrderActions.CANCEL, 'ADMIN')).toEqual([
      'PLACED',
      'ACCEPTED',
      'PACKED',
      'SHIPPED',
      'DELIVERY_FAILED',
    ]);
    expect(
      allowedSources(adminOrderActions.MARK_DELIVERY_FAILED, 'ADMIN'),
    ).toEqual(['SHIPPED']);
    expect(allowedSources(adminOrderActions.MARK_RETURNED, 'ADMIN')).toEqual([
      'DELIVERY_FAILED',
      'SHIPPED',
    ]);
    expect(allowedSources(adminOrderActions.MARK_DELIVERED, 'ADMIN')).toEqual([
      'SHIPPED',
      'DELIVERY_FAILED',
    ]);
  });

  it('restores stock only for cancellations and returns, and requires reasons for failures', () => {
    expect(restoresStock('CANCELLED')).toBe(true);
    expect(restoresStock('RETURNED_TO_SELLER')).toBe(true);
    expect(restoresStock('DELIVERY_FAILED')).toBe(false);
    expect(restoresStock('DELIVERED')).toBe(false);
    expect(reasonRequired('CANCELLED')).toBe(true);
    expect(reasonRequired('DELIVERY_FAILED')).toBe(true);
    expect(reasonRequired('RETURNED_TO_SELLER')).toBe(true);
    expect(reasonRequired('SHIPPED')).toBe(false);
  });

  it('computes auto-cancel and attention cut-offs from the accept window', () => {
    const now = new Date('2026-11-10T12:00:00.000Z');
    expect(autoCancelCutoff(now, 48).toISOString()).toBe(
      '2026-11-08T12:00:00.000Z',
    );
    expect(attentionPlacedCutoff(now, 48).toISOString()).toBe(
      '2026-11-08T18:00:00.000Z',
    );
  });

  it('writes readable notification text including the reason', () => {
    expect(
      statusMessage('DELIVERY_FAILED', 'BUYER', 'ABC', 'Customer unreachable'),
    ).toBe('Delivery of your seller order failed: Customer unreachable');
    expect(statusMessage('RETURNED_TO_SELLER', 'SELLER', 'ABC')).toBe(
      'Order ABC was returned to the shop',
    );
  });
});
