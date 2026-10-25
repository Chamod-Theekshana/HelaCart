"use client";
import { useShop } from "./shop-provider";
export function PreviewBanner() {
  const { isPreview } = useShop();
  return isPreview
    ? <div className="preview-banner"><div className="container"><strong>Design preview</strong> · These are example products and orders. Connect the backend to show live listings and enable checkout.</div></div>
    : null;
}
