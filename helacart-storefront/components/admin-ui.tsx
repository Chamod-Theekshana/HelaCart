"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { errorMessage } from "@/lib/api";

export function AdminHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="admin-heading"><div><span className="admin-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}
export function AdminBadge({ value }: { value: string }) {
  const tone = /approved|delivered|reconciled|resolved/i.test(value) ? "good" :
    /rejected|cancelled|disputed/i.test(value) ? "bad" :
    /pending|placed|accepted/i.test(value) ? "warn" : "neutral";
  return <span className={`admin-badge ${tone}`}>{value.replaceAll("_", " ").toLowerCase()}</span>;
}
export function AdminFeedback({ error, notice }: { error?: string; notice?: string }) {
  return <>{error && <div className="admin-feedback error" role="alert">{error}</div>}{notice && <div className="admin-feedback success" role="status">{notice}</div>}</>;
}
export function AdminEmpty({ message }: { message: string }) {
  return <div className="admin-empty">{message}</div>;
}
export function AdminDecision({ title, description, label, noteLabel, minLength = 0, maxLength = 1000, dangerous = false, onClose, onConfirm }: {
  title: string; description: string; label: string; noteLabel?: string; minLength?: number; maxLength?: number;
  dangerous?: boolean; onClose: () => void; onConfirm: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (noteLabel && note.trim().length < minLength) { setError(`Enter at least ${minLength} characters.`); return; }
    setBusy(true); setError("");
    try { await onConfirm(note.trim()); onClose(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <form className="admin-modal" role="dialog" aria-modal="true" aria-label={title} onSubmit={(event) => void submit(event)}>
      <div className="admin-modal-head"><h2>{title}</h2><button type="button" onClick={onClose} disabled={busy} aria-label="Close dialog"><X size={19} /></button></div>
      <p>{description}</p>
      {noteLabel && <label>{noteLabel}<textarea autoFocus required={minLength > 0} minLength={minLength || undefined} maxLength={maxLength} rows={4} value={note} onChange={(event) => setNote(event.target.value)} /></label>}
      <AdminFeedback error={error} />
      <div className="admin-modal-actions"><button type="button" className="outline-btn" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" disabled={busy} className={dangerous ? "admin-danger" : "primary-btn"}>{busy ? "Please wait…" : label}</button></div>
    </form>
  </div>;
}
