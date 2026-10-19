import type { Metadata } from "next";
import { api, hasApi } from "@/lib/api";
import { demoCategories } from "@/lib/demo";
import type { Category } from "@/lib/types";
import { ShopProvider } from "@/components/shop-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PreviewBanner } from "@/components/preview-banner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "HelaCart | Shop Sri Lankan Goods", template: "%s | HelaCart" },
  description: "Discover physical goods from Sri Lankan sellers on HelaCart.",
  icons: { icon: "/helacart-logo.png" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const categories: Category[] = hasApi
    ? await api<Category[]>("/categories").catch(() => [])
    : demoCategories;
  return <html lang="en"><body>
    <ShopProvider>
      <SiteHeader categories={categories} />
      <PreviewBanner />
      <main className="main-content">{children}</main>
      <SiteFooter />
    </ShopProvider>
  </body></html>;
}
