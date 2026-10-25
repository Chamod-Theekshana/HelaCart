import { demoProducts } from "./demo";
import { pageOf } from "./shops";
import { rupeesToMinor } from "./seller";
import { queryString } from "./workspace";
export type CatalogFilters = {
  q: string;
  category: string;
  min: string;
  max: string;
  inStock: boolean;
  sort: string;
  page: number;
  error: string;
};
export function catalogFilters(
  params: Record<string, string | string[] | undefined>,
): CatalogFilters {
  const value = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : "";
  const min = value("min"),
    max = value("max"),
    minimum = min ? rupeesToMinor(min) : null,
    maximum = max ? rupeesToMinor(max) : null;
  const error =
    (min && (minimum === null || minimum > 1e9)) ||
    (max && (maximum === null || maximum > 1e9))
      ? "Enter valid prices up to Rs. 10,000,000."
      : minimum !== null && maximum !== null && minimum > maximum
        ? "Minimum price must not exceed maximum price."
        : "";
  return {
    q: value("q").trim().slice(0, 80),
    category: value("category").trim().slice(0, 80),
    min,
    max,
    inStock: value("inStock") === "true",
    sort: ["newest", "price-asc", "price-desc", "name"].includes(value("sort"))
      ? value("sort")
      : "newest",
    page: /^\d+$/.test(value("page"))
      ? Math.max(1, Math.min(10000, Number(value("page"))))
      : 1,
    error,
  };
}
export function catalogApiQuery(filters: CatalogFilters) {
  return queryString({
    q: filters.q,
    category: filters.category,
    minPrice: filters.min
      ? (rupeesToMinor(filters.min) ?? undefined)
      : undefined,
    maxPrice: filters.max
      ? (rupeesToMinor(filters.max) ?? undefined)
      : undefined,
    inStock: filters.inStock,
    sort: filters.sort,
    page: filters.page,
    limit: 20,
  });
}
export function catalogHref(
  filters: CatalogFilters,
  overrides: Partial<CatalogFilters> = {},
) {
  const next = { ...filters, ...overrides };
  return `/products?${queryString({ q: next.q, category: next.category, min: next.min, max: next.max, inStock: next.inStock ? "true" : undefined, sort: next.sort, page: next.page })}`;
}
export function previewCatalog(filters: CatalogFilters) {
  const products = demoProducts
    .map((product) => ({
      ...product,
      listingPriceLkrMinor:
        (
          product.variants.find((row) => row.availableQuantity > 0) ??
          product.variants[0]
        )?.priceLkrMinor ?? product.priceLkrMinor,
    }))
    .filter(
      (product) =>
        (!filters.q ||
          product.title.toLowerCase().includes(filters.q.toLowerCase())) &&
        (!filters.category || product.category.slug === filters.category) &&
        (!filters.inStock ||
          product.variants.some((row) => row.availableQuantity > 0)) &&
        (!filters.min ||
          product.listingPriceLkrMinor >= (rupeesToMinor(filters.min) ?? 0)) &&
        (!filters.max ||
          product.listingPriceLkrMinor <=
            (rupeesToMinor(filters.max) ?? Infinity)),
    )
    .sort((a, b) =>
      filters.sort === "price-asc"
        ? a.listingPriceLkrMinor - b.listingPriceLkrMinor
        : filters.sort === "price-desc"
          ? b.listingPriceLkrMinor - a.listingPriceLkrMinor
          : filters.sort === "name"
            ? a.title.localeCompare(b.title)
            : 0,
    );
  return pageOf(products, filters.page, 20);
}
