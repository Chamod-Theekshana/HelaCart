import type { MessageKey } from "./i18n";

/** Friendly, translated message for a checkout error / blocker code (API §3.2). */
export function checkoutErrorKey(code?: string | null): MessageKey {
  switch (code) {
    case "PHONE_NOT_VERIFIED":
      return "checkout.error.PHONE_NOT_VERIFIED";
    case "TOO_MANY_OPEN_ORDERS":
      return "checkout.error.TOO_MANY_OPEN_ORDERS";
    case "COD_LIMIT_EXCEEDED":
      return "checkout.error.COD_LIMIT_EXCEEDED";
    case "SELLER_SUSPENDED":
      return "checkout.error.SELLER_SUSPENDED";
    default:
      return "checkout.error.blocked";
  }
}

export const checkoutErrorCodes = [
  "PHONE_NOT_VERIFIED",
  "TOO_MANY_OPEN_ORDERS",
  "COD_LIMIT_EXCEEDED",
  "SELLER_SUSPENDED",
] as const;

/** Friendly message for phone-verification (SMS OTP) error codes (API §3.1). */
export function otpErrorKey(code?: string | null): MessageKey | null {
  switch (code) {
    case "PHONE_INVALID":
      return "phone.error.PHONE_INVALID";
    case "OTP_RATE_LIMITED":
      return "phone.error.OTP_RATE_LIMITED";
    case "OTP_INVALID":
      return "phone.error.OTP_INVALID";
    case "OTP_EXPIRED":
      return "phone.error.OTP_EXPIRED";
    default:
      return null;
  }
}

/** Sri Lankan mobile numbers the API accepts, normalised to +947XXXXXXXX. */
export function normalizeSriLankanMobile(value: string): string | null {
  const digits = value.replace(/[\s()-]/g, "");
  const match = /^(?:\+94|94|0)?(7\d{8})$/.exec(digits);
  return match ? `+94${match[1]}` : null;
}
