"use client";
import { useShop } from "./shop-provider";
import { useT } from "./language-provider";
export function PreviewBanner() {
  const { isPreview } = useShop();
  const t = useT();
  return isPreview ? (
    <div className="preview-banner">
      <div className="container">
        <strong>{t("preview.title")}</strong> · {t("preview.text")}
      </div>
    </div>
  ) : null;
}
