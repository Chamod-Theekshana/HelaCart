"use client";
import discoveryStyles from "./discovery.module.css";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, LoaderCircle, Package, ShoppingBag, Store } from "lucide-react";
import { errorMessage, money } from "@/lib/api";
import type { Product } from "@/lib/types";
import { shopPath } from "@/lib/shops";
import { useShop } from "./shop-provider";
import { StorefrontImage } from "./storefront-image";
import { FavoriteButton } from "./favorite-button";
import favoriteStyles from "./favorites.module.css";
import s from "./product-card.module.css";
import { useT } from "./language-provider";

export function ProductImage({
  product,
  className = "",
}: {
  product: Product;
  className?: string;
}) {
  const t = useT();
  return (
    <div className={`product-photo ${className}`}>
      <StorefrontImage
        src={product.imageUrls?.[0]}
        alt={product.title}
        fallback={
          <span className={s.imageFallback}>
            <Package size={32} strokeWidth={1.3} />
            <small>{t("product.photoSoon")}</small>
          </span>
        }
      />
    </div>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const { addToCart, isPreview, authReady } = useShop();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [result, setResult] = useState<"idle" | "success" | "error">("idle");
  const variant = product.variants
    .filter((entry) => entry.availableQuantity > 0)
    .sort((a, b) => a.priceLkrMinor - b.priceLkrMinor)[0];
  const hasOptions = product.variants.length > 1;
  const lowStock = variant && variant.availableQuantity < 5;
  useEffect(() => {
    if (result !== "success") return;
    const timer = setTimeout(() => setResult("idle"), 2200);
    return () => clearTimeout(timer);
  }, [result]);
  async function add() {
    if (!variant || busy || !authReady) return;
    setBusy(true);
    setFeedback("");
    setResult("idle");
    try {
      await addToCart(product, variant.id);
      setResult("success");
      setFeedback(isPreview ? t("product.addedPreview") : t("product.added"));
    } catch (error) {
      setResult("error");
      setFeedback(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className={`product-card ${s.card}`}>
      <div className={favoriteStyles.overlay}>
        <FavoriteButton productId={product.id} title={product.title} />
      </div>
      <Link
        href={`/products/${product.id}`}
        className={`product-image-link ${s.imageLink}`}
        aria-label={t("product.view", { title: product.title })}
      >
        <ProductImage product={product} className={s.photo} />
        {!variant && <span className={s.category}>{t("product.soldOut")}</span>}
      </Link>
      <div className={`product-card-body ${s.body}`}>
        <Link
          className={`product-seller ${s.seller}`}
          href={shopPath(product.seller)}
        >
          <Store size={12} aria-hidden="true" />
          <span>{product.seller.name}</span>
        </Link>
        <Link
          className={`product-card-title ${s.title}`}
          href={`/products/${product.id}`}
        >
          {product.title}
        </Link>
        {product.promotion && (
          <span className={discoveryStyles.offer}>
            {product.promotion.name}
          </span>
        )}
        {variant?.originalPriceLkrMinor &&
          variant.originalPriceLkrMinor > variant.priceLkrMinor && (
            <del className={discoveryStyles.oldPrice}>
              {money(variant.originalPriceLkrMinor)}
            </del>
          )}
        <div className={s.meta}>
          <strong className={s.price}>
            {money(
              product.listingPriceLkrMinor ??
                variant?.priceLkrMinor ??
                product.variants[0]?.priceLkrMinor ??
                product.priceLkrMinor,
            )}
          </strong>
          <span
            className={`${s.stock} ${variant ? "" : s.soldOut} ${lowStock ? s.lowStock : ""}`}
          >
            <span />
            {variant
              ? lowStock
                ? t("product.onlyLeft", { count: variant.availableQuantity })
                : t("product.inStock")
              : t("product.outOfStock")}
          </span>
        </div>
        {hasOptions && variant ? (
          <Link
            href={`/products/${product.id}`}
            className={`primary-btn ${s.add} ${s.options}`}
          >
            {t("product.chooseOptions")} <ShoppingBag size={15} />
          </Link>
        ) : (
          <button
            className={`primary-btn add-card-btn ${s.add} ${result === "success" ? s.added : ""}`}
            type="button"
            onClick={() => void add()}
            disabled={!variant || busy || !authReady}
            aria-busy={busy}
            aria-label={
              variant
                ? t("product.addAria", { title: product.title })
                : t("product.outOfStockAria", { title: product.title })
            }
          >
            {busy ? (
              <LoaderCircle
                size={16}
                className={s.spinner}
                aria-hidden="true"
              />
            ) : result === "success" ? (
              <Check size={16} aria-hidden="true" />
            ) : (
              <ShoppingBag size={16} aria-hidden="true" />
            )}
            {busy
              ? t("product.adding")
              : result === "success"
                ? t("product.addedShort")
                : variant
                  ? t("product.addToCart")
                  : t("product.outOfStock")}
          </button>
        )}
        <p
          className={`${s.feedback} ${result === "error" ? s.error : ""}`}
          role={result === "error" ? "alert" : "status"}
        >
          {feedback}
        </p>
      </div>
    </article>
  );
}
