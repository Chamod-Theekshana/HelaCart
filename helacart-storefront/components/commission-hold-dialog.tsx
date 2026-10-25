"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { FinanceFeedback } from "./commission-workspace";
import type { CommissionCharge, FinanceRequest } from "@/lib/commission";
import { errorMessage } from "@/lib/api";
import { dateTime } from "@/lib/admin";
import styles from "./commission-workspace.module.css";
export function CommissionHoldDialog({
  charge,
  request,
  onClose,
  onSaved,
}: {
  charge: CommissionCharge;
  request: FinanceRequest;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    operation = useRef(false);
  const [reason, setReason] = useState(""),
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
      await request(`/admin/commission/charges/${charge.id}/hold`, "POST", {
        version: charge.holdVersion ?? 0,
        held: !charge.manualOnHold,
        reason: reason.trim(),
      });
      onSaved();
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
      <form className={styles.form} onSubmit={(e) => void save(e)}>
        <div className={styles.cardHead}>
          <h2>
            {charge.manualOnHold
              ? "Release commission hold"
              : "Hold order commission"}
          </h2>
          <button
            type="button"
            className="outline-btn"
            disabled={busy}
            onClick={onClose}
            aria-label="Close hold form"
          >
            <X size={18} />
          </button>
        </div>
        <p>{charge.orderItem?.productTitle ?? "Original order commission"}</p>
        <p className={styles.muted}>
          This updates all commission items in this shop order. Use a hold for
          unresolved refunds, returns or disputes. A release keeps the original
          due date; open return requests still pause payment.
        </p>
        <fieldset disabled={busy}>
          <label>
            Reason
            <textarea
              required
              minLength={10}
              maxLength={500}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button type="submit" className="primary-btn">
            {busy
              ? "Saving…"
              : charge.manualOnHold
                ? "Release hold"
                : "Place hold"}
          </button>
        </fieldset>
        <FinanceFeedback error={error} />
        {!!charge.holds?.length && (
          <details>
            <summary>Hold history (latest 20)</summary>
            {charge.holds.map((h) => (
              <p key={h.id}>
                <strong>{h.held ? "Held" : "Released"}</strong> ·{" "}
                {dateTime(h.createdAt)}
                <br />
                {h.reason}
              </p>
            ))}
          </details>
        )}
      </form>
    </dialog>
  );
}
