"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, LoaderCircle, Package, ShoppingBag, Store } from "lucide-react";
import { errorMessage, money } from "@/lib/api";
import type { Product } from "@/lib/types";
import { shopPath } from "@/lib/shops";
import { useShop } from "./shop-provider";
import { StorefrontImage } from "./storefront-image";
import s from "./product-card.module.css";

export function ProductImage({
  product,
  className = "",
}: {
  product: Product;
  className?: string;
}) {
  return (
    <div className={`product-photo ${className}`}>
      <StorefrontImage
        src={product.imageUrls?.[0]}
        alt={product.title}
        fallback={
          <span className={s.imageFallback}>
            <Package size={32} strokeWidth={1.3} />
            <small>Photo coming soon</small>
          </span>
        }
      />
    </div>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const { addToCart, isPreview, authReady } = useShop();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [result, setResult] = useState<"idle" | "success" | "error">("idle");
  const variant = product.variants.find((entry) => entry.availableQuantity > 0);
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
      setFeedback(isPreview ? "Added to preview cart." : "Added to your cart.");
    } catch (error) {
      setResult("error");
      setFeedback(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className={`product-card ${s.card}`}>
      <Link
        href={`/products/${product.id}`}
        className={`product-image-link ${s.imageLink}`}
        aria-label={`View ${product.title}`}
      >
        <ProductImage product={product} className={s.photo} />
        <span className={s.category}>{product.category.name}</span>
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
        <div className={s.meta}>
          <strong className={s.price}>
            {money(
              product.listingPriceLkrMinor ??
                variant?.priceLkrMinor ??
                product.variants[0]?.priceLkrMinor ??
                product.priceLkrMinor,
            )}
          </strong>
          <span className={`${s.stock} ${variant ? "" : s.soldOut}`}>
            <span />
            {variant ? "In stock" : "Sold out"}
          </span>
        </div>
        <button
          className={`primary-btn add-card-btn ${s.add} ${result === "success" ? s.added : ""}`}
          type="button"
          onClick={() => void add()}
          disabled={!variant || busy || !authReady}
          aria-busy={busy}
          aria-label={
            variant
              ? `Add ${product.title} to cart`
              : `${product.title} is out of stock`
          }
        >
          {busy ? (
            <LoaderCircle size={16} className={s.spinner} aria-hidden="true" />
          ) : result === "success" ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <ShoppingBag size={16} aria-hidden="true" />
          )}
          {busy
            ? "Adding..."
            : result === "success"
              ? "Added"
              : variant
                ? "Add to cart"
                : "Out of stock"}
        </button>
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
