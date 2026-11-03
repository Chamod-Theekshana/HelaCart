"use client";
import Link from "next/link";
import { Banknote, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { Brand } from "./site-header";
import { LanguageSwitcher } from "./language-switcher";
import { useT } from "./language-provider";

export function TrustStrip() {
  const t = useT();
  return (
    <div className="trust-strip">
      <div className="container trust-grid">
        <div>
          <span className="trust-icon">
            <Truck size={21} />
          </span>
          <span>
            <strong>{t("trust.local.title")}</strong>
            <small>{t("trust.local.text")}</small>
          </span>
        </div>
        <div>
          <span className="trust-icon">
            <Banknote size={21} />
          </span>
          <span>
            <strong>{t("trust.cod.title")}</strong>
            <small>{t("trust.cod.text")}</small>
          </span>
        </div>
        <div>
          <span className="trust-icon">
            <ShieldCheck size={21} />
          </span>
          <span>
            <strong>{t("trust.clear.title")}</strong>
            <small>{t("trust.clear.text")}</small>
          </span>
        </div>
        <div>
          <span className="trust-icon">
            <PackageCheck size={21} />
          </span>
          <span>
            <strong>{t("trust.orders.title")}</strong>
            <small>{t("trust.orders.text")}</small>
          </span>
        </div>
      </div>
    </div>
  );
}

export function SiteFooter({ showTrust = true }: { showTrust?: boolean }) {
  const t = useT();
  return (
    <>
      {showTrust && <TrustStrip />}
      <footer className="site-footer">
        <div className="container footer-columns">
          <div className="footer-about">
            <Brand />
            <p>{t("footer.about")}</p>
            <LanguageSwitcher className="footer-language" />
          </div>
          <div>
            <strong>{t("footer.shopping")}</strong>
            <Link href="/products">{t("footer.shopAll")}</Link>
            <Link href="/#categories">{t("nav.categories")}</Link>
            <Link href="/products?sort=newest">{t("footer.newArrivals")}</Link>
          </div>
          <div>
            <strong>{t("footer.shops")}</strong>
            <Link href="/shops">{t("footer.discoverShops")}</Link>
            <Link href="/seller">{t("nav.sellerCenter")}</Link>
            <Link href="/seller/apply">{t("footer.openShop")}</Link>
          </div>
          <div>
            <strong>{t("footer.account")}</strong>
            <Link href="/account/profile">{t("footer.profile")}</Link>
            <Link href="/favorites">{t("footer.favorites")}</Link>
            <Link href="/orders">{t("footer.trackOrder")}</Link>
            <Link href="/account/returns">{t("footer.returns")}</Link>
            <Link href="/#how-it-works">{t("footer.help")}</Link>
          </div>
          <div>
            <strong>{t("footer.legal")}</strong>
            <Link href="/legal/privacy">{t("legal.privacy.title")}</Link>
            <Link href="/legal/terms">{t("legal.terms.title")}</Link>
            <Link href="/legal/returns">{t("legal.returns.title")}</Link>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>
            {t("footer.copyright", { year: new Date().getUTCFullYear() })}
          </span>
          <span>
            {t("footer.country")} <span aria-hidden="true">·</span> LKR{" "}
            <span aria-hidden="true">·</span> {t("trust.cod.title")}
          </span>
        </div>
      </footer>
    </>
  );
}
