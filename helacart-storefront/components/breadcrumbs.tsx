"use client";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useT } from "./language-provider";

export function Breadcrumbs({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  const t = useT();
  return (
    <nav className="breadcrumbs" aria-label={t("breadcrumbs.label")}>
      <Link href="/">{t("breadcrumbs.home")}</Link>
      {items.map((item, index) => (
        <span key={index}>
          <ChevronRight size={13} />
          {item.href ? (
            <Link href={item.href}>{item.label}</Link>
          ) : (
            <strong>{item.label}</strong>
          )}
        </span>
      ))}
    </nav>
  );
}
