"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Filter, Search, X } from "lucide-react";
import { api, errorMessage, hasApi } from "@/lib/api";
import type { Category, Product, ProductPage } from "@/lib/types";
import { ProductCard } from "./product-card";

export function CatalogView({ initial, categories, query, category, failed }: {
  initial: ProductPage; categories: Category[]; query: string; category: string; failed: boolean;
}) {
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [sort, setSort] = useState("featured");
  const [inStock, setInStock] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(failed ? "We could not load products from the API." : "");
  const visible = useMemo(() => {
    const rows = items.filter((item) =>
      (!inStock || item.variants.some((variant) => variant.availableQuantity > 0)) &&
      (!minPrice || item.priceLkrMinor >= Number(minPrice) * 100) &&
      (!maxPrice || item.priceLkrMinor <= Number(maxPrice) * 100));
    return [...rows].sort((a, b) => sort === "price-asc" ? a.priceLkrMinor - b.priceLkrMinor :
      sort === "price-desc" ? b.priceLkrMinor - a.priceLkrMinor :
      sort === "name" ? a.title.localeCompare(b.title) : 0);
  }, [items, inStock, minPrice, maxPrice, sort]);
  async function loadMore() {
    if (!cursor) return;
    setLoading(true); setError("");
    const params = new URLSearchParams({ limit: "20", cursor });
    if (query) params.set("q", query);
    if (category) params.set("category", category);
    try {
      const next = await api<ProductPage>(`/products?${params}`);
      setItems((old) => [...old, ...next.items]); setCursor(next.nextCursor);
    } catch (issue) { setError(errorMessage(issue)); }
    finally { setLoading(false); }
  }
  return <>
    <div className="listing-toolbar"><button className="outline-btn filters-toggle" type="button" onClick={() => setFiltersOpen(!filtersOpen)}><Filter size={17} /> Filters</button>
      <div className="active-filter-list">{query && <span>Search: {query}</span>}{category && <span>{categories.find((item) => item.slug === category)?.name ?? category}</span>}{inStock && <span>In stock</span>}</div>
      <label>Sort by <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="featured">Featured</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="name">Product name</option></select></label>
    </div>
    <div className="catalog-layout">
      <aside className={`filter-sidebar ${filtersOpen ? "open" : ""}`}>
        <div className="filter-sidebar-title"><strong>Filters</strong><button onClick={() => setFiltersOpen(false)} aria-label="Close filters"><X size={18} /></button></div>
        <section><h3>Categories</h3><Link className={!category ? "selected" : ""} href={query ? `/products?q=${encodeURIComponent(query)}` : "/products"}>All products</Link>
          {categories.map((item) => <Link className={category === item.slug ? "selected" : ""} key={item.id} href={`/products?category=${encodeURIComponent(item.slug)}${query ? `&q=${encodeURIComponent(query)}` : ""}`}>{item.name}</Link>)}</section>
        <section><h3>Availability</h3><label className="check-row"><input type="checkbox" checked={inStock} onChange={(event) => setInStock(event.target.checked)} /> In stock on loaded products</label></section>
        <section><h3>Price range (LKR)</h3><div className="price-range"><input type="number" min="0" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="Min" aria-label="Minimum price" /><input type="number" min="0" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="Max" aria-label="Maximum price" /></div><small>Applies to products loaded on this page.</small></section>
        <button className="text-link filter-clear" onClick={() => { setInStock(false); setMinPrice(""); setMaxPrice(""); }}>Clear local filters</button>
      </aside>
      <div className="catalog-results">
        <div className="results-summary"><strong>{visible.length} products shown</strong><span>Choose a product to see variants and availability.</span></div>
        {error && <div className="message error" role="alert">{error} <Link href="/products">Try again</Link></div>}
        {visible.length ? <div className="product-grid">{visible.map((item: Product) => <ProductCard key={item.id} product={item} />)}</div>
          : !error && <div className="empty-panel"><Search size={30} /><h2>No matching products</h2><p>Try another search or change the filters.</p><Link className="outline-btn" href="/products">Browse all products</Link></div>}
        {hasApi && cursor && <button className="load-more outline-btn" onClick={loadMore} disabled={loading}>{loading ? "Loading..." : "Load more products"} <ChevronDown size={17} /></button>}
      </div>
    </div>
  </>;
}
