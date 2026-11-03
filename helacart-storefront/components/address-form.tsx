"use client";

import { useState, type FormEvent } from "react";
import { errorMessage } from "@/lib/api";
import { deliveryDistricts } from "@/lib/delivery";
import type { Address, AddressInput } from "@/lib/types";
import { useT } from "./language-provider";

const fields = [
  "recipient",
  "phone",
  "line1",
  "city",
  "district",
  "postalCode",
] as const;

/**
 * Create or edit a delivery address. On edit only changed fields are sent
 * (PATCH /me/addresses/:id, API §4); changing the phone resets its verification.
 */
export function AddressForm({
  initial,
  onSubmit,
  onCancel,
  disabled = false,
}: {
  initial?: Address | null;
  onSubmit: (body: Partial<AddressInput>) => Promise<void>;
  onCancel?: () => void;
  disabled?: boolean;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || disabled) return;
    const values = new FormData(event.currentTarget);
    const body: Partial<AddressInput> = {};
    for (const key of fields) {
      const value = String(values.get(key) ?? "").trim();
      if (!initial || value !== initial[key]) body[key] = value;
    }
    const line2 = String(values.get("line2") ?? "").trim();
    if (!initial) {
      if (line2) body.line2 = line2;
    } else if (line2 !== (initial.line2 ?? "")) body.line2 = line2 || null;
    if (initial && !Object.keys(body).length) {
      onCancel?.();
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSubmit(body);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="address-form" onSubmit={(event) => void submit(event)}>
      <label>
        {t("address.recipient")}
        <input
          name="recipient"
          required
          minLength={2}
          maxLength={100}
          autoComplete="name"
          defaultValue={initial?.recipient}
        />
      </label>
      <label>
        {t("address.phone")}
        <input
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          placeholder="+94 77 123 4567"
          defaultValue={initial?.phone}
        />
        {initial?.phoneVerified && (
          <small>{t("address.phoneChangeNote")}</small>
        )}
      </label>
      <label className="wide">
        {t("address.line1")}
        <input
          name="line1"
          required
          minLength={5}
          maxLength={200}
          autoComplete="address-line1"
          defaultValue={initial?.line1}
        />
      </label>
      <label className="wide">
        {t("address.line2")}
        <input
          name="line2"
          maxLength={200}
          autoComplete="address-line2"
          defaultValue={initial?.line2 ?? ""}
        />
      </label>
      <label>
        {t("address.city")}
        <input
          name="city"
          required
          minLength={2}
          maxLength={80}
          autoComplete="address-level2"
          defaultValue={initial?.city}
        />
      </label>
      <label>
        {t("address.district")}
        <select name="district" required defaultValue={initial?.district ?? ""}>
          <option value="" disabled>
            {t("address.selectDistrict")}
          </option>
          {deliveryDistricts.map((district) => (
            <option key={district}>{district}</option>
          ))}
        </select>
      </label>
      <label>
        {t("address.postalCode")}
        <input
          name="postalCode"
          required
          minLength={3}
          maxLength={20}
          autoComplete="postal-code"
          defaultValue={initial?.postalCode}
        />
      </label>
      {error && (
        <div className="message error wide" role="alert">
          {error}
        </div>
      )}
      <div className="inline-actions wide">
        <button
          className="primary-btn"
          disabled={busy || disabled}
          type="submit"
        >
          {busy
            ? t("common.saving")
            : initial
              ? t("address.saveChanges")
              : t("address.save")}
        </button>
        {onCancel && (
          <button
            type="button"
            className="outline-btn"
            disabled={busy}
            onClick={onCancel}
          >
            {t("common.cancel")}
          </button>
        )}
      </div>
    </form>
  );
}
