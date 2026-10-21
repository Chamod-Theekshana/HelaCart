/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ArrowRight, MapPin, Star, Store } from "lucide-react";
import { shopPath, type PublicShop } from "@/lib/shops";
import s from "./shop.module.css";

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
      {shop.logoUrl ? (
        <img src={shop.logoUrl} alt={`${shop.name} logo`} />
      ) : (
        shop.name.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}
export function ShopCard({ shop }: { shop: PublicShop }) {
  return (
    <Link href={shopPath(shop)} className={s.shopCard}>
      <div className={s.cardCover}>
        {shop.coverUrl ? (
          <img src={shop.coverUrl} alt="" loading="lazy" />
        ) : (
          <Store size={55} strokeWidth={1} />
        )}
      </div>
      <div className={s.cardBody}>
        <ShopLogo shop={shop} />
        <h2>{shop.name}</h2>
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
          <span>
            Visit shop <ArrowRight size={15} />
          </span>
        </div>
      </div>
    </Link>
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
