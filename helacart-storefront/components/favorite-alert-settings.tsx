"use client";
import { useState } from "react";
import Link from "next/link";
import { api, errorMessage } from "@/lib/api";
import type { FavoriteItem } from "@/lib/favorites";
import { useShop } from "./shop-provider";
import s from "./discovery.module.css";
export function FavoriteAlertSettings({
  item,
  onSaved,
}: {
  item: FavoriteItem;
  onSaved: () => void;
}) {
  const { user, isPreview } = useShop();
  const [price, setPrice] = useState(item.priceAlerts ?? false);
  const [stock, setStock] = useState(item.restockAlerts ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  if (isPreview) return null;
  if (!user?.emailVerified)
    return (
      <p className={s.notice}>
        <Link href="/account/security">Verify your email</Link> to enable
        favorite alerts.
      </p>
    );
  return (
    <div className={s.alertBox}>
      <strong>Alerts for this favorite</strong>
      <label>
        <input
          type="checkbox"
          checked={price}
          disabled={busy}
          onChange={(e) => {
            setPrice(e.target.checked);
            setSaved(false);
          }}
        />
        Price drops
      </label>
      <label>
        <input
          type="checkbox"
          checked={stock}
          disabled={busy}
          onChange={(e) => {
            setStock(e.target.checked);
            setSaved(false);
          }}
        />
        Back in stock
      </label>
      <button
        className="outline-btn"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await api(`/me/favorites/${item.id}/alerts`, {
              method: "PATCH",
              token: await user.getIdToken(),
              body: {
                version: item.alertVersion ?? 0,
                priceAlerts: price,
                restockAlerts: stock,
              },
            });
            setSaved(true);
            onSaved();
          } catch (error) {
            setError(errorMessage(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Saving…" : "Save alerts"}
      </button>
      {saved && <small role="status">Alert preferences saved.</small>}
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
