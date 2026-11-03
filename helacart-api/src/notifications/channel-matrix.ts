import type {
  NotificationChannel,
  NotificationType,
} from '../generated/prisma/client.js';

/** Who a notification is for; the default channel matrix depends on it. */
export type NotificationAudience = 'BUYER' | 'SELLER' | 'ADMIN';

/** Buyer order updates are also sent by SMS only for these statuses. */
export const smsOrderStatuses = [
  'SHIPPED',
  'DELIVERY_FAILED',
  'CANCELLED',
] as const;

/**
 * Default external channels for one in-app notification (contract §7). User
 * preferences are applied later by the delivery worker, so a preference change
 * also affects messages that are still queued.
 */
export function channelsFor(
  type: NotificationType,
  audience: NotificationAudience,
  orderStatus?: string,
): NotificationChannel[] {
  if (type === 'ORDER_PLACED')
    return audience === 'SELLER' ? ['PUSH', 'EMAIL', 'SMS'] : ['PUSH'];
  if (type === 'ORDER_UPDATED' || type === 'ORDER_TRACKING_UPDATED') {
    if (audience !== 'BUYER') return ['PUSH'];
    return (smsOrderStatuses as readonly string[]).includes(orderStatus ?? '')
      ? ['PUSH', 'EMAIL', 'SMS']
      : ['PUSH', 'EMAIL'];
  }
  if (
    type.startsWith('RETURN_') ||
    type === 'REFUND_UPDATED' ||
    type === 'SUPPORT_UPDATED' ||
    type === 'SELLER_STATUS_CHANGED'
  )
    return ['PUSH', 'EMAIL'];
  return ['PUSH'];
}

/** Retry schedule for failed external deliveries (attempt n waits backoff[n-1]). */
export const deliveryBackoffMs = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
] as const;
export const maxDeliveryAttempts = deliveryBackoffMs.length + 1;

export function nextAttemptDelay(attempts: number): number | null {
  return attempts >= maxDeliveryAttempts
    ? null
    : deliveryBackoffMs[Math.min(attempts, deliveryBackoffMs.length) - 1];
}
