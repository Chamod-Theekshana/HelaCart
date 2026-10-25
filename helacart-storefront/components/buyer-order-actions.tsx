"use client";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { useShop } from "./shop-provider";
import s from "./list-controls.module.css";
export function BuyerCancelOrder({
  orderId,
  sellerOrderId,
  sellerName,
  onChanged,
}: {
  orderId: string;
  sellerOrderId: string;
  sellerName: string;
  onChanged: () => void;
}) {
  const { user, isPreview } = useShop();
  const [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function cancel() {
    if (!user || isPreview) return;
    setBusy(true);
    setError("");
    try {
      await api(`/me/orders/${orderId}/seller-orders/${sellerOrderId}/cancel`, {
        method: "PATCH",
        token: await user.getIdToken(),
      });
      setConfirm(false);
      onChanged();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={s.actions}>
      {!confirm ? (
        <button
          className="outline-btn"
          disabled={isPreview}
          onClick={() => setConfirm(true)}
        >
          Cancel seller order
        </button>
      ) : (
        <div className={s.confirm}>
          <strong>Cancel this seller order?</strong>
          <p>
            Items from {sellerName} will be cancelled and released back to
            stock. Other sellers in the order stay unchanged. Cancellation is
            available before the seller accepts it.
          </p>
          <div className={s.actions}>
            <button
              className="primary-btn"
              disabled={busy}
              onClick={() => void cancel()}
            >
              {busy ? "Cancelling…" : "Confirm cancellation"}
            </button>
            <button
              className="outline-btn"
              disabled={busy}
              onClick={() => {
                setConfirm(false);
                setError("");
              }}
            >
              Keep order
            </button>
          </div>
          {error && (
            <p role="alert">
              {error}
              <button className={s.retry} onClick={onChanged}>
                Refresh order
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
