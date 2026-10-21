"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { errorMessage, money } from "@/lib/api";
import type { Product } from "@/lib/types";
import { shopPath } from "@/lib/shops";
import { useShop } from "./shop-provider";

export function ProductImage({ product, className = "" }: { product: Product; className?: string }) {
  const [failed, setFailed] = useState(false);
  const source = product.imageUrls?.[0];
  return <div className={`product-photo ${className}`}>
    {!source || failed ? <span className="image-fallback">HelaCart</span> :
      // Marketplace image URLs are supplied by sellers or the Stitch preview.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={source} alt={product.title} loading="lazy" onError={() => setFailed(true)} />}
  </div>;
}

export function ProductCard({ product }: { product: Product }) {
  const { addToCart, isPreview } = useShop();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const variant = product.variants.find((entry) => entry.availableQuantity > 0);
  async function add() {
    if (!variant) return;
    setBusy(true); setFeedback("");
    try { await addToCart(product, variant.id); setFeedback(isPreview ? "Added to preview cart" : "Added to cart"); }
    catch (error) { setFeedback(errorMessage(error)); }
    finally { setBusy(false); }
  }
  return <article className="product-card">
    <Link href={`/products/${product.id}`} className="product-image-link" aria-label={`View ${product.title}`}>
      <ProductImage product={product} /><span className="photo-category">{product.category.name}</span>
    </Link>
    <div className="product-card-body">
      <Link className="product-seller" href={shopPath(product.seller)}>{product.seller.name}</Link>
      <Link className="product-card-title" href={`/products/${product.id}`}>{product.title}</Link>
      <div className="availability">{variant ? "In stock" : "Unavailable"} <span>·</span> {product.category.name}</div>
      <div className="product-card-bottom"><strong>{money(variant?.priceLkrMinor ?? product.priceLkrMinor)}</strong>
        <Link href={`/products/${product.id}`} aria-label={`See ${product.title}`}><ArrowRight size={17} /></Link>
      </div>
      <button className="primary-btn add-card-btn" onClick={add} disabled={!variant || busy}>
        <ShoppingBag size={15} /> {busy ? "Adding..." : variant ? "Add to Cart" : "Out of Stock"}
      </button>
      {feedback && <small className="card-feedback" role="status">{feedback}</small>}
    </div>
  </article>;
}
