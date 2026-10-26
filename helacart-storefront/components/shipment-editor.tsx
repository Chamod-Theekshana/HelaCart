"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { errorMessage } from "@/lib/api";
import type { SellerOrderRecord } from "@/lib/seller";
import type { FinanceRequest } from "@/lib/commission";
import styles from "./delivery-workspace.module.css";
export function ShipmentEditor({
  order,
  sellerId,
  request,
  onSaved,
  onClose,
}: {
  order: SellerOrderRecord;
  sellerId: string;
  request: FinanceRequest;
  onSaved: () => Promise<void>;
  onClose: () => void;
}) {
  const dispatch = order.status === "PACKED",
    dialog = useRef<HTMLDialogElement>(null),
    operation = useRef(false);
  const [courier, setCourier] = useState(order.shipment?.courierName ?? ""),
    [reference, setReference] = useState(order.shipment?.trackingNumber ?? ""),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      await request(
        `/sellers/${sellerId}/orders/${order.id}/${dispatch ? "status" : "shipment"}`,
        "PATCH",
        dispatch
          ? {
              status: "SHIPPED",
              courierName: courier.trim(),
              trackingNumber: reference.trim(),
            }
          : {
              version: order.shipment?.version ?? 0,
              courierName: courier.trim(),
              trackingNumber: reference.trim(),
              reason: reason.trim(),
            },
      );
      await onSaved();
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
    >
      <form onSubmit={(e) => void save(e)} className={styles.form}>
        <div className={styles.heading}>
          <h2>{dispatch ? "Dispatch order" : "Update tracking"}</h2>
          <button
            type="button"
            className="outline-btn"
            onClick={onClose}
            disabled={busy}
            aria-label="Close shipment form"
          >
            <X size={18} />
          </button>
        </div>
        <p>
          Order #{order.id.slice(0, 8).toUpperCase()} · {order.order.recipient}
        </p>
        <fieldset disabled={busy}>
          <label>
            Courier or delivery service
            <input
              required
              minLength={2}
              maxLength={100}
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
              placeholder="Courier name or your shop’s own delivery"
            />
          </label>
          <label>
            Tracking reference (optional)
            <input
              maxLength={100}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
            <small>
              Leave blank if your delivery service does not provide one.
            </small>
          </label>
          {!dispatch && (
            <label>
              Reason for this correction
              <textarea
                required
                minLength={10}
                maxLength={500}
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          )}
          <p className={styles.muted}>
            {dispatch
              ? "Dispatching marks this order shipped and notifies the buyer."
              : "The buyer is notified. The original dispatch date is preserved."}
          </p>
          <button type="submit" className="primary-btn">
            {busy
              ? "Saving…"
              : dispatch
                ? "Mark shipped & notify buyer"
                : "Save tracking & notify buyer"}
          </button>
        </fieldset>
        {error && (
          <div className="message error" role="alert">
            {error}
          </div>
        )}
      </form>
    </dialog>
  );
}
