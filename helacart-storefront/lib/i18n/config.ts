export const locales = ["en", "si", "ta"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
/** Cookie holding the shopper's language choice. */
export const localeCookie = "hc_lang";
export const localeCookieMaxAge = 60 * 60 * 24 * 365;
export const localeNames: Record<Locale, string> = {
  en: "English",
  si: "සිංහල",
  ta: "தமிழ்",
};
/** BCP-47 tags used for dates and numbers (prices always keep "Rs." formatting). */
export const dateLocales: Record<Locale, string> = {
  en: "en-LK",
  si: "si-LK",
  ta: "ta-LK",
};
export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (locales as readonly string[]).includes(value)
  );
}
