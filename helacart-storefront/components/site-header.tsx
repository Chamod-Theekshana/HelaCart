"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, Search, ShoppingBag, Truck, UserRound, X } from "lucide-react";
import { useShop } from "./shop-provider";
import type { Category } from "@/lib/types";

export function Brand() {
  return <Link className="brand" href="/" aria-label="HelaCart home">
    <span className="brand-crop">
      <Image src="/helacart-logo.png" alt="HelaCart" width={1254} height={1254} priority />
    </span>
  </Link>;
}

export function SiteHeader({ categories }: { categories: Category[] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { cart, user } = useShop();
  const count = cart?.items.reduce((sum, row) => sum + row.quantity, 0) ?? 0;
  return <>
    <div className="topbar"><div className="container topbar-inner">
      <span><Truck size={15} /> Sri Lankan marketplace</span>
      <span className="topbar-right">Cash on delivery at checkout <span className="divider">|</span> Shop local goods</span>
    </div></div>
    <header className="site-header">
      <div className="container header-main">
        <button className="mobile-menu icon-btn" type="button" aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
        <Brand />
        <div className="destination"><span className="destination-icon">⌖</span><span><small>DELIVER TO</small><strong>Sri Lanka</strong></span></div>
        <form action="/products" className="site-search">
          <Search size={20} aria-hidden="true" />
          <input name="q" aria-label="Search products" placeholder="Search products and categories..." />
          <button type="submit">Search</button>
        </form>
        <div className="header-actions">
          <Link href="/account" className="account-link" aria-label="Your account"><span className="round-icon"><UserRound size={18} /></span><span><small>{user?.email ? "HELLO" : "HELLO, SIGN IN"}</small><strong>Account</strong></span></Link>
          <Link href="/cart" className="cart-button" aria-label={`Cart with ${count} items`}><ShoppingBag size={19} /><span>CART<small>{count} {count === 1 ? "item" : "items"}</small></span></Link>
        </div>
      </div>
      <nav className={`category-nav ${menuOpen ? "is-open" : ""}`} aria-label="Shopping categories">
        <div className="container nav-inner">
          <Link className="nav-all" href="/products" onClick={() => setMenuOpen(false)}><Menu size={16} /> All Categories</Link>
          <Link href="/" onClick={() => setMenuOpen(false)}>Home</Link>
          <Link href="/shops" onClick={() => setMenuOpen(false)}>Explore Shops</Link>
          <Link href="/seller" onClick={() => setMenuOpen(false)}>Seller Center</Link>
          {categories.slice(0, 4).map((item) =>
            <Link key={item.id} href={`/products?category=${encodeURIComponent(item.slug)}`}
              onClick={() => setMenuOpen(false)}>{item.name}</Link>)}
          <span className="nav-reassurance">✧ Discover local sellers</span>
        </div>
      </nav>
      <form action="/products" className="mobile-search container"><Search size={18} /><input name="q" aria-label="Search products" placeholder="Search products..." /><button type="submit">Go</button></form>
    </header>
  </>;
}
