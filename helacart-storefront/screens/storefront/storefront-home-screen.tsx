import Link from "next/link";
import { ArrowRight, ChevronDown, PackageCheck, Store } from "lucide-react";
import { api, hasApi } from "@/lib/api";
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
  const [list, categories, shops, hero] = await Promise.all([
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
      {categories.length > 0 && (
        <section
          id="categories"
          className={s.section}
          tabIndex={-1}
          aria-labelledby="categories-heading"
        >
          <div className={s.heading}>
            <h2 id="categories-heading">Shop by category</h2>
            <Link className={s.moreLink} href="/products">
              All categories
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
          <h2 id="new-arrivals-heading">New arrivals</h2>
          <Link className={s.moreLink} href="/products?sort=newest">
            Browse new arrivals
            <ArrowRight size={16} />
          </Link>
        </div>
        {productsFailed ? (
          <div className={s.empty} role="alert">
            <PackageCheck size={28} />
            <h3>Our shelves need a moment.</h3>
            <p>We couldn&apos;t load the products. Please try again.</p>
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
            <h3>Good things are on their way.</h3>
            <p>Discover our shops while they get their shelves ready.</p>
            <Link className="outline-btn" href="/shops">
              Discover shops
            </Link>
          </div>
        )}
      </section>
      {collections.length > 0 && (
        <section
          className={`${s.section} ${s.collections}`}
          aria-label="Explore collections"
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
                  <span className={s.eyebrow}>Collection</span>
                  <h2>{p.title}</h2>
                  <p>{p.description}</p>
                  <span className={s.moreLink}>
                    Shop the collection
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
            <h2 id="shops-heading">Discover shops</h2>
            <Link className={s.moreLink} href="/shops">
              All shops
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
            <h2 id="sell-heading">Sell on HelaCart</h2>
            <p>Open your shop and reach customers across Sri Lanka.</p>
          </div>
          <Link href="/seller/apply">
            Open your shop
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
      <section
        id="how-it-works"
        className={`${s.section} ${s.help}`}
        aria-labelledby="help-heading"
      >
        <h2 id="help-heading">A little help before you shop</h2>
        <div className={s.answers}>
          <details>
            <summary>
              How does cash on delivery work?
              <ChevronDown size={17} />
            </summary>
            <p>
              Choose your products, add a delivery address and review the total.
              Pay when your order arrives.
            </p>
          </details>
          <details>
            <summary>
              Can I buy from different shops?
              <ChevronDown size={17} />
            </summary>
            <p>
              Yes. Each shop handles its part of your order. Delivery is charged
              once per shop and shown before you confirm.
            </p>
          </details>
          <details>
            <summary>
              Where can I track an order or return?
              <ChevronDown size={17} />
            </summary>
            <p>
              Follow deliveries in <Link href="/orders">My orders</Link> and
              eligible return requests in{" "}
              <Link href="/account/returns">My Returns</Link>.
            </p>
          </details>
        </div>
      </section>
    </div>
  );
}
