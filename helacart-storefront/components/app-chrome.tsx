"use client";

import { usePathname } from "next/navigation";
import type { Category } from "@/lib/types";
import { SellerProvider } from "./seller-provider";
import { SellerShell } from "./seller-shell";
import { AdminProvider } from "./admin-provider";
import { AdminShell } from "./admin-shell";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { PreviewBanner } from "./preview-banner";

export function AppChrome({ children, categories }: { children: React.ReactNode; categories: Category[] }) {
  const pathname = usePathname();
  if (pathname === "/seller" || pathname.startsWith("/seller/")) {
    return <SellerProvider><SellerShell>{children}</SellerShell></SellerProvider>;
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return <AdminProvider><AdminShell>{children}</AdminShell></AdminProvider>;
  }
  return <>
    <SiteHeader categories={categories} />
    <PreviewBanner />
    <main className="main-content">{children}</main>
    <SiteFooter showTrust={pathname !== "/"} />
  </>;
}
