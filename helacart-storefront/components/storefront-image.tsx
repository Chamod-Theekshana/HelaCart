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
