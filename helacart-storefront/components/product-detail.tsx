"use client";
/* eslint-disable react/no-unescaped-entities */

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Banknote, Minus, PackageCheck, Plus, ShieldCheck, ShoppingBag, Store } from "lucide-react";
import { errorMessage, money } from "@/lib/api";
import type { Product } from "@/lib/types";
import { useShop } from "./shop-provider";

export function ProductDetail({ product }: { product: Product }) {
  const [image, setImage] = useState(0);
  const [variantId, setVariantId] = useState(product.variants.find((entry) => entry.availableQuantity)?.id ?? product.variants[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const { addToCart, isPreview } = useShop();
  const variant = product.variants.find((entry) => entry.id === variantId);
  const available = variant?.availableQuantity ?? 0;
  async function add() {
    setBusy(true); setNotice("");
    try { await addToCart(product, variantId, quantity); setNotice(isPreview ? "Added to your preview cart." : "Added to your cart."); }
    catch (error) { setNotice(errorMessage(error)); }
    finally { setBusy(false); }
  }
  return <>
    <div className="detail-grid">
      <div className="gallery">
        <div className="gallery-main">
          {product.imageUrls[image]
            ? <img src={product.imageUrls[image]} alt={product.title} />
            : <span className="image-fallback">HelaCart</span>}
        </div>
        {product.imageUrls.length > 1 && <div className="gallery-thumbs">{product.imageUrls.map((src, index) =>
          <button type="button" className={image === index ? "selected" : ""} key={src}
            onClick={() => setImage(index)} aria-label={`View image ${index + 1}`}>
            <img src={src} alt="" />
          </button>)}</div>}
      </div>
      <div className="detail-copy">
        <div className="seller-label"><Store size={15} /> Sold by {product.seller.name}</div>
        <span className="category-pill">{product.category.name}</span>
        <h1>{product.title}</h1>
        <p className="product-sku">{variant?.sku ?? "Product details"}</p>
        <div className="detail-price">{money(variant?.priceLkrMinor ?? product.priceLkrMinor)}</div>
        <p className="product-description">{product.description || "Explore this product from a HelaCart seller."}</p>
        {product.variants.length > 1 && <div className="detail-options"><h2>Select an option</h2>
          <div className="option-buttons">{product.variants.map((entry) =>
            <button key={entry.id} type="button" className={variantId === entry.id ? "selected" : ""}
              onClick={() => { setVariantId(entry.id); setQuantity(1); }}>
              {Object.values(entry.optionValues || {}).join(" / ") || entry.sku}
              {entry.availableQuantity === 0 && <small>Unavailable</small>}
            </button>)}</div>
        </div>}
        <div className="stock-message"><span className={available ? "stock-dot" : "stock-dot out"} />{available ? `${available} available` : "Currently out of stock"}</div>
        <div className="detail-actions">
          <div className="qty-control"><button disabled={quantity <= 1} type="button" onClick={() => setQuantity(quantity - 1)} aria-label="Decrease quantity"><Minus size={17} /></button><span>{quantity}</span><button disabled={quantity >= Math.min(available, 100)} type="button" onClick={() => setQuantity(quantity + 1)} aria-label="Increase quantity"><Plus size={17} /></button></div>
          <button className="primary-btn" type="button" onClick={add} disabled={!available || busy}><ShoppingBag size={18} /> {busy ? "Adding..." : "Add to Cart"}</button>
        </div>
        {notice && <div className="message success" role="status">{notice} <Link href="/cart">View cart <ArrowRight size={15} /></Link></div>}
        <div className="detail-benefits"><div><Banknote size={19} /><span><strong>Cash on Delivery</strong><small>Available at checkout</small></span></div><div><PackageCheck size={19} /><span><strong>Delivery total</strong><small>Calculated from the seller's settings in your cart</small></span></div><div><ShieldCheck size={19} /><span><strong>Listed on HelaCart</strong><small>Browse approved marketplace products</small></span></div></div>
      </div>
    </div>
    <section className="spec-section"><div><span className="section-kicker">PRODUCT DETAILS</span><h2>About this item</h2><p>{product.description || "The seller has not added a description yet."}</p></div><div><span className="section-kicker">SELLER</span><h2>{product.seller.name}</h2><p>Explore more goods from Sri Lankan sellers in the HelaCart catalog.</p><Link href="/products" className="text-link">Continue shopping <ArrowRight size={16} /></Link></div></section>
  </>;
}
