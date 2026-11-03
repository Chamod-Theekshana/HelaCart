"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PackageCheck } from "lucide-react";
import { ApiError, errorMessage, userApi } from "@/lib/api";
import { useShop } from "./shop-provider";
import { useT } from "./language-provider";
import s from "./list-controls.module.css";

/** Friendly text when the seller order changed status in the meantime. */
function orderError(cause: unknown, transition: string) {
  return cause instanceof ApiError &&
    cause.code === "ORDER_TRANSITION_NOT_ALLOWED"
    ? transition
    : errorMessage(cause);
}

/** Buyer cancellation of a PLACED seller order with an optional reason (§1.3). */
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
  const t = useT();
  const { user, isPreview } = useShop();
  const [confirm, setConfirm] = useState(false),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function cancel(event: FormEvent) {
    event.preventDefault();
    if (!user || isPreview || busy) return;
    const note = reason.trim();
    if (note && (note.length < 5 || note.length > 500)) {
      setError(t("orders.cancel.reasonLength"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await userApi(
        user,
        `/me/orders/${orderId}/seller-orders/${sellerOrderId}/cancel`,
        { method: "PATCH", ...(note ? { body: { reason: note } } : {}) },
      );
      setConfirm(false);
      onChanged();
    } catch (cause) {
      setError(orderError(cause, t("orders.error.transition")));
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
          {t("orders.cancel.button")}
        </button>
      ) : (
        <form className={s.confirm} onSubmit={(event) => void cancel(event)}>
          <strong>{t("orders.cancel.title")}</strong>
          <p>{t("orders.cancel.text", { seller: sellerName })}</p>
          <label className="hc-field">
            {t("orders.cancel.reason")}
            <textarea
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t("orders.cancel.reasonPlaceholder")}
            />
          </label>
          <div className={s.actions}>
            <button className="primary-btn" disabled={busy} type="submit">
              {busy ? t("orders.cancel.busy") : t("orders.cancel.confirm")}
            </button>
            <button
              className="outline-btn"
              type="button"
              disabled={busy}
              onClick={() => {
                setConfirm(false);
                setError("");
              }}
            >
              {t("orders.cancel.keep")}
            </button>
          </div>
          {error && (
            <p role="alert">
              {error}
              <button type="button" className={s.retry} onClick={onChanged}>
                {t("orders.refresh")}
              </button>
            </p>
          )}
        </form>
      )}
    </div>
  );
}

/** "I received this order" for a SHIPPED seller order (§1.4). */
export function BuyerConfirmReceipt({
  orderId,
  sellerOrderId,
  sellerName,
  total,
  onChanged,
}: {
  orderId: string;
  sellerOrderId: string;
  sellerName: string;
  total: string;
  onChanged: () => void;
}) {
  const t = useT();
  const { user, isPreview } = useShop();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  async function confirm() {
    if (!user || isPreview || busy) return;
    setBusy(true);
    setError("");
    try {
      await userApi(
        user,
        `/me/orders/${orderId}/seller-orders/${sellerOrderId}/confirm-receipt`,
        { method: "POST", body: {} },
      );
      setOpen(false);
      onChanged();
    } catch (cause) {
      setError(orderError(cause, t("orders.error.transition")));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="primary-btn"
        disabled={isPreview}
        onClick={() => setOpen(true)}
      >
        <PackageCheck size={16} /> {t("orders.receipt.button")}
      </button>
      <dialog
        ref={dialog}
        className="hc-dialog"
        aria-labelledby={`receipt-${sellerOrderId}`}
        onCancel={(event) => {
          event.preventDefault();
          if (!busy) setOpen(false);
        }}
      >
        <div>
          <h2 id={`receipt-${sellerOrderId}`}>{t("orders.receipt.title")}</h2>
          <p>{t("orders.receipt.text", { seller: sellerName, total })}</p>
          {error && (
            <div className="message error" role="alert">
              {error}
            </div>
          )}
          <div className="inline-actions">
            <button
              className="primary-btn"
              disabled={busy}
              onClick={() => void confirm()}
            >
              {busy ? t("common.pleaseWait") : t("orders.receipt.confirm")}
            </button>
            <button
              className="outline-btn"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              {t("orders.receipt.notYet")}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
