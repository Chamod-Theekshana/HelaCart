"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, errorMessage } from "@/lib/api";
import {
  pageOf,
  previewReviews,
  previewShops,
  shopPath,
  type PublicShop,
  type ReviewsPage,
} from "@/lib/shops";
import { ShopReviews } from "@/components/shop-reviews";
import { useSeller } from "@/components/seller-provider";
import { SellerPageHeading } from "@/components/seller-ui";
export default function SellerReviewsPage() {
  const { seller, isPreview } = useSeller();
  const [state, setState] = useState<{
    id: string;
    shop: PublicShop | null;
    reviews: ReviewsPage | null;
    error: string;
  }>({ id: "", shop: null, reviews: null, error: "" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!seller || isPreview) return;
    let active = true;
    Promise.all([
      api<PublicShop>(`/shops/${encodeURIComponent(seller.slug)}`),
      api<ReviewsPage>(`/shops/${encodeURIComponent(seller.slug)}/reviews`),
    ])
      .then(([shop, reviews]) => {
        if (active) setState({ id: seller.id, shop, reviews, error: "" });
      })
      .catch((error) => {
        if (active)
          setState({
            id: seller.id,
            shop: null,
            reviews: null,
            error: errorMessage(error),
          });
      });
    return () => {
      active = false;
    };
  }, [seller, isPreview, attempt]);
  const shop = isPreview
    ? (previewShops.find((shop) => shop.slug === seller?.slug) ??
      previewShops[0])
    : state.id === seller?.id
      ? state.shop
      : null;
  return (
    <>
      <SellerPageHeading
        kicker="LISTEN & CONNECT"
        title="Customer reviews"
        description="Read verified buyer feedback and respond as your shop."
        action={
          shop && (
            <Link href={`${shopPath(shop)}#reviews`} className="outline-btn">
              View public reviews
            </Link>
          )
        }
      />
      {shop ? (
        <ShopReviews
          key={shop.id}
          shop={shop}
          initial={
            isPreview
              ? { ...pageOf(previewReviews), summary: shop.rating }
              : state.reviews
          }
        />
      ) : state.error ? (
        <div className="message error" role="alert">
          {state.error}{" "}
          <button onClick={() => setAttempt((value) => value + 1)}>
            Try again
          </button>
        </div>
      ) : (
        <div className="seller-state">Loading customer reviews…</div>
      )}
    </>
  );
}
