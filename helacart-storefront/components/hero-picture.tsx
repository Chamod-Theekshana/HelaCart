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
  const placeholder = "/marketplace/hero.jpg";
  return (
    <picture>
      <source
        media="(max-width: 760px)"
        srcSet={fallback ? placeholder : mobile || desktop || placeholder}
      />
      <img
        ref={(image) => {
          if (image?.complete && image.naturalWidth === 0) setFailed(key);
        }}
        className={s.image}
        src={
          fallback
            ? placeholder
            : (mobileOnly ? mobile || desktop : desktop) || placeholder
        }
        alt={alt}
        fetchPriority="high"
        decoding="async"
        onError={() => setFailed(key)}
      />
    </picture>
  );
}
