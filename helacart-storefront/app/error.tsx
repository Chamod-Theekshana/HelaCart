"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { useT } from "@/components/language-provider";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container app-state">
      <div className="empty-panel" role="alert">
        <span className="app-state-code" aria-hidden="true">
          !
        </span>
        <h1>{t("error.title")}</h1>
        <p>{t("error.text")}</p>
        {error.digest && (
          <small>{t("error.reference", { digest: error.digest })}</small>
        )}
        <div className="inline-actions">
          <button className="primary-btn" type="button" onClick={reset}>
            <RefreshCw size={16} /> {t("common.tryAgain")}
          </button>
          <Link className="outline-btn" href="/">
            {t("error.home")}
          </Link>
        </div>
      </div>
    </div>
  );
}
