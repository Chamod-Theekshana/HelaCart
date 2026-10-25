"use client";
import { useShop } from "./shop-provider";
export function CartFeedback() {
  const { cart, cartLoading, cartError, refreshCart, isPreview } = useShop();
  if (isPreview) return null;
  if (cartError)
    return (
      <div className="message error" role="alert">
        Your cart could not be refreshed. {cartError}{" "}
        <button
          className="text-link"
          onClick={() => void refreshCart().catch(() => undefined)}
        >
          Try again
        </button>
      </div>
    );
  if (cartLoading)
    return (
      <div className="message info" role="status">
        Loading your latest cart…
      </div>
    );
  if (!cart?.items.length) return null;
  const problems = cart.items.flatMap((item) =>
    !item.available
      ? [`${item.title} is no longer available.`]
      : item.availableQuantity < item.quantity
        ? [
            item.availableQuantity > 0
              ? `Only ${item.availableQuantity} of ${item.title} are available. Reduce the quantity to continue.`
              : `${item.title} is out of stock.`,
          ]
        : !item.shippingConfigured
          ? [
              `${item.sellerName || "This shop"} has not set a delivery fee yet.`,
            ]
          : [],
  );
  if (cart.totalLkrMinor > 1_000_000_000)
    problems.push(
      "This cart exceeds the supported order total. Remove items or reduce quantities.",
    );
  return problems.length ? (
    <div className="message error" role="alert">
      {problems.map((problem) => (
        <p key={problem}>{problem}</p>
      ))}
    </div>
  ) : null;
}
