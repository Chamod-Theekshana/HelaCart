import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n";

/** Shared frame for the starter legal pages (content is English, for review). */
export async function LegalPage({
  titleKey,
  updated,
  children,
}: {
  titleKey: MessageKey;
  updated: string;
  children: React.ReactNode;
}) {
  const { t, locale } = await getT();
  return (
    <div className="container legal-page">
      <span className="section-kicker">{t("legal.kicker")}</span>
      <h1>{t(titleKey)}</h1>
      <p className="seller-muted">{t("legal.updated", { date: updated })}</p>
      {locale !== "en" && (
        <p className="message info" lang={locale}>
          {t("legal.englishOnly")}
        </p>
      )}
      <article lang="en">
        <p className="legal-review">
          Starter text for HelaCart to review with a Sri Lankan legal adviser
          before launch. Items marked <mark>[TO CONFIRM]</mark> must be
          completed by the business.
        </p>
        {children}
      </article>
      <nav className="legal-nav" aria-label={t("footer.legal")}>
        <Link href="/legal/privacy">{t("legal.privacy.title")}</Link>
        <Link href="/legal/terms">{t("legal.terms.title")}</Link>
        <Link href="/legal/returns">{t("legal.returns.title")}</Link>
      </nav>
    </div>
  );
}
