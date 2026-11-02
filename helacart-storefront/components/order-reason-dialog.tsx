"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { errorMessage } from "@/lib/api";
import styles from "./delivery-workspace.module.css";

/** Seller Center dialog for status changes that need a reason (5–500 chars, §1.2). */
export function OrderReasonDialog({
  title,
  description,
  label = "Reason",
  submitLabel,
  placeholder,
  danger = false,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  label?: string;
  submitLabel: string;
  placeholder?: string;
  danger?: boolean;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const operation = useRef(false);
  const [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = reason.trim();
    if (operation.current) return;
    if (value.length < 5 || value.length > 500) {
      setError("Enter a reason of 5 to 500 characters.");
      return;
    }
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      await onConfirm(value);
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
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      aria-label={title}
    >
      <form onSubmit={(event) => void submit(event)} className={styles.form}>
        <div className={styles.heading}>
          <h2>{title}</h2>
          <button
            type="button"
            className="outline-btn"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <p>{description}</p>
        <fieldset disabled={busy}>
          <label>
            {label}
            <textarea
              required
              minLength={5}
              maxLength={500}
              rows={3}
              value={reason}
              placeholder={placeholder}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className={
              danger ? "outline-btn seller-danger-button" : "primary-btn"
            }
          >
            {busy ? "Saving…" : submitLabel}
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
