import type { Metadata } from "next";
import { api, hasApi } from "@/lib/api";
import { demoCategories } from "@/lib/demo";
import { en } from "@/lib/i18n/en";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";
import { siteUrl } from "@/lib/site";
import type { Category } from "@/lib/types";
import { LanguageProvider } from "@/components/language-provider";
import { ShopProvider } from "@/components/shop-provider";
import { FavoritesProvider } from "@/components/favorites-provider";
import { AppChrome } from "@/components/app-chrome";
import "./globals.css";
import "./seller.css";
import "./seller-stitch.css";
import "./admin.css";
import "./storefront-polish.css";
import "./storefront-refresh.css";
import "./favorites.css";
import "./hardening.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "HelaCart | Shop Sri Lankan Goods",
    template: "%s | HelaCart",
  },
  description: "Discover physical goods from Sri Lankan sellers on HelaCart.",
  icons: { icon: "/helacart-logo.png" },
  openGraph: {
    type: "website",
    siteName: "HelaCart",
    locale: "en_LK",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [locale, categories] = await Promise.all([
    getLocale(),
    hasApi
      ? api<Category[]>("/categories", { revalidate: 300 }).catch(() => [])
      : Promise.resolve(demoCategories),
  ]);
  return (
    <html lang={locale} data-scroll-behavior="smooth">
      <body>
        <LanguageProvider locale={locale} messages={dictionaries[locale]}>
          <ShopProvider>
            <FavoritesProvider>
              <AppChrome
                categories={categories}
                englishMessages={locale === "en" ? undefined : en}
              >
                {children}
              </AppChrome>
            </FavoritesProvider>
          </ShopProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
