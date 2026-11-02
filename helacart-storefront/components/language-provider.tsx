"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  createTranslator,
  dateLocales,
  localeCookie,
  localeCookieMaxAge,
  type Locale,
  type Messages,
  type Translate,
} from "@/lib/i18n";

type LanguageContext = {
  locale: Locale;
  t: Translate;
  /** BCP-47 tag for `Intl` date formatting in this language. */
  dateLocale: string;
  setLocale: (locale: Locale) => void;
  switching: boolean;
};
const context = createContext<LanguageContext | null>(null);

export function LanguageProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [switching, startTransition] = useTransition();
  const t = useMemo(() => createTranslator(messages), [messages]);
  const setLocale = useCallback(
    (next: Locale) => {
      const secure = window.location.protocol === "https:" ? "; secure" : "";
      document.cookie = `${localeCookie}=${next}; path=/; max-age=${localeCookieMaxAge}; samesite=lax${secure}`;
      document.documentElement.lang = next;
      // Server components (and this provider's dictionary) re-render with the new cookie.
      startTransition(() => router.refresh());
    },
    [router],
  );
  const value = useMemo(
    () => ({
      locale,
      t,
      dateLocale: dateLocales[locale],
      setLocale,
      switching,
    }),
    [locale, t, setLocale, switching],
  );
  return <context.Provider value={value}>{children}</context.Provider>;
}

export function useLanguage() {
  const value = useContext(context);
  if (!value) throw new Error("LanguageProvider is required.");
  return value;
}

/** Translator for client components: `const t = useT(); t("cart.title")`. */
export function useT(): Translate {
  return useLanguage().t;
}
