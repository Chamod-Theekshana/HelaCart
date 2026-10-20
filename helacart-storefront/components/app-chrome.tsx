"use client";

import { usePathname } from "next/navigation";
import type { Category } from "@/lib/types";
import { SellerProvider } from "./seller-provider";
import { SellerShell } from "./seller-shell";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { PreviewBanner } from "./preview-banner";

export function AppChrome({ children, categories }: { children: React.ReactNode; categories: Category[] }) {
  const pathname = usePathname();
  if (pathname === "/seller" || pathname.startsWith("/seller/")) {
    return <SellerProvider><SellerShell>{children}</SellerShell></SellerProvider>;
  }
  return <>
    <SiteHeader categories={categories} />
    <PreviewBanner />
    <main className="main-content">{children}</main>
    <SiteFooter />
  </>;
}
