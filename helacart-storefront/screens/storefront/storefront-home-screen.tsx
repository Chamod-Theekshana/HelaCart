import { Recommendations } from "@/components/recommendations";
import Link from "next/link";
import { ArrowRight, ChevronDown, PackageCheck, Store } from "lucide-react";
import { api, hasApi } from "@/lib/api";
import { getT } from "@/lib/i18n/server";
import { demoCategories, demoProducts } from "@/lib/demo";
import type { Category, Product } from "@/lib/types";
import { pageOf, previewShops, type Page, type PublicShop } from "@/lib/shops";
import {
  categoryHref,
  categoryPresentation,
  categoryFallbackImage,
  collectionFallbackImage,
} from "@/lib/storefront-categories";
import { defaultHero, type HeroContent } from "@/lib/storefront-content";
import { ProductCard } from "@/components/product-card";
import { StorefrontHero } from "@/components/storefront-hero";
import { StorefrontRetry } from "@/components/storefront-retry";
import { CategoryArtwork } from "@/components/storefront-category";
import { StorefrontImage } from "@/components/storefront-image";
import { ShopCard } from "@/components/shop-ui";
import s from "@/components/storefront-home.module.css";

export default async function HomePage() {
  let productsFailed = false;
  const [{ t }, list, categories, shops, hero] = await Promise.all([
    getT(),
    hasApi
      ? api<Page<Product>>("/catalog/products?limit=8&sort=newest").catch(
          () => {
            productsFailed = true;
            return pageOf<Product>([], 1, 8);
          },
        )
      : Promise.resolve(pageOf(demoProducts, 1, 8)),
    hasApi
      ? api<Category[]>("/categories").catch(() => [])
      : Promise.resolve(demoCategories),
    hasApi
      ? api<Page<PublicShop>>("/shops?limit=4").catch(() =>
          pageOf<PublicShop>([], 1, 4),
        )
      : Promise.resolve(pageOf(previewShops, 1, 4)),
    hasApi
      ? api<HeroContent>("/storefront/hero").catch(() => defaultHero)
      : Promise.resolve(defaultHero),
  ]);
  const primary =
    categories.find((c) => categoryPresentation(c).family === "pantry") ??
    categories[0];
  const secondary =
    categories.find(
      (c) => c.id !== primary?.id && categoryPresentation(c).family === "home",
    ) ?? categories.find((c) => c.id !== primary?.id);
  const collections = [primary, secondary].filter((c): c is Category =>
    Boolean(c),
  );
  return (
    <div className={s.home}>
      <StorefrontHero hasCategories={categories.length > 0} content={hero} />
      {hasApi && (
        <div className="container">
          <Recommendations />
        </div>
      )}
      {categories.length > 0 && (
        <section
          id="categories"
          className={s.section}
          tabIndex={-1}
          aria-labelledby="categories-heading"
        >
          <div className={s.heading}>
            <h2 id="categories-heading">{t("home.categories")}</h2>
            <Link className={s.moreLink} href="/products">
              {t("home.allCategories")}
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className={s.categoryGrid}>
            {categories.map((category) => (
              <Link
                key={category.id}
                href={categoryHref(category)}
                className={s.categoryTile}
              >
                <span className={s.categoryMedia}>
                  <StorefrontImage
                    src={category.imageUrl || categoryFallbackImage(category)}
                    alt=""
                    className={s.categoryImage}
                    fallback={
                      <CategoryArtwork
                        family={categoryPresentation(category).family}
                      />
                    }
                  />
                </span>
                <span className={s.categoryLabel}>{category.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
      <section className={s.section} aria-labelledby="new-arrivals-heading">
        <div className={s.heading}>
          <h2 id="new-arrivals-heading">{t("home.newArrivals")}</h2>
          <Link className={s.moreLink} href="/products?sort=newest">
            {t("home.browseNew")}
            <ArrowRight size={16} />
          </Link>
        </div>
        {productsFailed ? (
          <div className={s.empty} role="alert">
            <PackageCheck size={28} />
            <h3>{t("home.loadError.title")}</h3>
            <p>{t("home.loadError.text")}</p>
            <StorefrontRetry />
          </div>
        ) : list.items.length ? (
          <div className={s.productGrid}>
            {list.items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className={s.empty}>
            <Store size={28} />
            <h3>{t("home.empty.title")}</h3>
            <p>{t("home.empty.text")}</p>
            <Link className="outline-btn" href="/shops">
              {t("hero.discoverShops")}
            </Link>
          </div>
        )}
      </section>
      {collections.length > 0 && (
        <section
          className={`${s.section} ${s.collections}`}
          aria-label={t("home.collections")}
        >
          {collections.map((category) => {
            const p = categoryPresentation(category);
            return (
              <Link
                key={category.id}
                href={categoryHref(category)}
                className={s.collection}
              >
                <div className={s.collectionCopy}>
                  <span className={s.eyebrow}>{t("home.collection")}</span>
                  <h2>{p.title}</h2>
                  <p>{p.description}</p>
                  <span className={s.moreLink}>
                    {t("home.shopCollection")}
                    <ArrowRight size={16} />
                  </span>
                </div>
                <div className={s.collectionVisual}>
                  <StorefrontImage
                    src={category.imageUrl || collectionFallbackImage(category)}
                    alt=""
                    className={s.collectionPhoto}
                    fallback={<CategoryArtwork family={p.family} large />}
                  />
                </div>
              </Link>
            );
          })}
        </section>
      )}
      {shops.items.length > 0 && (
        <section className={s.section} aria-labelledby="shops-heading">
          <div className={s.heading}>
            <h2 id="shops-heading">{t("hero.discoverShops")}</h2>
            <Link className={s.moreLink} href="/shops">
              {t("home.allShops")}
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className={s.shopGrid}>
            {shops.items.map((shop) => (
              <ShopCard key={shop.id} shop={shop} compact />
            ))}
          </div>
        </section>
      )}
      <section className={s.section} aria-labelledby="sell-heading">
        <div className={s.sellerInvite}>
          <span className={s.sellerIcon}>
            <Store size={25} />
          </span>
          <div>
            <h2 id="sell-heading">{t("home.sell.title")}</h2>
            <p>{t("home.sell.text")}</p>
          </div>
          <Link href="/seller/apply">
            {t("footer.openShop")}
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
      <section
        id="how-it-works"
        className={`${s.section} ${s.help}`}
        aria-labelledby="help-heading"
      >
        <h2 id="help-heading">{t("home.help.title")}</h2>
        <div className={s.answers}>
          <details>
            <summary>
              {t("home.help.codQ")}
              <ChevronDown size={17} />
            </summary>
            <p>{t("home.help.codA")}</p>
          </details>
          <details>
            <summary>
              {t("home.help.shopsQ")}
              <ChevronDown size={17} />
            </summary>
            <p>{t("home.help.shopsA")}</p>
          </details>
          <details>
            <summary>
              {t("home.help.trackQ")}
              <ChevronDown size={17} />
            </summary>
            <p>
              {t("home.help.trackA1")}{" "}
              <Link href="/orders">{t("account.nav.orders")}</Link>{" "}
              {t("home.help.trackA2")}{" "}
              <Link href="/account/returns">{t("account.nav.returns")}</Link>
              {t("home.help.trackA3")}
            </p>
          </details>
        </div>
      </section>
    </div>
  );
}
