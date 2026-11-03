"use client";

import { usePathname } from "next/navigation";
import type { Messages } from "@/lib/i18n";
import type { Category } from "@/lib/types";
import { LanguageProvider } from "./language-provider";
import { SellerProvider } from "./seller-provider";
import { SellerShell } from "./seller-shell";
import { AdminProvider } from "./admin-provider";
import { AdminShell } from "./admin-shell";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { PreviewBanner } from "./preview-banner";

/** Seller Center and Admin stay in English whatever the shopper's language. */
function EnglishOnly({
  messages,
  children,
}: {
  messages?: Messages;
  children: React.ReactNode;
}) {
  return (
    <div lang="en" className="workspace-lang">
      {messages ? (
        <LanguageProvider locale="en" messages={messages}>
          {children}
        </LanguageProvider>
      ) : (
        children
      )}
    </div>
  );
}

export function AppChrome({
  children,
  categories,
  englishMessages,
}: {
  children: React.ReactNode;
  categories: Category[];
  /** Supplied only when the shopper's language is not English. */
  englishMessages?: Messages;
}) {
  const pathname = usePathname();
  if (pathname === "/seller" || pathname.startsWith("/seller/")) {
    return (
      <EnglishOnly messages={englishMessages}>
        <SellerProvider>
          <SellerShell>{children}</SellerShell>
        </SellerProvider>
      </EnglishOnly>
    );
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return (
      <EnglishOnly messages={englishMessages}>
        <AdminProvider>
          <AdminShell>{children}</AdminShell>
        </AdminProvider>
      </EnglishOnly>
    );
  }
  return (
    <>
      <SiteHeader categories={categories} />
      <PreviewBanner />
      <main className="main-content">{children}</main>
      <SiteFooter showTrust={pathname !== "/"} />
    </>
  );
}
