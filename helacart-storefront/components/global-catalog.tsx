"use client";
import { useState } from "react";
import Link from "next/link";
import { Filter, Search, X } from "lucide-react";
import type { Category, Product } from "@/lib/types";
import type { Page } from "@/lib/shops";
import { catalogHref, type CatalogFilters } from "@/lib/catalog-browse";
import { Pagination } from "./shop-ui";
import { ProductCard } from "./product-card";
import { useT } from "./language-provider";
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
  const t = useT();
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
          {t("catalog.filters")}
        </button>
        <div className="active-filter-list">
          {filters.q && (
            <span>{t("catalog.searchChip", { q: filters.q })}</span>
          )}
          {filters.category && (
            <span>
              {categories.find((row) => row.slug === filters.category)?.name ??
                filters.category}
            </span>
          )}
          {filters.inStock && <span>{t("product.inStock")}</span>}
        </div>
        <label>
          {t("catalog.sortBy")}{" "}
          <select
            form="catalog-filters"
            name="sort"
            defaultValue={filters.sort}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
          >
            <option value="relevance">{t("catalog.sort.relevance")}</option>
            <option value="newest">{t("catalog.sort.newest")}</option>
            <option value="price-asc">{t("catalog.sort.priceAsc")}</option>
            <option value="price-desc">{t("catalog.sort.priceDesc")}</option>
            <option value="name">{t("catalog.sort.name")}</option>
          </select>
        </label>
      </div>
      <div className="catalog-layout">
        <aside className={`filter-sidebar ${filtersOpen ? "open" : ""}`}>
          <div className="filter-sidebar-title">
            <strong>{t("catalog.filters")}</strong>
            <button
              onClick={() => setFiltersOpen(false)}
              aria-label={t("catalog.closeFilters")}
            >
              <X size={18} />
            </button>
          </div>
          <section>
            <h3>{t("nav.categories")}</h3>
            <Link
              className={!filters.category ? "selected" : ""}
              href={catalogHref(filters, { category: "", page: 1 })}
            >
              {t("nav.allProducts")}
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
              <label className="check-row">
                <input
                  type="checkbox"
                  name="deals"
                  value="true"
                  defaultChecked={filters.deals}
                />
                {t("catalog.offersOnly")}
              </label>
            </section>
            <section>
              <h3>{t("catalog.availability")}</h3>
              <label className="check-row">
                <input
                  type="checkbox"
                  name="inStock"
                  value="true"
                  defaultChecked={filters.inStock}
                />
                {t("product.inStock")}
              </label>
            </section>
            <section>
              <h3>{t("catalog.priceRange")}</h3>
              <div className="price-range">
                <input
                  name="min"
                  type="number"
                  min="0"
                  max="10000000"
                  step="0.01"
                  defaultValue={filters.min}
                  placeholder={t("catalog.min")}
                  aria-label={t("catalog.minAria")}
                />
                <input
                  name="max"
                  type="number"
                  min="0"
                  max="10000000"
                  step="0.01"
                  defaultValue={filters.max}
                  placeholder={t("catalog.max")}
                  aria-label={t("catalog.maxAria")}
                />
              </div>
            </section>
            <button className="primary-btn" type="submit">
              {t("catalog.apply")}
            </button>
            <Link className="text-link filter-clear" href="/products">
              {t("catalog.clear")}
            </Link>
          </form>
        </aside>
        <div className="catalog-results">
          <div className="results-summary">
            <strong>{t("catalog.matching", { count: initial.total })}</strong>
            <span>{t("catalog.onPage", { count: initial.items.length })}</span>
          </div>
          {filters.error && (
            <div className="message error" role="alert">
              {t(
                filters.error === "minAboveMax"
                  ? "catalog.error.minAboveMax"
                  : "catalog.error.invalidPrice",
              )}
            </div>
          )}
          {failed && (
            <div className="message error" role="alert">
              {t("catalog.loadError")}{" "}
              <Link href={catalogHref(filters)}>{t("common.tryAgain")}</Link>
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
                <h2>{t("catalog.empty.title")}</h2>
                <p>{t("catalog.empty.text")}</p>
                <Link className="outline-btn" href="/products">
                  {t("catalog.empty.action")}
                </Link>
              </div>
            )
          )}
          <Pagination
            page={initial.page}
            pages={initial.pages}
            href={(page) => catalogHref(filters, { page })}
            labels={{
              label: t("pagination.label"),
              previous: t("pagination.previous"),
              next: t("pagination.next"),
              pageOf: t("pagination.pageOf"),
            }}
          />
        </div>
      </div>
    </>
  );
}
