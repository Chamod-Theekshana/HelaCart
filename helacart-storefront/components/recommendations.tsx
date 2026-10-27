"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Product } from "@/lib/types";
import { useShop } from "./shop-provider";
import { ProductCard } from "./product-card";
import s from "./discovery.module.css";
export function Recommendations({ productId }: { productId?: string }) {
  const { user, isPreview } = useShop();
  return (
    <RecommendationContent
      key={`${user?.uid}:${productId}`}
      productId={productId}
      isPreview={isPreview}
    />
  );
}
function RecommendationContent({
  productId,
  isPreview,
}: {
  productId?: string;
  isPreview: boolean;
}) {
  const { user } = useShop();
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<Product[] | null>(null);
  const [error, setError] = useState(false);
  const [basis, setBasis] = useState("RECENT_DELIVERED_POPULARITY");
  useEffect(() => {
    if (isPreview) return;
    let active = true;
    const path = productId
      ? `/discovery/recommendations?productId=${productId}&limit=4`
      : user
        ? "/me/recommendations?limit=4"
        : "/discovery/recommendations?limit=4";
    (async () => {
      try {
        const result = await api<{ items: Product[]; basis: string }>(path, {
          ...(user && !productId ? { token: await user.getIdToken() } : {}),
        });
        if (active) {
          setData(result.items);
          setBasis(result.basis);
          setError(false);
        }
      } catch {
        if (active) setError(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [productId, user, isPreview, attempt]);
  if (isPreview || data?.length === 0) return null;
  return (
    <section className={s.recommendations}>
      <span className="section-kicker">MORE GOOD FINDS</span>
      <h2>
        {productId
          ? "You may also like"
          : basis === "YOUR_FAVORITE_CATEGORIES"
            ? "Inspired by your favorites"
            : "Discover more"}
      </h2>
      <p>
        {productId
          ? "Available products with related categories."
          : basis === "YOUR_FAVORITE_CATEGORIES"
            ? "Suggestions from your saved categories, with popular available products."
            : "Available products ranked by recent delivered purchases."}
      </p>
      {error ? (
        <div className={s.notice}>
          We couldn’t load suggestions.{" "}
          <button
            className="outline-btn"
            onClick={() => setAttempt((v) => v + 1)}
          >
            Try again
          </button>
        </div>
      ) : data ? (
        <div className={s.recommendGrid}>
          {data.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <p role="status">Finding products for you…</p>
      )}
    </section>
  );
}
