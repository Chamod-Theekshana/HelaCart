import Link from "next/link";
import { ArrowRight, MapPin, Star, Store } from "lucide-react";
import { shopPath, type PublicShop } from "@/lib/shops";
import s from "./shop.module.css";
import { StorefrontImage } from "./storefront-image";
import { VerifiedShopBadge } from "./verified-shop-badge";
import compactStyles from "./storefront-shop-card.module.css";

export function Stars({ rating }: { rating: number }) {
  return (
    <span className={s.stars} aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          size={15}
          fill={value <= Math.round(rating) ? "currentColor" : "none"}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}
export function ShopLogo({
  shop,
}: {
  shop: Pick<PublicShop, "name" | "logoUrl">;
}) {
  return (
    <span className={s.logo}>
      <StorefrontImage
        src={shop.logoUrl}
        alt={`${shop.name} logo`}
        fallback={shop.name.slice(0, 1).toUpperCase()}
      />
    </span>
  );
}
export function ShopCard({
  shop,
  compact = false,
}: {
  shop: PublicShop;
  compact?: boolean;
}) {
  if (compact)
    return (
      <article className={compactStyles.card}>
        <div className={compactStyles.identity}>
          <ShopLogo shop={shop} />
          <div>
            <h3>
              <Link href={shopPath(shop)}>{shop.name}</Link>
            </h3>
            <p>
              <MapPin size={12} />
              {shop.publicLocation || "Sri Lankan seller"}
            </p>
          </div>
        </div>
        <div className={compactStyles.reputation}>
          {shop.isVerified && <VerifiedShopBadge />}
          {shop.rating.total ? (
            <span className={compactStyles.rating}>
              <Star size={14} fill="currentColor" />
              <b>{shop.rating.average.toFixed(1)}</b>
              <small>
                ({shop.rating.total}{" "}
                {shop.rating.total === 1 ? "review" : "reviews"})
              </small>
            </span>
          ) : (
            <small>No reviews yet</small>
          )}
        </div>
        <p className={compactStyles.description}>
          {shop.description ||
            `Discover ${shop.productCount} ${shop.productCount === 1 ? "product" : "products"} from this independent shop.`}
        </p>
        <Link className={compactStyles.visit} href={shopPath(shop)}>
          Visit shop
          <ArrowRight size={14} />
        </Link>
      </article>
    );
  return (
    <article className={s.shopCard}>
      <Link
        href={shopPath(shop)}
        className={s.cardCover}
        aria-label={`Visit ${shop.name}`}
      >
        <StorefrontImage
          src={shop.coverUrl}
          alt=""
          fallback={<Store size={55} strokeWidth={1} />}
        />
      </Link>
      <div className={s.cardBody}>
        <ShopLogo shop={shop} />
        <h2>
          <Link href={shopPath(shop)}>{shop.name}</Link>
        </h2>
        {shop.isVerified && <VerifiedShopBadge />}
        <p>
          <MapPin size={14} />
          {shop.publicLocation || "Sri Lankan seller"}
        </p>
        <span className={s.ratingLine}>
          {shop.rating.total ? (
            <>
              <Stars rating={shop.rating.average} />
              <b>{shop.rating.average.toFixed(1)}</b>
              <small>({shop.rating.total})</small>
            </>
          ) : (
            <small>No reviews yet</small>
          )}
        </span>
        <div className={s.cardFoot}>
          <span>
            {shop.productCount}{" "}
            {shop.productCount === 1 ? "product" : "products"}
          </span>
          <Link href={shopPath(shop)}>
            Visit shop <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </article>
  );
}
export function Pagination({
  page,
  pages,
  href,
}: {
  page: number;
  pages: number;
  href: (page: number) => string;
}) {
  return pages > 1 ? (
    <nav className={s.pagination} aria-label="Pagination">
      {page > 1 && (
        <Link className="outline-btn" href={href(page - 1)}>
          Previous
        </Link>
      )}
      <span>
        Page {page} of {pages}
      </span>
      {page < pages && (
        <Link className="outline-btn" href={href(page + 1)}>
          Next
        </Link>
      )}
    </nav>
  ) : null;
}
