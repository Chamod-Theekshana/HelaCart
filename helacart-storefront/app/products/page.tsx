import type { Metadata } from "next";
import { api, hasApi } from "@/lib/api";
import { demoCategories, demoProducts } from "@/lib/demo";
import type { Category, ProductPage } from "@/lib/types";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CatalogView } from "@/components/catalog-view";

export const metadata: Metadata = { title: "Shop products" };

export default async function CatalogPage({ searchParams }: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q = "", category = "" } = await searchParams;
  const query = q.trim().slice(0, 100);
  const slug = category.trim().slice(0, 80);
  const params = new URLSearchParams({ limit: "20" });
  if (query) params.set("q", query);
  if (slug) params.set("category", slug);
  let failed = false;
  const [page, categories] = await Promise.all([
    hasApi ? api<ProductPage>(`/products?${params}`).catch(() => {
      failed = true; return { items: [], nextCursor: null };
    }) : Promise.resolve({
      items: demoProducts.filter((item) =>
        (!slug || item.category.slug === slug) &&
        (!query || item.title.toLowerCase().includes(query.toLowerCase()))),
      nextCursor: null,
    }),
    hasApi ? api<Category[]>("/categories").catch(() => []) : Promise.resolve(demoCategories),
  ]);
  const heading = categories.find((item) => item.slug === slug)?.name ?? (query ? `Results for “${query}”` : "Discover products");
  return <div className="container listing-page">
    <Breadcrumbs items={[{ label: heading }]} />
    <div className="listing-heading"><div><span className="section-kicker">EXPLORE HELACART</span><h1>{heading}</h1><p>Browse goods from Sri Lankan sellers.</p></div><span className="subtle-count">{page.items.length} products loaded</span></div>
    <CatalogView key={`${query}|${slug}`} initial={page} categories={categories} query={query} category={slug} failed={failed} />
  </div>;
}
