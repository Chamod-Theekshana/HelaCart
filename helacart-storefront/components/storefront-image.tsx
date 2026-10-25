"use client";
/* eslint-disable @next/next/no-img-element */
import { useState, type ReactNode } from "react";
export function StorefrontImage({
  src,
  alt,
  className,
  fallback,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  fallback: ReactNode;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  return src && src !== failedSource ? (
    <img
      ref={(image) => {
        // Cached failures may complete before React attaches its error handler.
        if (image?.complete && image.naturalWidth === 0) setFailedSource(src);
      }}
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSource(src)}
    />
  ) : (
    fallback
  );
}
