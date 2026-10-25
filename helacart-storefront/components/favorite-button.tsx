"use client";
import { Heart, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { rememberFavorite } from "@/lib/favorites";
import { useFavorites } from "./favorites-provider";
import { useShop } from "./shop-provider";
import s from "./favorites.module.css";
export function FavoriteButton({
  productId,
  title,
  withLabel = false,
}: {
  productId: string;
  title: string;
  withLabel?: boolean;
}) {
  const router = useRouter(),
    { user, isPreview, authReady } = useShop(),
    favorites = useFavorites();
  const saved = favorites.items.find((item) => item.productId === productId),
    busy = favorites.isPending(productId) || favorites.loading;
  function toggle() {
    if (!user && !isPreview) {
      rememberFavorite(productId);
      const next = `/products/${encodeURIComponent(productId)}`;
      router.push(`/auth?next=${encodeURIComponent(next)}`);
      return;
    }
    void (saved ? favorites.remove(saved.id) : favorites.save(productId)).catch(
      () => undefined,
    );
  }
  return (
    <button
      type="button"
      className={`${s.heart} ${saved ? s.saved : ""} ${withLabel ? s.withLabel : ""}`}
      aria-pressed={Boolean(saved)}
      aria-label={`${saved ? "Remove" : "Save"} ${title} ${saved ? "from" : "to"} favorites`}
      title={saved ? "Remove from favorites" : "Save to favorites"}
      disabled={!authReady || favorites.loading || busy}
      aria-busy={busy}
      onClick={toggle}
    >
      {busy ? (
        <LoaderCircle size={19} className={s.spinner} />
      ) : (
        <Heart
          size={20}
          fill={saved ? "currentColor" : "none"}
          aria-hidden="true"
        />
      )}
      {withLabel && (
        <span>{saved ? "Saved to favorites" : "Save to favorites"}</span>
      )}
    </button>
  );
}
