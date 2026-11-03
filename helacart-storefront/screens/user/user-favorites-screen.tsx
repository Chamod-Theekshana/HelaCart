"use client";
import { FavoriteAlertSettings } from "@/components/favorite-alert-settings";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Heart, Package, Trash2 } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { demoProducts } from "@/lib/demo";
import type { FavoriteItem } from "@/lib/favorites";
import { pageOf, type Page } from "@/lib/shops";
import { useShop } from "@/components/shop-provider";
import { useFavorites } from "@/components/favorites-provider";
import { ProductCard } from "@/components/product-card";
import { StorefrontImage } from "@/components/storefront-image";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ListPagination } from "@/components/list-controls";
import s from "@/components/favorites.module.css";

export default function UserFavoritesScreen() {
  const { user, authReady, isPreview } = useShop(),
    favorites = useFavorites();
  const [page, setPage] = useState(1),
    [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    key: string;
    data: Page<FavoriteItem> | null;
    error: string;
  } | null>(null);
  const scope = user?.uid || "",
    key = `${scope}:${page}:${favorites.revision}:${attempt}`;
  useEffect(() => {
    if (isPreview || !user) return;
    let active = true;
    user
      .getIdToken()
      .then((token) =>
        api<Page<FavoriteItem>>(`/me/favorites?page=${page}&limit=12`, {
          token,
        }),
      )
      .then((data) => {
        if (!active) return;
        if (page > data.pages) {
          setPage(data.pages);
          return;
        }
        setState({ key, data, error: "" });
      })
      .catch((error) => {
        if (active) setState({ key, data: null, error: errorMessage(error) });
      });
    return () => {
      active = false;
    };
  }, [user, isPreview, key, page]);
  const previewItems: FavoriteItem[] = isPreview
    ? favorites.items.flatMap((ref) => {
        const product = demoProducts.find((p) => p.id === ref.productId);
        return product
          ? [
              {
                ...ref,
                createdAt: "",
                title: product.title,
                sellerName: product.seller.name,
                imageUrl: product.imageUrls[0] || null,
                product,
              },
            ]
          : [];
      })
    : [];
  const data = isPreview
      ? pageOf(previewItems, page, 12)
      : state?.key === key
        ? state.data
        : null,
    error = state?.key === key ? state.error : "";
  const loading =
    !isPreview && (!authReady || Boolean(user && state?.key !== key));
  const count = data?.total;
  return (
    <div className={`container ${s.page}`}>
      <Breadcrumbs
        items={[
          { label: "My Account", href: "/account" },
          { label: "My Favorites" },
        ]}
      />
      <div className={s.heading}>
        <div>
          <span className="section-kicker">KEEP THE GOOD FINDS</span>
          <h1>My Favorites{count !== undefined && <span>{count}</span>}</h1>
          <p>Your saved products, ready when you are.</p>
        </div>
        <Link className="text-link" href="/products">
          Continue shopping
          <ArrowRight size={16} />
        </Link>
      </div>
      {loading ? (
        <div className={s.empty} role="status">
          Loading your favorites…
        </div>
      ) : !isPreview && !user ? (
        <div className={s.empty}>
          <Heart size={38} />
          <h2>A place for your favorites</h2>
          <p>Sign in to save products and find them again on any device.</p>
          <Link className="primary-btn" href="/auth?next=%2Ffavorites">
            Sign in to save favorites
          </Link>
        </div>
      ) : error ? (
        <div className={s.empty} role="alert">
          <h2>We couldn&apos;t load your favorites.</h2>
          <p>{error}</p>
          <button
            className="primary-btn"
            onClick={() => {
              setAttempt((old) => old + 1);
              void favorites.refresh().catch(() => undefined);
            }}
          >
            Try again
          </button>
        </div>
      ) : data?.items.length ? (
        <>
          <div className={s.grid}>
            {data.items.map((item) => (
              <div key={item.id} className={s.item}>
                {item.product ? (
                  <ProductCard product={item.product} />
                ) : (
                  <article className={s.unavailable}>
                    <div className={s.unavailablePhoto}>
                      <StorefrontImage
                        src={item.imageUrl}
                        alt={item.title}
                        fallback={<Package size={34} />}
                      />
                    </div>
                    <div>
                      <small>{item.sellerName}</small>
                      <h2>{item.title}</h2>
                      <span className={s.unavailableLabel}>Unavailable</span>
                      <p>
                        This product is no longer listed. You can remove it from
                        your favorites.
                      </p>
                    </div>
                  </article>
                )}
                <FavoriteAlertSettings
                  key={`${item.id}:${item.alertVersion}`}
                  item={item}
                  onSaved={() => setAttempt((v) => v + 1)}
                />
                <button
                  className={s.remove}
                  disabled={favorites.isPending(item.productId || item.id)}
                  onClick={() =>
                    void favorites.remove(item.id).catch(() => undefined)
                  }
                >
                  <Trash2 size={15} />
                  Remove from favorites
                </button>
              </div>
            ))}
          </div>
          <ListPagination
            data={data}
            onPage={setPage}
            label="Favorites pages"
          />
        </>
      ) : (
        <div className={s.empty}>
          <Heart size={38} />
          <h2>Your next favorite is waiting.</h2>
          <p>
            Tap the heart on a product to save it here. Saved items stay in your
            list when they sell out.
          </p>
          <Link className="primary-btn" href="/products">
            Explore products
            <ArrowRight size={16} />
          </Link>
        </div>
      )}
    </div>
  );
}
