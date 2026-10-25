import type { Metadata } from "next";
import { api, hasApi } from "@/lib/api";
import { demoCategories } from "@/lib/demo";
import type { Category, Product } from "@/lib/types";
import { pageOf, type Page } from "@/lib/shops";
import {
  catalogFilters,
  catalogApiQuery,
  previewCatalog,
} from "@/lib/catalog-browse";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { GlobalCatalog } from "@/components/global-catalog";

export const metadata: Metadata = { title: "Shop products" };

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = catalogFilters(await searchParams);
  let failed = false;
  const [page, categories] = await Promise.all([
    filters.error
      ? Promise.resolve(pageOf<Product>([], filters.page, 20))
      : hasApi
        ? api<Page<Product>>(
            `/catalog/products?${catalogApiQuery(filters)}`,
          ).catch(() => {
            failed = true;
            return pageOf<Product>([], filters.page, 20);
          })
        : Promise.resolve(previewCatalog(filters)),
    hasApi
      ? api<Category[]>("/categories").catch(() => [])
      : Promise.resolve(demoCategories),
  ]);
  const heading =
    categories.find((item) => item.slug === filters.category)?.name ??
    (filters.q ? `Results for “${filters.q}”` : "Discover products");
  return (
    <div className="container listing-page">
      <Breadcrumbs items={[{ label: heading }]} />
      <div className="listing-heading">
        <div>
          <span className="section-kicker">EXPLORE HELACART</span>
          <h1>{heading}</h1>
          <p>Browse goods from Sri Lankan sellers.</p>
        </div>
        <span className="subtle-count">{page.total} products</span>
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
