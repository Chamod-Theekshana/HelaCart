export type CheckoutIntent = {
  userId: string;
  checkoutKey: string;
  addressId: string;
  quote: string;
};
const key = (userId: string) => `helacart:checkout:${userId}`;
export function readCheckoutIntent(userId: string): CheckoutIntent | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(key(userId)) || "null",
    ) as CheckoutIntent | null;
    return value?.userId === userId &&
      /^[a-f0-9-]{36}$/.test(value.checkoutKey) &&
      /^[a-f0-9-]{36}$/.test(value.addressId) &&
      /^[a-f0-9]{64}$/.test(value.quote)
      ? value
      : null;
  } catch {
    return null;
  }
}
export function saveCheckoutIntent(intent: CheckoutIntent) {
  try {
    sessionStorage.setItem(key(intent.userId), JSON.stringify(intent));
  } catch {
    /* The in-memory intent still protects retries in this page. */
  }
}
export function clearCheckoutIntent(userId: string) {
  try {
    sessionStorage.removeItem(key(userId));
  } catch {
    /* Storage may be unavailable. */
  }
}
