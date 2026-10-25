"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2, ImagePlus, Replace, X } from "lucide-react";
import styles from "./seller-document-input.module.css";

export type DocumentSelection = { file: File; previewUrl: string };

export function SellerDocumentInput({ name, label, required = false, selection, disabled, onChange, onError }: {
  name: string; label: string; required?: boolean; selection: DocumentSelection | null; disabled: boolean;
  onChange: (value: DocumentSelection | null) => void; onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (selection) URL.revokeObjectURL(selection.previewUrl); }, [selection]);

  return <div className={styles.card}>
    <div className={styles.heading}><label htmlFor={name}>{label}</label><span className={required ? styles.required : styles.optional}>{required ? "Required" : "Optional"}</span></div>
    <label className={`${styles.upload} ${selection ? styles.selected : ""}`}>
      {selection ? <>
        {/* Identity photos remain local blob previews until the application is submitted. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={selection.previewUrl} alt={`${label} preview`} />
        <span className={styles.replace}><Replace size={16} /> Replace photo</span>
      </> : <><ImagePlus size={28} aria-hidden="true" /><strong>Choose a photo</strong><span>JPEG, PNG or WebP · up to 5 MB</span></>}
      <input ref={inputRef} id={name} name={name} type="file" accept="image/jpeg,image/png,image/webp" required={required && !selection} disabled={disabled} aria-label={label} onChange={(event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > 5 * 1024 * 1024) {
          onError(`${label}: choose a JPEG, PNG or WebP photo up to 5 MB.`); event.target.value = ""; return;
        }
        onError(""); onChange({ file, previewUrl: URL.createObjectURL(file) });
      }} />
    </label>
    {selection && <div className={styles.file}><CheckCircle2 size={15} aria-hidden="true" /><span title={selection.file.name}>{selection.file.name}</span><button type="button" disabled={disabled} aria-label={`Remove ${label.toLowerCase()}`} onClick={() => { onChange(null); if (inputRef.current) inputRef.current.value = ""; }}><X size={16} /></button></div>}
  </div>;
}
