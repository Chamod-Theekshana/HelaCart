"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import { ApiError, errorMessage, userApi } from "@/lib/api";
import { normalizeSriLankanMobile, otpErrorKey } from "@/lib/checkout-errors";
import type {
  PhoneVerification as Verification,
  VerifiedPhone,
} from "@/lib/types";
import { useShop } from "./shop-provider";
import { useT } from "./language-provider";

/**
 * SMS one-time-code verification for a delivery phone (API §3.1):
 * send code → 6-digit input → confirm, with a resend countdown from `resendAfter`.
 */
export function PhoneVerification({
  phone,
  onVerified,
}: {
  phone: string;
  onVerified: (result: VerifiedPhone) => void | Promise<void>;
}) {
  const t = useT();
  const { user, isPreview } = useShop();
  const [verification, setVerification] = useState<Verification | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);
  const normalized = normalizeSriLankanMobile(phone);
  useEffect(() => {
    if (!verification) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [verification]);
  const resendIn = verification
    ? Math.max(
        0,
        Math.ceil((Date.parse(verification.resendAfter) - now) / 1000),
      )
    : 0;
  function explain(cause: unknown) {
    const key = otpErrorKey(cause instanceof ApiError ? cause.code : null);
    if (key) return t(key);
    // 503: SMS delivery is not configured or temporarily unavailable.
    if (cause instanceof ApiError && cause.status === 503)
      return t("phone.error.unavailable");
    return errorMessage(cause);
  }
  async function send() {
    if (!user || isPreview || busy) return;
    if (!normalized) {
      setError(t("phone.error.PHONE_INVALID"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const sent = await userApi<Verification>(
        user,
        "/me/phone-verifications",
        {
          method: "POST",
          body: { phone: normalized },
        },
      );
      setNow(Date.now());
      setVerification(sent);
      setCode("");
    } catch (cause) {
      setError(explain(cause));
    } finally {
      setBusy(false);
    }
  }
  async function confirm(event: FormEvent) {
    event.preventDefault();
    if (!user || !verification || busy) return;
    if (!/^\d{6}$/.test(code)) {
      setError(t("phone.error.OTP_INVALID"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await userApi<VerifiedPhone>(
        user,
        `/me/phone-verifications/${encodeURIComponent(verification.verificationId)}/confirm`,
        { method: "POST", body: { code } },
      );
      setVerification(null);
      await onVerified(result);
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "OTP_EXPIRED")
        setVerification(null);
      setError(explain(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="phone-verify">
      <strong>
        <ShieldCheck size={15} /> {t("phone.title")}
      </strong>
      <span>{t("phone.intro", { phone: normalized ?? phone })}</span>
      {!verification ? (
        <div className="otp-row">
          <button
            type="button"
            className="outline-btn"
            disabled={busy || isPreview || !user}
            onClick={() => void send()}
          >
            {busy ? t("phone.sending") : t("phone.send")}
          </button>
        </div>
      ) : (
        <form className="otp-row" onSubmit={(event) => void confirm(event)}>
          <label className="visually-hidden" htmlFor="otp-code">
            {t("phone.codeLabel")}
          </label>
          <input
            id="otp-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            value={code}
            placeholder="••••••"
            aria-label={t("phone.codeLabel")}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
          />
          <button
            type="submit"
            className="primary-btn"
            disabled={busy || code.length !== 6}
          >
            {busy ? t("phone.verifying") : t("phone.verify")}
          </button>
          <button
            type="button"
            className="link-button"
            disabled={busy || resendIn > 0}
            onClick={() => void send()}
          >
            {resendIn > 0
              ? t("phone.resendIn", { seconds: resendIn })
              : t("phone.resend")}
          </button>
          <small>{t("phone.sentTo", { phone: verification.phone })}</small>
        </form>
      )}
      {error && (
        <div className="message error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
