import type { Cart, CartItem, GuestCartLine, Product } from "./types";

/** localStorage key for signed-out (or not yet verified) shoppers' carts. */
export const guestCartKey = "helacart.guestCart.v1";
/** Same per-variant ceiling the API enforces on `PUT /me/cart/items/:variantId`. */
export const maxLineQuantity = 100;
export const maxGuestLines = 50;
const changeEvent = "helacart:guest-cart";

function isLine(value: unknown): value is GuestCartLine {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.productId === "string" &&
    row.productId.length > 0 &&
    row.productId.length <= 100 &&
    typeof row.variantId === "string" &&
    /^[A-Za-z0-9-]{1,100}$/.test(row.variantId) &&
    Number.isInteger(row.quantity) &&
    (row.quantity as number) > 0
  );
}

/** Merges duplicate variants, caps quantities and drops malformed rows. */
export function normalizeGuestLines(value: unknown): GuestCartLine[] {
  if (!Array.isArray(value)) return [];
  const rows = new Map<string, GuestCartLine>();
  for (const entry of value) {
    if (!isLine(entry)) continue;
    const previous = rows.get(entry.variantId);
    rows.set(entry.variantId, {
      productId: entry.productId,
      variantId: entry.variantId,
      quantity: Math.min(
        maxLineQuantity,
        (previous?.quantity ?? 0) + entry.quantity,
      ),
    });
  }
  return [...rows.values()].slice(0, maxGuestLines);
}

export function readGuestCart(): GuestCartLine[] {
  try {
    return normalizeGuestLines(
      JSON.parse(localStorage.getItem(guestCartKey) || "[]"),
    );
  } catch {
    return [];
  }
}

export function writeGuestCart(lines: GuestCartLine[]) {
  try {
    const rows = normalizeGuestLines(lines);
    if (rows.length) localStorage.setItem(guestCartKey, JSON.stringify(rows));
    else localStorage.removeItem(guestCartKey);
  } catch {
    /* Private browsing or blocked storage: the cart lasts for this page only. */
  }
  try {
    window.dispatchEvent(new Event(changeEvent));
  } catch {
    /* Not in a browser. */
  }
}

/** Calls `listener` when this tab or another tab changes the guest cart. */
export function subscribeToGuestCart(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === guestCartKey) listener();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(changeEvent, listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(changeEvent, listener);
  };
}

/**
 * Product lookups for guest lines: a product, `null` when the API no longer
 * lists it (404), or `"error"` when it could not be loaded right now.
 */
export type GuestProductState = Product | null | "error";

/** Builds a cart-shaped view of guest lines from live public product data. */
export function guestCartView(
  lines: GuestCartLine[],
  products: Record<string, GuestProductState | undefined>,
): Cart {
  const items: CartItem[] = lines.map((line) => {
    const entry = products[line.productId];
    const product = entry && entry !== "error" ? entry : null;
    const variant = product?.variants.find((row) => row.id === line.variantId);
    if (!product || !variant)
      return {
        variantId: line.variantId,
        productId: line.productId,
        sellerId: product?.seller.id ?? product?.seller.slug ?? "unavailable",
        sellerName: product?.seller.name,
        sellerSlug: product?.seller.slug,
        title: product?.title ?? "",
        sku: "",
        optionValues: {},
        priceLkrMinor: 0,
        quantity: line.quantity,
        availableQuantity: 0,
        available: false,
        shippingConfigured: true,
        imageUrl: product?.imageUrls[0] ?? null,
        shippingFeeLkrMinor: null,
      };
    return {
      variantId: variant.id,
      productId: product.id,
      sellerId: product.seller.id ?? product.seller.slug ?? product.seller.name,
      sellerName: product.seller.name,
      sellerSlug: product.seller.slug,
      title: product.title,
      sku: variant.sku,
      optionValues: variant.optionValues ?? {},
      priceLkrMinor: variant.priceLkrMinor,
      originalPriceLkrMinor: variant.originalPriceLkrMinor,
      quantity: line.quantity,
      availableQuantity: variant.availableQuantity,
      available: true,
      // Delivery is quoted for the buyer's address after sign-in.
      shippingConfigured: true,
      imageUrl: product.imageUrls[0] ?? null,
      shippingFeeLkrMinor: null,
    };
  });
  const subtotal = items
    .filter((item) => item.available)
    .reduce((sum, item) => sum + item.priceLkrMinor * item.quantity, 0);
  return {
    items,
    subtotalLkrMinor: subtotal,
    shippingLkrMinor: 0,
    totalLkrMinor: subtotal,
    canCheckout: false,
  };
}
