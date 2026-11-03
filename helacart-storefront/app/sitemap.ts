import type { MetadataRoute } from "next";
import { api, hasApi } from "@/lib/api";
import { demoCategories, demoProducts } from "@/lib/demo";
import {
  previewShops,
  shopPath,
  type Page,
  type PublicShop,
} from "@/lib/shops";
import { absoluteUrl } from "@/lib/site";
import type { Category, Product } from "@/lib/types";

// Regenerate at most hourly; API reads below share the same lifetime.
export const revalidate = 3600;

async function pages<T>(path: (page: number) => string, count: number) {
  const results = await Promise.all(
    Array.from({ length: count }, (_, index) =>
      api<Page<T>>(path(index + 1), { revalidate }).catch(() => null),
    ),
  );
  return results.flatMap((page) => page?.items ?? []);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products, shops] = hasApi
    ? await Promise.all([
        api<Category[]>("/categories", { revalidate }).catch(() => []),
        // Public catalog returns approved products of active shops only.
        pages<Product>(
          (page) => `/catalog/products?sort=newest&limit=50&page=${page}`,
          2,
        ),
        pages<PublicShop>((page) => `/shops?limit=24&page=${page}`, 2),
      ])
    : [demoCategories, demoProducts, previewShops];
  const now = new Date();
  return [
    {
      url: absoluteUrl("/"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: absoluteUrl("/products"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/shops"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...categories.map((category) => ({
      url: absoluteUrl(
        `/products?category=${encodeURIComponent(category.slug)}`,
      ),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...shops.map((shop) => ({
      url: absoluteUrl(shopPath(shop)),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...products.map((product) => ({
      url: absoluteUrl(`/products/${encodeURIComponent(product.id)}`),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...["privacy", "terms", "returns"].map((page) => ({
      url: absoluteUrl(`/legal/${page}`),
      changeFrequency: "yearly" as const,
      priority: 0.2,
    })),
  ];
}
