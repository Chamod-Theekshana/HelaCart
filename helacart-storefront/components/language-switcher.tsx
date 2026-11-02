"use client";

import { Languages } from "lucide-react";
import { isLocale, localeNames, locales } from "@/lib/i18n";
import { useLanguage } from "./language-provider";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, switching, t } = useLanguage();
  return (
    <label className={`language-switcher ${className}`}>
      <Languages size={16} aria-hidden="true" />
      <span className="visually-hidden">{t("language.label")}</span>
      <select
        value={locale}
        disabled={switching}
        aria-label={t("language.label")}
        onChange={(event) => {
          const next = event.target.value;
          if (isLocale(next) && next !== locale) setLocale(next);
        }}
      >
        {locales.map((value) => (
          <option key={value} value={value} lang={value}>
            {localeNames[value]}
          </option>
        ))}
      </select>
    </label>
  );
}
