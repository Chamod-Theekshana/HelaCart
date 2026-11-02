import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import Link from "next/link";
import { Recommendations } from "@/components/recommendations";
import { api, ApiError, hasApi } from "@/lib/api";
import { demoProducts } from "@/lib/demo";
import { getT } from "@/lib/i18n/server";
import type { FeedbackPage } from "@/lib/product-feedback";
import { jsonLdScript, metaDescription, productJsonLd } from "@/lib/seo";
import type { Product } from "@/lib/types";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ProductDetail } from "@/components/product-detail";
import { ProductCard } from "@/components/product-card";

type Props = { params: Promise<{ id: string }> };

/** Loads a public product once per request; `null` = not found, `"error"` = API problem. */
const loadProduct = cache(
  async (id: string): Promise<Product | null | "error"> => {
    if (!hasApi) return demoProducts.find((item) => item.id === id) ?? null;
    try {
      return await api<Product>(`/products/${encodeURIComponent(id)}`, {
        revalidate: 60,
      });
    } catch (error) {
      return error instanceof ApiError && [400, 404].includes(error.status)
        ? null
        : "error";
    }
  },
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ id }, { t }] = await Promise.all([params, getT()]);
  const product = await loadProduct(id);
  if (!product || product === "error")
    return {
      title: t(product ? "product.unavailableTitle" : "product.notFoundTitle"),
      robots: { index: false },
    };
  const description = metaDescription(
    product.description,
    t("product.metaFallback", { seller: product.seller.name }),
  );
  const image = product.imageUrls[0];
  const canonical = `/products/${encodeURIComponent(product.id)}`;
  return {
    title: product.title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      title: product.title,
      description,
      siteName: "HelaCart",
      ...(image ? { images: [{ url: image, alt: product.title }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: product.title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const [{ id }, { t }] = await Promise.all([params, getT()]);
  const product = await loadProduct(id);
  if (product === null) notFound();
  if (product === "error")
    return (
      <div className="container detail-page">
        <Breadcrumbs items={[{ label: t("product.breadcrumb") }]} />
        <div className="empty-panel">
          <h1>{t("product.unavailableTitle")}</h1>
          <p>{t("product.loadError")}</p>
          <Link href="/products" className="primary-btn">
            {t("product.backToCatalog")}
          </Link>
        </div>
      </div>
    );
  const rating = hasApi
    ? await api<FeedbackPage>(
        `/products/${encodeURIComponent(product.id)}/customer-reviews?page=1`,
        { revalidate: 300 },
      )
        .then((page) => page.summary)
        .catch(() => null)
    : null;
  const related = hasApi
    ? []
    : demoProducts
        .filter(
          (item) =>
            item.category.slug === product.category.slug && item.id !== id,
        )
        .slice(0, 4);
  return (
    <div className="container detail-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(productJsonLd(product, rating)),
        }}
      />
      <Breadcrumbs
        items={[
          {
            label: product.category.name,
            href: `/products?category=${encodeURIComponent(product.category.slug)}`,
          },
          { label: product.title },
        ]}
      />
      <ProductDetail key={product.id} product={product} />
      {hasApi && <Recommendations productId={product.id} />}
      {related.length > 0 && (
        <section className="home-section related-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">
                {t("product.relatedKicker")}
              </span>
              <h2>{t("product.related")}</h2>
            </div>
          </div>
          <div className="product-grid">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
