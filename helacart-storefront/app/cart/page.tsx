"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Banknote, Minus, Package, Plus, ShoppingBag, Trash2, Truck } from "lucide-react";
import { errorMessage, money } from "@/lib/api";
import { demoProducts } from "@/lib/demo";
import type { CartItem } from "@/lib/types";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { useShop } from "@/components/shop-provider";
import { ProductCard } from "@/components/product-card";

export default function CartPage() {
  const { cart, user, isPreview, setQuantity } = useShop();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const rows = cart?.items ?? [];
  const groups = rows.reduce<Record<string, CartItem[]>>((acc, item) => {
    (acc[item.sellerId] ??= []).push(item);
    return acc;
  }, {});
  async function change(id: string, quantity: number) {
    setBusy(id); setError("");
    try { await setQuantity(id, quantity); }
    catch (issue) { setError(errorMessage(issue)); }
    finally { setBusy(""); }
  }
  return <div className="container cart-page"><Breadcrumbs items={[{ label: "Shopping Cart" }]} />
    <div className="page-title"><div><span className="section-kicker">YOUR FINDS</span><h1>Your Shopping Cart <span className="title-count">{rows.length} {rows.length === 1 ? "item" : "items"}</span></h1></div><Link className="text-link" href="/products">Continue shopping <ArrowRight size={17} /></Link></div>
    {error && <div className="message error" role="alert">{error}</div>}
    {isPreview && <div className="message info">This cart shows sample products for design preview. Checkout is disabled until the backend is connected.</div>}
    {!isPreview && !user && <div className="message info">Sign in to view your saved cart. <Link href="/auth">Sign in</Link></div>}
    {rows.length ? <div className="cart-layout"><div className="cart-groups">
      {Object.entries(groups).map(([sellerId, items]) => <section className="panel cart-group" key={sellerId}><div className="cart-group-heading"><span className="seller-small-icon">▣</span><div><strong>{isPreview ? demoProducts.find((product) => product.seller.slug === sellerId)?.seller.name ?? "Local seller" : `Seller · ${sellerId.slice(0, 8)}`}</strong><small>Seller items</small></div></div>
        {(items ?? []).map((item) => <div className="cart-row" key={item.variantId}>
          <div className="cart-product-thumb">{isPreview && demoProducts.find((product) => product.id === item.productId)?.imageUrls[0]
            ? <img src={demoProducts.find((product) => product.id === item.productId)?.imageUrls[0]} alt="" />
            : <Package size={33} />}</div>
          <div className="cart-product-info"><Link href={`/products/${item.productId}`}>{item.title}</Link>
            <small>{Object.values(item.optionValues || {}).join(" · ") || item.sku}</small>
            <span className={item.available ? "in-stock" : "out-stock"}>{item.available ? "In stock" : "Unavailable"}</span>
            <button className="remove-link" disabled={busy === item.variantId} onClick={() => change(item.variantId, 0)}><Trash2 size={14} /> Remove</button>
          </div>
          <div className="cart-row-controls"><strong>{money(item.priceLkrMinor * item.quantity)}</strong><div className="qty-control"><button disabled={busy === item.variantId || item.quantity <= 1} onClick={() => change(item.variantId, item.quantity - 1)} aria-label={`Decrease ${item.title}`}><Minus size={14} /></button><span>{item.quantity}</span><button disabled={busy === item.variantId || item.quantity >= Math.min(100, item.availableQuantity)} onClick={() => change(item.variantId, item.quantity + 1)} aria-label={`Increase ${item.title}`}><Plus size={14} /></button></div></div>
        </div>)}
        <div className="cart-group-foot"><Truck size={15} /> Delivery fee for this seller is included in the summary.</div>
      </section>)}
    </div><aside className="panel order-summary"><h2>Order Summary</h2><div className="summary-row"><span>Items subtotal</span><strong>{money(cart?.subtotalLkrMinor ?? 0)}</strong></div><div className="summary-row"><span>Delivery</span><strong>{isPreview ? "Calculated on live cart" : money(cart?.shippingLkrMinor ?? 0)}</strong></div><div className="summary-total"><span>Total</span><strong>{money(cart?.totalLkrMinor ?? 0)}</strong></div><div className="cod-note"><Banknote size={21} /><span><strong>Cash on Delivery</strong><small>Pay when the order arrives.</small></span></div>
      {!isPreview && !cart?.canCheckout && <p className="small-warning">Checkout will become available when all items are in stock and each seller has configured delivery.</p>}
      {isPreview ? <Link className="primary-btn full" href="/checkout">Preview checkout <ArrowRight size={17} /></Link>
        : user ? <Link className={`primary-btn full ${cart?.canCheckout ? "" : "disabled-link"}`} aria-disabled={!cart?.canCheckout} href={cart?.canCheckout ? "/checkout" : "/cart"}>Proceed to COD Checkout <ArrowRight size={17} /></Link>
          : <Link className="primary-btn full" href="/auth">Sign in to checkout <ArrowRight size={17} /></Link>}
      <Link className="outline-btn full" href="/products">Continue shopping</Link>
    </aside></div> : <div className="empty-panel cart-empty"><ShoppingBag size={39} /><h2>Your cart is empty</h2><p>Start exploring local finds and add something you love.</p><Link className="primary-btn" href="/products">Browse products <ArrowRight size={17} /></Link></div>}
    {isPreview && <section className="home-section"><div className="section-heading"><div><span className="section-kicker">MORE TO DISCOVER</span><h2>Frequently browsed together</h2></div></div><div className="product-grid">{demoProducts.slice(8, 12).map((item) => <ProductCard key={item.id} product={item} />)}</div></section>}
  </div>;
}
