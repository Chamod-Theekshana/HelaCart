"use client";
import { useState } from "react";
import Link from "next/link";
import { Filter, Search, X } from "lucide-react";
import type { Category, Product } from "@/lib/types";
import type { Page } from "@/lib/shops";
import { catalogHref, type CatalogFilters } from "@/lib/catalog-browse";
import { Pagination } from "./shop-ui";
import { ProductCard } from "./product-card";
export function GlobalCatalog({
  initial,
  categories,
  filters,
  failed,
}: {
  initial: Page<Product>;
  categories: Category[];
  filters: CatalogFilters;
  failed: boolean;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  return (
    <>
      <div className="listing-toolbar">
        <button
          className="outline-btn filters-toggle"
          type="button"
          onClick={() => setFiltersOpen((value) => !value)}
        >
          <Filter size={17} />
          Filters
        </button>
        <div className="active-filter-list">
          {filters.q && <span>Search: {filters.q}</span>}
          {filters.category && (
            <span>
              {categories.find((row) => row.slug === filters.category)?.name ??
                filters.category}
            </span>
          )}
          {filters.inStock && <span>In stock</span>}
        </div>
        <label>
          Sort by{" "}
          <select
            form="catalog-filters"
            name="sort"
            defaultValue={filters.sort}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
          >
            <option value="newest">Newest first</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="name">Product name</option>
          </select>
        </label>
      </div>
      <div className="catalog-layout">
        <aside className={`filter-sidebar ${filtersOpen ? "open" : ""}`}>
          <div className="filter-sidebar-title">
            <strong>Filters</strong>
            <button
              onClick={() => setFiltersOpen(false)}
              aria-label="Close filters"
            >
              <X size={18} />
            </button>
          </div>
          <section>
            <h3>Categories</h3>
            <Link
              className={!filters.category ? "selected" : ""}
              href={catalogHref(filters, { category: "", page: 1 })}
            >
              All products
            </Link>
            {categories.map((row) => (
              <Link
                className={filters.category === row.slug ? "selected" : ""}
                key={row.id}
                href={catalogHref(filters, { category: row.slug, page: 1 })}
              >
                {row.name}
              </Link>
            ))}
          </section>
          <form
            id="catalog-filters"
            action="/products"
            onSubmit={() => setFiltersOpen(false)}
          >
            <input type="hidden" name="q" value={filters.q} />
            <input type="hidden" name="category" value={filters.category} />
            <section>
              <h3>Availability</h3>
              <label className="check-row">
                <input
                  type="checkbox"
                  name="inStock"
                  value="true"
                  defaultChecked={filters.inStock}
                />
                In stock
              </label>
            </section>
            <section>
              <h3>Price range (LKR)</h3>
              <div className="price-range">
                <input
                  name="min"
                  type="number"
                  min="0"
                  max="10000000"
                  step="0.01"
                  defaultValue={filters.min}
                  placeholder="Min"
                  aria-label="Minimum price"
                />
                <input
                  name="max"
                  type="number"
                  min="0"
                  max="10000000"
                  step="0.01"
                  defaultValue={filters.max}
                  placeholder="Max"
                  aria-label="Maximum price"
                />
              </div>
            </section>
            <button className="primary-btn" type="submit">
              Apply filters
            </button>
            <Link className="text-link filter-clear" href="/products">
              Clear filters
            </Link>
          </form>
        </aside>
        <div className="catalog-results">
          <div className="results-summary">
            <strong>{initial.total} matching products</strong>
            <span>{initial.items.length} on this page</span>
          </div>
          {filters.error && (
            <div className="message error" role="alert">
              {filters.error}
            </div>
          )}
          {failed && (
            <div className="message error" role="alert">
              Products could not be loaded.{" "}
              <Link href={catalogHref(filters)}>Try again</Link>
            </div>
          )}
          {initial.items.length ? (
            <div className="product-grid">
              {initial.items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            !failed &&
            !filters.error && (
              <div className="empty-panel">
                <Search size={30} />
                <h2>No matching products</h2>
                <p>Try another search or change your filters.</p>
                <Link className="outline-btn" href="/products">
                  Browse all products
                </Link>
              </div>
            )
          )}
          <Pagination
            page={initial.page}
            pages={initial.pages}
            href={(page) => catalogHref(filters, { page })}
          />
        </div>
      </div>
    </>
  );
}
