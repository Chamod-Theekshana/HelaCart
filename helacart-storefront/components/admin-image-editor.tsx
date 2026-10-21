"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { errorMessage } from "@/lib/api";
import s from "./content-management.module.css";

export function AdminImageEditor({
  src,
  label,
  hint,
  disabled,
  onUpload,
  onRemove,
  wide = false,
}: {
  src: string | null;
  label: string;
  hint: string;
  disabled: boolean;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
  wide?: boolean;
}) {
  const id = useId();
  const [preview, setPreview] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const previewUrl = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    [],
  );
  async function upload(next: File | undefined) {
    if (!next) return;
    setError("");
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(next.type) ||
      next.size > 5 * 1024 * 1024
    ) {
      setError("Choose a JPEG, PNG or WebP image up to 5 MB.");
      return;
    }
    const url = URL.createObjectURL(next);
    previewUrl.current = url;
    setPreview(url);
    setBusy(true);
    try {
      await onUpload(next);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      URL.revokeObjectURL(url);
      previewUrl.current = null;
      setPreview(null);
      setBusy(false);
    }
  }
  async function remove() {
    setError("");
    setBusy(true);
    try {
      await onRemove();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={s.imageEditor} aria-label={label}>
      <strong>{label}</strong>
      <div className={`${s.imagePreview} ${wide ? s.wideImage : ""}`}>
        {preview || src ? (
          <img src={preview || src!} alt={`${label} preview`} />
        ) : (
          <span>
            <ImagePlus size={28} />
            <small>No custom image</small>
          </span>
        )}
        {busy && (
          <span className={s.uploading} role="status">
            <LoaderCircle size={18} />
            Uploading image…
          </span>
        )}
      </div>
      <p>{hint}</p>
      <div className={s.imageActions}>
        <label
          className="outline-btn"
          htmlFor={id}
          aria-disabled={disabled || busy}
        >
          <ImagePlus size={15} />
          {src ? "Replace image" : "Upload image"}
        </label>
        <input
          id={id}
          className={s.fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={disabled || busy}
          onChange={(event) => {
            void upload(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        {src && (
          <button
            type="button"
            className="admin-danger-outline"
            disabled={disabled || busy}
            onClick={() => void remove()}
          >
            <Trash2 size={14} />
            Remove
          </button>
        )}
      </div>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
