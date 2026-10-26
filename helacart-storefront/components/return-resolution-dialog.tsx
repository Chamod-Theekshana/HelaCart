"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { FinanceFeedback } from "./commission-workspace";
import type { FinanceRequest } from "@/lib/commission";
import { errorMessage } from "@/lib/api";
import styles from "./after-sales.module.css";
export function ReturnResolutionDialog({
  id,
  request,
  onClose,
  onSaved,
}: {
  id: string;
  request: FinanceRequest;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    operation = useRef(false);
  const [outcome, setOutcome] = useState("OTHER"),
    [note, setNote] = useState(""),
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
      await request(`/admin/returns/${id}/resolve`, "PATCH", {
        outcome,
        note: note.trim(),
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
        <div className={styles.heading}>
          <h2>Record return resolution</h2>
          <button
            type="button"
            className="outline-btn"
            disabled={busy}
            onClick={onClose}
            aria-label="Close return resolution"
          >
            <X size={18} />
          </button>
        </div>
        <fieldset disabled={busy}>
          <label>
            Outcome
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            >
              <option value="OTHER">Other agreed resolution</option>
              <option value="REPLACED">Items replaced</option>
              <option value="PARTIAL_REFUND">Partial refund verified</option>
              <option value="REFUNDED">Full item refund verified</option>
            </select>
          </label>
          <p className={styles.muted}>
            Pending refund records must be reviewed first. Refund outcomes
            require verified refund records; a replacement does not imply a
            refund.
          </p>
          <label>
            Resolution note
            <textarea
              required
              minLength={10}
              maxLength={1000}
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <button type="submit" className="primary-btn">
            {busy ? "Recording…" : "Record resolution"}
          </button>
        </fieldset>
        <FinanceFeedback error={error} />
      </form>
    </dialog>
  );
}
