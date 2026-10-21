"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  MapPin,
  Menu,
  Search,
  ShoppingBag,
  Sparkles,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { useShop } from "./shop-provider";
import { ProfileAvatar } from "./profile-avatar";
import profileStyles from "./profile.module.css";
import type { Category } from "@/lib/types";

export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="HelaCart home">
      <span className="brand-crop">
        <Image
          src="/helacart-logo.png"
          alt="HelaCart"
          width={1254}
          height={1254}
          priority
        />
      </span>
    </Link>
  );
}

export function SiteHeader({ categories }: { categories: Category[] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [menuOpen]);
  const { cart, user, accountProfile } = useShop();
  const count = cart?.items.reduce((sum, row) => sum + row.quantity, 0) ?? 0;
  return (
    <>
      <div className="topbar">
        <div className="container topbar-inner">
          <span>
            <Truck size={15} /> Sri Lankan marketplace
          </span>
          <span className="topbar-right">
            Cash on delivery at checkout <span className="divider">|</span> Shop
            local goods
          </span>
        </div>
      </div>
      <header className="site-header">
        <div className="container header-main">
          <button
            ref={menuButton}
            className="mobile-menu icon-btn"
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-controls="storefront-navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <Brand />
          <div className="destination">
            <MapPin size={22} aria-hidden="true" />
            <span>
              <small>SHOPPING IN</small>
              <strong>Sri Lanka</strong>
            </span>
          </div>
          <form
            action="/products"
            className="site-search"
            onSubmit={() => setMenuOpen(false)}
          >
            <Search size={20} aria-hidden="true" />
            <input
              name="q"
              maxLength={80}
              aria-label="Search products"
              placeholder="What are you looking for?"
            />
            <button type="submit">Search</button>
          </form>
          <div className="header-actions">
            <Link
              href="/account/profile"
              className="account-link"
              aria-label="Your profile"
            >
              {user ? (
                <ProfileAvatar
                  name={accountProfile?.name || user.email || "HC"}
                  small
                />
              ) : (
                <span className="round-icon">
                  <UserRound size={18} />
                </span>
              )}
              <span>
                <small>{user?.email ? "HELLO" : "HELLO, SIGN IN"}</small>
                <strong
                  className={profileStyles.headerName}
                  title={accountProfile?.name ?? undefined}
                >
                  {accountProfile?.name?.split(" ")[0] || "Account"}
                </strong>
              </span>
            </Link>
            <Link
              href="/cart"
              className="cart-button"
              aria-label={`Cart with ${count} items`}
            >
              <ShoppingBag size={19} />
              <span>
                CART
                <small>
                  {count} {count === 1 ? "item" : "items"}
                </small>
              </span>
            </Link>
          </div>
        </div>
        <nav
          id="storefront-navigation"
          className={`category-nav ${menuOpen ? "is-open" : ""}`}
          aria-label="Shopping categories"
        >
          <div className="container nav-inner">
            <Link
              className="nav-all"
              href="/products"
              onClick={() => setMenuOpen(false)}
            >
              <Menu size={16} /> All Categories
            </Link>
            <Link href="/" onClick={() => setMenuOpen(false)}>
              Home
            </Link>
            <Link href="/shops" onClick={() => setMenuOpen(false)}>
              Explore Shops
            </Link>
            <Link href="/seller" onClick={() => setMenuOpen(false)}>
              Seller Center
            </Link>
            {categories.slice(0, 4).map((item) => (
              <Link
                key={item.id}
                href={`/products?category=${encodeURIComponent(item.slug)}`}
                onClick={() => setMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
            <span className="nav-reassurance">
              <Sparkles size={13} aria-hidden="true" /> Local shops. Good finds.
            </span>
          </div>
        </nav>
        <form
          action="/products"
          className="mobile-search container"
          onSubmit={() => setMenuOpen(false)}
        >
          <Search size={18} aria-hidden="true" />
          <input
            name="q"
            maxLength={80}
            aria-label="Search products"
            placeholder="Find your next good thing..."
          />
          <button type="submit" aria-label="Submit product search">
            <Search size={17} aria-hidden="true" />
          </button>
        </form>
      </header>
    </>
  );
}
