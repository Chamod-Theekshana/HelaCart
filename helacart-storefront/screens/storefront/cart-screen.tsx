"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Minus,
  Package,
  Plus,
  ShoppingBag,
  Trash2,
  Truck,
} from "lucide-react";
import { errorMessage, money } from "@/lib/api";
import { demoProducts } from "@/lib/demo";
import type { CartItem } from "@/lib/types";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { useShop } from "@/components/shop-provider";
import { ProductCard } from "@/components/product-card";
import { CartFeedback } from "@/components/cart-feedback";
import { StorefrontImage } from "@/components/storefront-image";
import { SignInLink } from "@/components/sign-in-link";
import { useT } from "@/components/language-provider";
import { shopPath } from "@/lib/shops";

export default function CartPage() {
  const t = useT();
  const {
    cart,
    user,
    isPreview,
    isGuestCart,
    setQuantity,
    refreshCart,
    cartLoading,
    cartError,
  } = useShop();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const rows = cart?.items ?? [];
  const groups = rows.reduce<Record<string, CartItem[]>>((acc, item) => {
    (acc[item.sellerId] ??= []).push(item);
    return acc;
  }, {});
  // Guest carts re-read live prices and stock each time the cart opens.
  useEffect(() => {
    if (isGuestCart) void refreshCart().catch(() => undefined);
  }, [isGuestCart, refreshCart]);
  async function change(id: string, quantity: number) {
    setBusy(id);
    setError("");
    try {
      await setQuantity(id, quantity);
    } catch (issue) {
      setError(errorMessage(issue));
    } finally {
      setBusy("");
    }
  }
  const checkoutReady =
    cart?.canCheckout && !cartLoading && !cartError && !busy;
  return (
    <div className="container cart-page">
      <Breadcrumbs items={[{ label: t("cart.title") }]} />
      <div className="page-title">
        <div>
          <span className="section-kicker">{t("cart.kicker")}</span>
          <h1>
            {t("cart.title")}{" "}
            <span className="title-count">
              {t(rows.length === 1 ? "cart.itemOne" : "cart.itemMany", {
                count: rows.length,
              })}
            </span>
          </h1>
        </div>
        <Link className="text-link" href="/products">
          {t("cart.continue")} <ArrowRight size={17} />
        </Link>
      </div>
      {error && (
        <div className="message error" role="alert">
          {error}
        </div>
      )}
      <CartFeedback />
      {isPreview && (
        <div className="message info">{t("cart.previewNotice")}</div>
      )}
      {isGuestCart && !user && (
        <div className="message info">
          {t("cart.guestNotice")}{" "}
          <SignInLink next="/checkout">{t("auth.signIn")}</SignInLink>
        </div>
      )}
      {isGuestCart && user && !user.emailVerified && (
        <div className="message info">
          {t("cart.verifyNotice")}{" "}
          <SignInLink next="/cart">{t("cart.checkVerification")}</SignInLink>
        </div>
      )}
      {rows.length ? (
        <div className="cart-layout">
          <div className="cart-groups">
            {Object.entries(groups).map(([sellerId, items]) => (
              <section className="panel cart-group" key={sellerId}>
                <div className="cart-group-heading">
                  <span className="seller-small-icon">▣</span>
                  <div>
                    <Link href={shopPath({ slug: items[0]?.sellerSlug })}>
                      <strong>
                        {items[0]?.sellerName ||
                          (isPreview
                            ? (demoProducts.find(
                                (product) => product.seller.slug === sellerId,
                              )?.seller.name ?? t("cart.localSeller"))
                            : t("cart.localShop"))}
                      </strong>
                    </Link>
                    <small>{t("cart.sellerItems")}</small>
                  </div>
                </div>
                {(items ?? []).map((item) => (
                  <div className="cart-row" key={item.variantId}>
                    <div className="cart-product-thumb">
                      <StorefrontImage
                        src={
                          item.imageUrl ||
                          (isPreview
                            ? demoProducts.find(
                                (product) => product.id === item.productId,
                              )?.imageUrls[0]
                            : null)
                        }
                        alt={item.title}
                        fallback={<Package size={33} />}
                      />
                    </div>
                    <div className="cart-product-info">
                      <Link href={`/products/${item.productId}`}>
                        {item.title || t("cart.unavailableItem")}
                      </Link>
                      <small>
                        {Object.values(item.optionValues || {}).join(" · ") ||
                          item.sku}
                      </small>
                      <span
                        className={
                          item.available &&
                          item.availableQuantity >= item.quantity
                            ? "in-stock"
                            : "out-stock"
                        }
                      >
                        {!item.available
                          ? t("product.unavailable")
                          : item.availableQuantity === 0
                            ? t("product.outOfStock")
                            : item.availableQuantity < item.quantity
                              ? t("product.available", {
                                  count: item.availableQuantity,
                                })
                              : t("product.inStock")}
                      </span>
                      <button
                        className="remove-link"
                        disabled={Boolean(busy)}
                        onClick={() => change(item.variantId, 0)}
                      >
                        <Trash2 size={14} /> {t("cart.remove")}
                      </button>
                    </div>
                    <div className="cart-row-controls">
                      <strong>
                        {item.available
                          ? money(item.priceLkrMinor * item.quantity)
                          : "—"}
                      </strong>
                      <div className="qty-control">
                        <button
                          disabled={
                            Boolean(busy) ||
                            item.quantity <= 1 ||
                            !item.available
                          }
                          onClick={() =>
                            change(item.variantId, item.quantity - 1)
                          }
                          aria-label={t("cart.decrease", { title: item.title })}
                        >
                          <Minus size={14} />
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          disabled={
                            Boolean(busy) ||
                            !item.available ||
                            item.quantity >=
                              Math.min(100, item.availableQuantity)
                          }
                          onClick={() =>
                            change(item.variantId, item.quantity + 1)
                          }
                          aria-label={t("cart.increase", { title: item.title })}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="cart-group-foot">
                  <Truck size={15} />
                  {isPreview
                    ? t("cart.deliveryPreview")
                    : isGuestCart
                      ? t("cart.deliveryAfterSignIn")
                      : items[0]?.shippingConfigured
                        ? t("cart.deliveryEstimate", {
                            fee: money(items[0].shippingFeeLkrMinor ?? 0),
                          })
                        : t("cart.deliveryMissing")}
                </div>
              </section>
            ))}
          </div>
          <aside className="panel order-summary">
            <h2>{t("cart.summary")}</h2>
            <div className="summary-row">
              <span>{t("cart.subtotal")}</span>
              <strong>{money(cart?.subtotalLkrMinor ?? 0)}</strong>
            </div>
            <div className="summary-row">
              <span>{t("cart.estimatedDelivery")}</span>
              <strong>
                {isPreview
                  ? t("cart.deliveryLive")
                  : isGuestCart
                    ? t("cart.deliveryAtCheckout")
                    : money(cart?.shippingLkrMinor ?? 0)}
              </strong>
            </div>
            <div className="summary-total">
              <span>{t("cart.estimatedTotal")}</span>
              <strong>{money(cart?.totalLkrMinor ?? 0)}</strong>
            </div>
            <div className="cod-note">
              <Banknote size={21} />
              <span>
                <strong>{t("trust.cod.title")}</strong>
                <small>{t("cart.codText")}</small>
              </span>
            </div>
            {!isPreview && !isGuestCart && !cart?.canCheckout && (
              <p className="small-warning">{t("cart.checkoutLater")}</p>
            )}
            {isPreview ? (
              <Link className="primary-btn full" href="/checkout">
                {t("cart.previewCheckout")} <ArrowRight size={17} />
              </Link>
            ) : user?.emailVerified ? (
              <Link
                className={`primary-btn full ${checkoutReady ? "" : "disabled-link"}`}
                aria-disabled={!checkoutReady}
                href={checkoutReady ? "/checkout" : "/cart"}
              >
                {t("cart.proceed")} <ArrowRight size={17} />
              </Link>
            ) : (
              <SignInLink className="primary-btn full" next="/checkout">
                {t(user ? "cart.verifyToCheckout" : "cart.signInToCheckout")}{" "}
                <ArrowRight size={17} />
              </SignInLink>
            )}
            <Link className="outline-btn full" href="/products">
              {t("cart.continue")}
            </Link>
          </aside>
        </div>
      ) : (
        !cartLoading &&
        !cartError && (
          <div className="empty-panel cart-empty">
            <ShoppingBag size={39} />
            <h2>{t("cart.empty.title")}</h2>
            <p>{t("cart.empty.text")}</p>
            <Link className="primary-btn" href="/products">
              {t("cart.empty.action")} <ArrowRight size={17} />
            </Link>
          </div>
        )
      )}
      {isPreview && (
        <section className="home-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">{t("cart.moreKicker")}</span>
              <h2>{t("cart.moreTitle")}</h2>
            </div>
          </div>
          <div className="product-grid">
            {demoProducts.slice(8, 12).map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
