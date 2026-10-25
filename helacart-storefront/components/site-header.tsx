"use client";
import Image from "next/image";
import Link from "next/link";
import { Heart, Search, ShoppingBag, Store, UserRound } from "lucide-react";
import { useFavorites } from "./favorites-provider";
import { useShop } from "./shop-provider";
import { ProfileAvatar } from "./profile-avatar";
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
  const { cart, user, accountProfile, cartLoading } = useShop();
  const favorites = useFavorites();
  const count = cart?.items.reduce((sum, row) => sum + row.quantity, 0) ?? 0;
  const search = (mobile = false) => (
    <form
      action="/products"
      className={mobile ? "mobile-search container" : "site-search"}
    >
      <Search size={19} aria-hidden="true" />
      <input
        name="q"
        maxLength={80}
        aria-label="Search products"
        placeholder="Search for your next good find"
      />
      <button type="submit">Search</button>
    </form>
  );
  return (
    <header className="site-header storefront-header">
      <div className="container header-main">
        <Brand />
        {search()}
        <div className="header-actions">
          <Link
            href={user ? "/account/profile" : "/auth"}
            className="account-link"
            aria-label={user ? "Your account" : "Sign in to your account"}
          >
            {user ? (
              <ProfileAvatar
                name={accountProfile?.name || user.email || "HC"}
                small
              />
            ) : (
              <UserRound size={20} />
            )}
            <span
              className="account-label"
              title={accountProfile?.name || undefined}
            >
              {accountProfile?.name?.split(" ")[0] || "Account"}
            </span>
          </Link>
          <Link
            href="/cart"
            className="cart-button"
            aria-label={
              cartLoading ? "Cart is loading" : `Cart with ${count} items`
            }
          >
            <ShoppingBag size={19} />
            <span className="cart-label">Cart</span>
            <span className="cart-count">{cartLoading ? "…" : count}</span>
          </Link>
        </div>
      </div>
      {search(true)}
      <nav className="category-nav" aria-label="Storefront navigation">
        <div className="container nav-inner">
          <Link href="/products">All products</Link>
          <Link href={categories.length ? "/#categories" : "/products"}>
            Categories
          </Link>
          <Link href="/shops">Shops</Link>
          <Link href="/favorites" className="favorites-nav">
            <Heart size={15} />
            Favorites
            <span>
              {favorites.loading
                ? "…"
                : favorites.error
                  ? "—"
                  : favorites.count}
            </span>
          </Link>
          <Link href="/orders">Track order</Link>
          <Link href="/seller" className="nav-seller">
            <Store size={16} />
            Seller Center
          </Link>
        </div>
      </nav>
    </header>
  );
}
