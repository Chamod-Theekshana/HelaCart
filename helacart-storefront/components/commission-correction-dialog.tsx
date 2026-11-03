"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { errorMessage } from "@/lib/api";
import type { FinanceRequest } from "@/lib/commission";
import styles from "./commission-workspace.module.css";
export type CommissionCorrectionTarget = {
  kind: "PAYMENT" | "REFUND";
  id: string;
  sellerId: string;
  reference: string;
};
export function CommissionCorrectionDialog({
  target,
  request,
  onSaved,
  onClose,
}: {
  target: CommissionCorrectionTarget;
  request: FinanceRequest;
  onSaved: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    key = useRef(crypto.randomUUID()),
    operation = useRef(false);
  const [reference, setReference] = useState(""),
    [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (operation.current || !confirmed) return;
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      await request(
        `/admin/commission/sellers/${target.sellerId}/corrections`,
        "POST",
        {
          requestKey: key.current,
          kind: target.kind,
          targetId: target.id,
          reference: reference.trim(),
          reason: reason.trim(),
        },
      );
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
      <form className={styles.form} onSubmit={(e) => void submit(e)}>
        <div className={styles.cardHead}>
          <h2>
            Reverse incorrect{" "}
            {target.kind === "PAYMENT" ? "payment approval" : "refund credit"}
          </h2>
          <button
            className="outline-btn"
            type="button"
            disabled={busy}
            onClick={onClose}
            aria-label="Close correction"
          >
            <X size={18} />
          </button>
        </div>
        <p>
          Record {target.reference}. This restores the appropriate commission
          owed and preserves the original record and correction history. It does
          not transfer money.
        </p>
        <fieldset disabled={busy}>
          <label>
            Correction / case reference
            <input
              required
              minLength={3}
              maxLength={100}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
          <label>
            Reason and verification details
            <textarea
              required
              minLength={10}
              maxLength={500}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <label className={styles.check}>
            <input
              required
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I verified that the original record was incorrect and this reversal
            is required.
          </label>
          <button type="submit" className="primary-btn">
            {busy ? "Recording…" : "Record correction"}
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
