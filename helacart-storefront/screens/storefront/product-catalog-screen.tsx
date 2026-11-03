import type { Metadata } from "next";
import { api, hasApi } from "@/lib/api";
import { demoCategories } from "@/lib/demo";
import { getT } from "@/lib/i18n/server";
import type { Category, Product } from "@/lib/types";
import { pageOf, type Page } from "@/lib/shops";
import {
  catalogFilters,
  catalogApiQuery,
  previewCatalog,
} from "@/lib/catalog-browse";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { GlobalCatalog } from "@/components/global-catalog";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: t("catalog.metaTitle"),
    description: t("catalog.subtitle"),
    alternates: { canonical: "/products" },
  };
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [filters, { t }] = await Promise.all([
    searchParams.then(catalogFilters),
    getT(),
  ]);
  let failed = false;
  const [page, categories] = await Promise.all([
    filters.error
      ? Promise.resolve(pageOf<Product>([], filters.page, 20))
      : hasApi
        ? api<Page<Product>>(`/catalog/products?${catalogApiQuery(filters)}`, {
            revalidate: 60,
          }).catch(() => {
            failed = true;
            return pageOf<Product>([], filters.page, 20);
          })
        : Promise.resolve(previewCatalog(filters)),
    hasApi
      ? api<Category[]>("/categories", { revalidate: 300 }).catch(() => [])
      : Promise.resolve(demoCategories),
  ]);
  const heading =
    categories.find((item) => item.slug === filters.category)?.name ??
    (filters.q
      ? t("catalog.resultsFor", { q: filters.q })
      : t("catalog.title"));
  return (
    <div className="container listing-page">
      <Breadcrumbs items={[{ label: heading }]} />
      <div className="listing-heading">
        <div>
          <span className="section-kicker">{t("catalog.kicker")}</span>
          <h1>{heading}</h1>
          <p>{t("catalog.subtitle")}</p>
        </div>
        <span className="subtle-count">
          {t("catalog.productCount", { count: page.total })}
        </span>
      </div>
      <GlobalCatalog
        key={JSON.stringify(filters)}
        initial={page}
        categories={categories}
        filters={filters}
        failed={failed}
      />
    </div>
  );
}
