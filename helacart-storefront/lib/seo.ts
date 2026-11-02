import type { Product } from "./types";
import type { RatingSummary } from "./shops";
import { absoluteUrl } from "./site";

/** Plain-text description trimmed for meta tags. */
export function metaDescription(
  value: string | null | undefined,
  fallback: string,
) {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.length > 160 ? `${text.slice(0, 157).trimEnd()}…` : text;
}

const lkr = (minor: number) => (minor / 100).toFixed(2);

/** schema.org Product structured data (prices in LKR). */
export function productJsonLd(product: Product, rating?: RatingSummary | null) {
  const url = absoluteUrl(`/products/${encodeURIComponent(product.id)}`);
  const variants = product.variants.length
    ? product.variants
    : [
        {
          id: product.id,
          sku: "",
          optionValues: {},
          priceLkrMinor: product.priceLkrMinor,
          availableQuantity: 0,
        },
      ];
  const prices = variants.map((variant) => variant.priceLkrMinor);
  const inStock = variants.some((variant) => variant.availableQuantity > 0);
  const availability = inStock
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock";
  const seller = { "@type": "Organization", name: product.seller.name };
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: metaDescription(product.description, product.title),
    image: product.imageUrls.slice(0, 5),
    sku: variants[0]?.sku || undefined,
    category: product.category?.name,
    ...(product.brand
      ? { brand: { "@type": "Brand", name: product.brand } }
      : {}),
    url,
    offers:
      variants.length > 1
        ? {
            "@type": "AggregateOffer",
            priceCurrency: "LKR",
            lowPrice: lkr(Math.min(...prices)),
            highPrice: lkr(Math.max(...prices)),
            offerCount: variants.length,
            availability,
            url,
            seller,
          }
        : {
            "@type": "Offer",
            priceCurrency: "LKR",
            price: lkr(prices[0]),
            availability,
            url,
            seller,
          },
    ...(rating && rating.total > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: rating.average.toFixed(1),
            reviewCount: rating.total,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };
}

/** Serialises JSON-LD safely for an inline `<script>` (no `</script>` breakout). */
export function jsonLdScript(data: unknown) {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
