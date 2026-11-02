import { cookies } from "next/headers";
import { defaultLocale, isLocale, localeCookie, type Locale } from "./config";
import { dictionaries } from "./dictionaries";
import { createTranslator } from "./index";

/** Reads the shopper's language from the `hc_lang` cookie (English by default). */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(localeCookie)?.value;
  return isLocale(value) ? value : defaultLocale;
}

/** Server-component translator for the current request's language. */
export async function getT() {
  const locale = await getLocale();
  return { locale, t: createTranslator(dictionaries[locale]) };
}
