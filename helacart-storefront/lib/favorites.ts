import type { Product } from "./types";
export type FavoriteRef = { id: string; productId: string | null };
export type FavoriteSummary = { items: FavoriteRef[]; total: number };
export type FavoriteItem = FavoriteRef & {
  priceAlerts?: boolean;
  restockAlerts?: boolean;
  alertVersion?: number;
  createdAt: string;
  title: string;
  sellerName: string;
  imageUrl: string | null;
  product: Product | null;
};
export type FavoriteIntent = {
  productId: string;
  createdAt: number;
  userId?: string;
};
const storageKey = "helacart:favorite-intent";
export function rememberFavorite(productId: string) {
  try {
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({ productId, createdAt: Date.now() }),
    );
  } catch {
    /* Sign-in still returns to the product if storage is unavailable. */
  }
}
export function readFavoriteIntent(userId: string): FavoriteIntent | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(storageKey) || "null",
    ) as FavoriteIntent | null;
    if (!value) return null;
    if (
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
        value.productId,
      ) ||
      !Number.isFinite(value.createdAt) ||
      Date.now() - value.createdAt > 3600000 ||
      value.createdAt > Date.now() + 60000
    ) {
      sessionStorage.removeItem(storageKey);
      return null;
    }
    if (value.userId && value.userId !== userId) return null;
    const claimed = { ...value, userId };
    sessionStorage.setItem(storageKey, JSON.stringify(claimed));
    return claimed;
  } catch {
    return null;
  }
}
export function clearFavoriteIntent(productId: string, userId: string) {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(storageKey) || "null",
    ) as FavoriteIntent | null;
    if (value?.productId === productId && value.userId === userId)
      sessionStorage.removeItem(storageKey);
  } catch {}
}
const exactDestinations = new Set([
  "/",
  "/cart",
  "/checkout",
  "/orders",
  "/favorites",
  "/account",
  "/seller",
  "/admin",
  "/products",
  "/shops",
]);
const destinationPrefixes = [
  "/account/",
  "/seller/",
  "/admin/",
  "/products/",
  "/shops/",
  "/legal/",
];
/**
 * Where to send a buyer after sign-in. Only same-origin relative paths on the
 * allow-list are accepted; anything else (absolute URLs, protocol-relative
 * `//host`, backslashes, control characters, dot segments, the auth page
 * itself) falls back to `/account` so `?next=` cannot become an open redirect.
 */
export function safeSignInDestination(value: string | null) {
  const fallback = "/account";
  if (
    !value ||
    value.length > 2048 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]/.test(value)
  )
    return fallback;
  const path = value.split(/[?#]/)[0];
  if (/(?:^|\/)\.{1,2}(?:\/|$)/.test(path) || /%2e|%2f|%5c/i.test(path))
    return fallback;
  return exactDestinations.has(path) ||
    destinationPrefixes.some(
      (prefix) => path.startsWith(prefix) && path.length > prefix.length,
    )
    ? value
    : fallback;
}
/** `/auth` link that returns to `next` (path + query) after sign-in. */
export function signInHref(next?: string | null) {
  return next && !next.startsWith("/auth")
    ? `/auth?next=${encodeURIComponent(next)}`
    : "/auth";
}
