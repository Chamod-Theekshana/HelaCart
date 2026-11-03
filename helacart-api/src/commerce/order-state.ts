import type { SellerOrderStatus } from '../generated/prisma/client.js';

/** S = seller member, B = buyer, A = admin, SYSTEM = background job. */
export type OrderActor = 'SELLER' | 'BUYER' | 'ADMIN' | 'SYSTEM';

/** Seller orders that still need fulfilment or a delivery outcome. */
export const openSellerOrderStatuses = [
  'PLACED',
  'ACCEPTED',
  'PACKED',
  'SHIPPED',
  'DELIVERY_FAILED',
] as const satisfies readonly SellerOrderStatus[];

export const terminalSellerOrderStatuses = [
  'DELIVERED',
  'CANCELLED',
  'RETURNED_TO_SELLER',
] as const satisfies readonly SellerOrderStatus[];

type Table = Partial<
  Record<SellerOrderStatus, Partial<Record<OrderActor, SellerOrderStatus[]>>>
>;

/**
 * target status -> actor -> allowed source statuses (contract §1.1).
 * Keep this the single source of truth for every order transition.
 */
const transitions: Table = {
  ACCEPTED: { SELLER: ['PLACED'] },
  PACKED: { SELLER: ['ACCEPTED'] },
  // A seller re-attempts a failed delivery by shipping again.
  SHIPPED: { SELLER: ['PACKED', 'DELIVERY_FAILED'] },
  DELIVERED: {
    SELLER: ['SHIPPED'],
    BUYER: ['SHIPPED'],
    ADMIN: ['SHIPPED', 'DELIVERY_FAILED'],
  },
  DELIVERY_FAILED: { SELLER: ['SHIPPED'], ADMIN: ['SHIPPED'] },
  RETURNED_TO_SELLER: {
    SELLER: ['DELIVERY_FAILED'],
    ADMIN: ['DELIVERY_FAILED', 'SHIPPED'],
  },
  CANCELLED: {
    SELLER: ['PLACED', 'ACCEPTED', 'PACKED'],
    // Buyers may only cancel before the seller accepts (unchanged rule).
    BUYER: ['PLACED'],
    ADMIN: ['PLACED', 'ACCEPTED', 'PACKED', 'SHIPPED', 'DELIVERY_FAILED'],
    SYSTEM: ['PLACED'],
  },
};

export function allowedSources(
  to: SellerOrderStatus,
  actor: OrderActor,
): SellerOrderStatus[] {
  return transitions[to]?.[actor] ?? [];
}

export function canTransition(
  from: SellerOrderStatus,
  to: SellerOrderStatus,
  actor: OrderActor,
): boolean {
  return allowedSources(to, actor).includes(from);
}

/** Stock returns to inventory on every transition into these statuses. */
export function restoresStock(to: SellerOrderStatus): boolean {
  return to === 'CANCELLED' || to === 'RETURNED_TO_SELLER';
}

/** Statuses whose transition must carry a human-readable reason (5..500). */
export function reasonRequired(to: SellerOrderStatus): boolean {
  return (
    to === 'CANCELLED' ||
    to === 'DELIVERY_FAILED' ||
    to === 'RETURNED_TO_SELLER'
  );
}

export const adminOrderActions = {
  CANCEL: 'CANCELLED',
  MARK_DELIVERY_FAILED: 'DELIVERY_FAILED',
  MARK_RETURNED: 'RETURNED_TO_SELLER',
  MARK_DELIVERED: 'DELIVERED',
} as const satisfies Record<string, SellerOrderStatus>;
export type AdminOrderAction = keyof typeof adminOrderActions;

/** Buyer/seller-facing notification text for a new status. */
export function statusMessage(
  to: SellerOrderStatus,
  audience: 'BUYER' | 'SELLER',
  shortId: string,
  reason?: string | null,
): string {
  const suffix = reason ? `: ${reason}` : '';
  if (audience === 'BUYER') {
    switch (to) {
      case 'ACCEPTED':
        return 'Your seller order was accepted';
      case 'PACKED':
        return 'Your seller order is packed';
      case 'SHIPPED':
        return 'Your seller order is shipped';
      case 'DELIVERED':
        return 'Your seller order was delivered';
      case 'DELIVERY_FAILED':
        return `Delivery of your seller order failed${suffix}`;
      case 'RETURNED_TO_SELLER':
        return `Your seller order was returned to the seller${suffix}`;
      case 'CANCELLED':
        return `A seller order was cancelled${suffix}`;
      default:
        return `Your seller order is ${String(to).toLowerCase()}`;
    }
  }
  switch (to) {
    case 'DELIVERY_FAILED':
      return `Order ${shortId} delivery failed${suffix}`;
    case 'RETURNED_TO_SELLER':
      return `Order ${shortId} was returned to the shop${suffix}`;
    case 'CANCELLED':
      return `Order ${shortId} was cancelled${suffix}`;
    default:
      return `Order ${shortId} is ${String(to).toLowerCase().replaceAll('_', ' ')}`;
  }
}

/** Placed orders not accepted before this instant are auto-cancelled. */
export function autoCancelCutoff(now: Date, acceptHours: number): Date {
  return new Date(now.getTime() - acceptHours * 3_600_000);
}

/** Placed orders older than this need admin attention (6 h before auto-cancel). */
export function attentionPlacedCutoff(now: Date, acceptHours: number): Date {
  return new Date(now.getTime() - Math.max(0, acceptHours - 6) * 3_600_000);
}

export const autoCancelReason = 'Seller did not accept the order in time';
