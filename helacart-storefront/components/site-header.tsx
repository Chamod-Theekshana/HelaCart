"use client";
import { SearchBox } from "./search-box";
import Image from "next/image";
import Link from "next/link";
import { Heart, ShoppingBag, Store, UserRound } from "lucide-react";
import { useFavorites } from "./favorites-provider";
import { useShop } from "./shop-provider";
import { ProfileAvatar } from "./profile-avatar";
import { NotificationBell } from "./notification-bell";
import { LanguageSwitcher } from "./language-switcher";
import { useT } from "./language-provider";
import { SignInLink } from "./sign-in-link";
import type { Category } from "@/lib/types";

export function Brand() {
  const t = useT();
  return (
    <Link className="brand" href="/" aria-label={t("header.home")}>
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
  const t = useT();
  const { cartCount, user, accountProfile, cartLoading } = useShop();
  const favorites = useFavorites();
  const accountContent = (
    <>
      {user ? (
        <ProfileAvatar
          name={accountProfile?.name || user.email || "HC"}
          small
        />
      ) : (
        <UserRound size={20} />
      )}
      <span className="account-label" title={accountProfile?.name || undefined}>
        {accountProfile?.name?.split(" ")[0] || t("header.account")}
      </span>
    </>
  );
  return (
    <header className="site-header storefront-header">
      <div className="container header-main">
        <Brand />
        <SearchBox />
        <div className="header-actions">
          <LanguageSwitcher className="header-language" />
          <NotificationBell />
          {user ? (
            <Link
              href="/account/profile"
              className="account-link"
              aria-label={t("header.yourAccount")}
            >
              {accountContent}
            </Link>
          ) : (
            <SignInLink
              className="account-link"
              ariaLabel={t("header.signInAccount")}
            >
              {accountContent}
            </SignInLink>
          )}
          <Link
            href="/cart"
            className="cart-button"
            aria-label={
              cartLoading
                ? t("header.cartLoading")
                : t("header.cartCount", { count: cartCount })
            }
          >
            <ShoppingBag size={19} />
            <span className="cart-label">{t("header.cart")}</span>
            <span className="cart-count">{cartLoading ? "…" : cartCount}</span>
          </Link>
        </div>
      </div>
      <SearchBox mobile />
      <nav className="category-nav" aria-label={t("header.navLabel")}>
        <div className="container nav-inner">
          <Link href="/products">{t("nav.allProducts")}</Link>
          <Link href="/products?deals=true">{t("nav.offers")}</Link>
          <Link href={categories.length ? "/#categories" : "/products"}>
            {t("nav.categories")}
          </Link>
          <Link href="/shops">{t("nav.shops")}</Link>
          <Link href="/favorites" className="favorites-nav">
            <Heart size={15} />
            {t("nav.favorites")}
            <span>
              {favorites.loading
                ? "…"
                : favorites.error
                  ? "—"
                  : favorites.count}
            </span>
          </Link>
          <Link href="/orders">{t("nav.trackOrder")}</Link>
          <Link href="/seller" className="nav-seller">
            <Store size={16} />
            {t("nav.sellerCenter")}
          </Link>
        </div>
      </nav>
    </header>
  );
}
