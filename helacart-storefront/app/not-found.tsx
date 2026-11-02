import Link from "next/link";
import { Search } from "lucide-react";
import { getT } from "@/lib/i18n/server";

// Next.js adds `noindex` and a 404 status for not-found responses itself.
export default async function NotFound() {
  const { t } = await getT();
  return (
    <div className="container app-state">
      <div className="empty-panel">
        <span className="app-state-code">404</span>
        <h1>{t("notFound.title")}</h1>
        <p>{t("notFound.text")}</p>
        <div className="inline-actions">
          <Link className="primary-btn" href="/products">
            <Search size={16} /> {t("notFound.browse")}
          </Link>
          <Link className="outline-btn" href="/">
            {t("error.home")}
          </Link>
        </div>
      </div>
    </div>
  );
}
