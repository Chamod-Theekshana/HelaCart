"use client";
import { useShop } from "./shop-provider";
import { useT } from "./language-provider";
import { checkoutErrorKey } from "@/lib/checkout-errors";

export function CartFeedback() {
  const {
    cart,
    cartLoading,
    cartError,
    refreshCart,
    isPreview,
    isGuestCart,
    cartNotice,
    dismissCartNotice,
  } = useShop();
  const t = useT();
  if (isPreview) return null;
  const notice = cartNotice && (
    <div className="message info cart-notice" role="status">
      <span>
        {cartNotice.merged > 0 &&
          t("cart.merge.merged", { count: cartNotice.merged })}{" "}
        {cartNotice.capped > 0 && t("cart.merge.capped", { max: 100 })}{" "}
        {cartNotice.unavailable > 0 &&
          t("cart.merge.unavailable", { count: cartNotice.unavailable })}
      </span>
      <button
        type="button"
        onClick={dismissCartNotice}
        aria-label={t("common.dismiss")}
      >
        ×
      </button>
    </div>
  );
  if (cartError)
    return (
      <>
        {notice}
        <div className="message error" role="alert">
          {t("cart.refreshError")} {cartError}{" "}
          <button
            className="text-link"
            onClick={() => void refreshCart().catch(() => undefined)}
          >
            {t("common.tryAgain")}
          </button>
        </div>
      </>
    );
  if (cartLoading)
    return (
      <>
        {notice}
        <div className="message info" role="status">
          {t("cart.loading")}
        </div>
      </>
    );
  if (!cart?.items.length) return notice || null;
  const problems = cart.items.flatMap((item) =>
    !item.available
      ? [
          item.title
            ? t("cart.problem.unavailable", { title: item.title })
            : t("cart.problem.unavailableUnknown"),
        ]
      : item.availableQuantity < item.quantity
        ? [
            item.availableQuantity > 0
              ? t("cart.problem.onlyAvailable", {
                  count: item.availableQuantity,
                  title: item.title,
                })
              : t("cart.problem.outOfStock", { title: item.title }),
          ]
        : !item.shippingConfigured
          ? [
              t("cart.problem.noDelivery", {
                seller: item.sellerName || t("cart.thisShop"),
              }),
            ]
          : [],
  );
  if (cart.totalLkrMinor > 1_000_000_000)
    problems.push(t("cart.problem.tooLarge"));
  // Checkout blockers the API already knows about (§3.2).
  if (!isGuestCart)
    for (const code of cart.checkoutBlockers ?? [])
      problems.push(t(checkoutErrorKey(code)));
  return (
    <>
      {notice}
      {problems.length > 0 && (
        <div className="message error checkout-blockers" role="alert">
          {[...new Set(problems)].map((problem) => (
            <p key={problem}>{problem}</p>
          ))}
        </div>
      )}
    </>
  );
}
