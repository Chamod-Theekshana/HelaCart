"use client";
import { useState } from "react";
import s from "./storefront-hero.module.css";
export function HeroPicture({
  desktop,
  mobile,
  alt,
  mobileOnly = false,
}: {
  desktop: string | null;
  mobile: string | null;
  alt: string;
  mobileOnly?: boolean;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const key = `${desktop}:${mobile}`;
  const fallback = failed === key;
  return (
    <picture>
      <source
        media="(max-width: 760px)"
        srcSet={
          fallback
            ? "/marketplace-hero.webp"
            : mobile || desktop || "/marketplace-hero.webp"
        }
      />
      <img
        className={s.image}
        src={
          fallback
            ? "/marketplace-hero.webp"
            : (mobileOnly ? mobile || desktop : desktop) ||
              "/marketplace-hero.webp"
        }
        alt={alt}
        fetchPriority="high"
        decoding="async"
        onError={() => setFailed(key)}
      />
    </picture>
  );
}
