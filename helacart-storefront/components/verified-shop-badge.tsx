import { BadgeCheck } from "lucide-react";
import s from "./verified-shop-badge.module.css";

export function VerifiedShopBadge() {
  return (
    <details className={s.details}>
      <summary
        className={s.badge}
        aria-label="Verified shop: learn about verification"
      >
        <BadgeCheck size={16} aria-hidden="true" /> Verified shop
      </summary>
      <p className={s.explanation}>
        Shop identity reviewed by HelaCart. Our team has checked the
        seller&apos;s submitted identity documents.
      </p>
    </details>
  );
}
