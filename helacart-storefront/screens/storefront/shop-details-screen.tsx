/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, MapPin, Package, Truck } from "lucide-react";
import { api, ApiError, hasApi, money } from "@/lib/api";
import {
  pageOf,
  previewReviews,
  previewShops,
  previewShopProducts,
  shopDate,
  shopPath,
  type Page,
  type PublicShop,
  type ReviewsPage,
} from "@/lib/shops";
import { rupeesToMinor } from "@/lib/seller";
import type { Product } from "@/lib/types";
import { ProductCard } from "@/components/product-card";
import { Pagination, ShopLogo, Stars } from "@/components/shop-ui";
import { ShopReviews } from "@/components/shop-reviews";
import { VerifiedShopBadge } from "@/components/verified-shop-badge";
import s from "@/components/shop.module.css";
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `${slug.replaceAll("-", " ")} | Shop`,
    description:
      "Explore this seller's products and verified customer reviews on HelaCart.",
  };
}
export default async function ShopPage({ params, searchParams }: Props) {
  const [{ slug }, paramsQuery] = await Promise.all([params, searchParams]);
  const value = (name: string) =>
    typeof paramsQuery[name] === "string" ? (paramsQuery[name] as string) : "";
  const q = value("q").slice(0, 80),
    category = value("category").slice(0, 80);
  const sort = ["newest", "price-asc", "price-desc", "name"].includes(
    value("sort"),
  )
    ? value("sort")
    : "newest";
  const page = /^\d+$/.test(value("page"))
    ? Math.max(1, Math.min(10000, Number(value("page"))))
    : 1;
  const min = value("min"),
    max = value("max");
  const minPrice = min ? rupeesToMinor(min) : null,
    maxPrice = max ? rupeesToMinor(max) : null;
  const invalidPrice = Boolean(
    (min && (minPrice === null || minPrice > 1e9)) ||
    (max && (maxPrice === null || maxPrice > 1e9)) ||
    (minPrice !== null && maxPrice !== null && minPrice > maxPrice),
  );
  const query = new URLSearchParams({ q, sort, page: String(page) });
  if (category) query.set("category", category);
  if (minPrice !== null) query.set("minPrice", String(minPrice));
  if (maxPrice !== null) query.set("maxPrice", String(maxPrice));
  let shop: PublicShop | undefined;
  try {
    shop = hasApi
      ? await api<PublicShop>(`/shops/${encodeURIComponent(slug)}`)
      : previewShops.find((row) => row.slug === slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    return (
      <div className={`container ${s.page}`}>
        <div className={s.error}>
          This shop could not be loaded. Please try again.{" "}
          <Link href="/shops">Explore shops</Link>
        </div>
      </div>
    );
  }
  if (!shop) notFound();
  let products: Page<Product> | null = null,
    reviews: ReviewsPage | null = null;
  [products, reviews] = await Promise.all([
    invalidPrice
      ? Promise.resolve(null)
      : hasApi
        ? api<Page<Product>>(
            `/shops/${encodeURIComponent(slug)}/products?${query}`,
          ).catch(() => null)
        : Promise.resolve(previewShopProducts(slug, query)),
    hasApi
      ? api<ReviewsPage>(`/shops/${encodeURIComponent(slug)}/reviews`).catch(
          () => null,
        )
      : Promise.resolve({ ...pageOf(previewReviews), summary: shop.rating }),
  ]);
  const path = shopPath(shop);
  return (
    <div className={`container ${s.page}`}>
      <div className={s.breadcrumb}>
        <Link href="/shops">Shops</Link>
        <ChevronRight size={14} />
        <span>{shop.name}</span>
      </div>
      {!hasApi && (
        <div className={s.notice}>
          Design preview · This shop, its products and reviews are sample data.
        </div>
      )}
      <section className={s.hero}>
        <div className={s.cover}>
          {shop.coverUrl && (
            <img src={shop.coverUrl} alt="" fetchPriority="high" />
          )}
        </div>
        <div className={s.heroBody}>
          <ShopLogo shop={shop} />
          <div className={s.heroCopy}>
            <h1>{shop.name}</h1>
            {shop.isVerified && <VerifiedShopBadge />}
            <div className={s.meta}>
              {shop.publicLocation && (
                <span>
                  <MapPin size={14} />
                  {shop.publicLocation}
                </span>
              )}
              <span>
                <Package size={14} />
                {shop.productCount} products
              </span>
              <span>
                Joined{" "}
                {new Date(shop.createdAt).toLocaleDateString("en-LK", {
                  month: "short",
                  year: "numeric",
                  timeZone: "Asia/Colombo",
                })}
              </span>
            </div>
          </div>
          <a href="#reviews" className={s.heroRating}>
            {shop.rating.total ? (
              <>
                <span>
                  <strong>{shop.rating.average.toFixed(1)}</strong> / 5
                </span>
                <Stars rating={shop.rating.average} />
                <span>
                  {shop.rating.total} buyer{" "}
                  {shop.rating.total === 1 ? "review" : "reviews"}
                </span>
              </>
            ) : (
              <>
                <Stars rating={0} />
                <span>No reviews yet</span>
              </>
            )}
          </a>
        </div>
        <nav className={s.tabs} aria-label="Shop sections">
          <a href="#products">Products</a>
          <a href="#reviews">Reviews ({shop.rating.total})</a>
          <a href="#about">About the shop</a>
        </nav>
      </section>
      <section id="products" className={s.section}>
        <div className={s.sectionHeading}>
          <div>
            <h2>Find your next favourite</h2>
            <p>Explore products from {shop.name}</p>
          </div>
        </div>
        <form action={`${path}#products`} className={s.filters}>
          <label>
            Search this shop
            <input
              name="q"
              defaultValue={q}
              maxLength={80}
              placeholder="What are you looking for?"
            />
          </label>
          <label>
            Category
            <select name="category" defaultValue={category}>
              <option value="">All categories</option>
              {shop.categories.map((row) => (
                <option key={row.id} value={row.slug}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <div className={s.priceRange}>
            <label>
              Min (Rs.)
              <input
                name="min"
                type="number"
                min="0"
                max="10000000"
                step="0.01"
                defaultValue={min}
                placeholder="0"
              />
            </label>
            <label>
              Max (Rs.)
              <input
                name="max"
                type="number"
                min="0"
                max="10000000"
                step="0.01"
                defaultValue={max}
                placeholder="Any"
              />
            </label>
          </div>
          <label>
            Sort by
            <select name="sort" defaultValue={sort}>
              <option value="newest">Newest first</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="name">Product name</option>
            </select>
          </label>
          <div className={s.filterActions}>
            <button className="primary-btn">Apply filters</button>
            <Link href={`${path}#products`}>Clear filters</Link>
            {products && <span>{products.total} products</span>}
          </div>
        </form>
        {invalidPrice ? (
          <div className={s.notice}>
            Enter valid prices with a maximum price greater than or equal to the
            minimum.
          </div>
        ) : !products ? (
          <div className={s.error}>
            Products could not be loaded. Please try again.
          </div>
        ) : products.items.length ? (
          <>
            <div className={s.products}>
              {products.items.map((row) => (
                <ProductCard key={row.id} product={row} />
              ))}
            </div>
            <Pagination
              page={products.page}
              pages={products.pages}
              href={(next) =>
                `${path}?${new URLSearchParams({ q, category, sort, min, max, page: String(next) })}#products`
              }
            />
          </>
        ) : (
          <div className={s.empty}>
            No products match these filters.{" "}
            <Link href={`${path}#products`}>View all products</Link>
          </div>
        )}
      </section>
      <ShopReviews key={slug} shop={shop} initial={reviews} />
      <section id="about" className={`${s.section} ${s.about}`}>
        <div>
          <span className="section-kicker">A LITTLE ABOUT US</span>
          <h2>Welcome to {shop.name}</h2>
          <p>
            {shop.description ||
              "This seller has not added a shop description yet. Explore their products and hear from their customers above."}
          </p>
        </div>
        <div>
          <h3>
            <Truck size={17} /> Shopping information
          </h3>
          <dl>
            <dt>Standard delivery fee</dt>
            <dd>
              {shop.shippingFeeLkrMinor == null
                ? "See at checkout"
                : shop.shippingFeeLkrMinor === 0
                  ? "Standard delivery is free"
                  : money(shop.shippingFeeLkrMinor)}
            </dd>
            <dt>Destination rates</dt>
            <dd>Final delivery fee and availability are confirmed for your address at checkout.</dd>
            <dt>Payment</dt>
            <dd>Cash on delivery</dd>
            <dt>On HelaCart since</dt>
            <dd>{shopDate(shop.createdAt)}</dd>
          </dl>
        </div>
      </section>
    </div>
  );
}
