import Link from "next/link";
import { api, hasApi } from "@/lib/api";
import { demoProducts } from "@/lib/demo";
import type { Product } from "@/lib/types";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ProductDetail } from "@/components/product-detail";
import { ProductCard } from "@/components/product-card";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let failed = false;
  const product = hasApi
    ? await api<Product>(`/products/${encodeURIComponent(id)}`).catch(() => { failed = true; return null; })
    : demoProducts.find((item) => item.id === id) ?? null;
  if (!product) return <div className="container detail-page">
    <Breadcrumbs items={[{ label: "Product" }]} />
    <div className="empty-panel"><h1>{failed ? "Product unavailable" : "Product not found"}</h1>
      <p>{failed ? "Could not load this listing from the API." : "This listing is not in the catalog."}</p>
      <Link href="/products" className="primary-btn">Return to catalog</Link>
    </div>
  </div>;
  const related = hasApi ? [] : demoProducts.filter((item) => item.category.slug === product.category.slug && item.id !== id).slice(0, 4);
  return <div className="container detail-page"><Breadcrumbs items={[
    { label: product.category.name, href: `/products?category=${encodeURIComponent(product.category.slug)}` },
    { label: product.title },
  ]} />
    <ProductDetail key={product.id} product={product} />
    {related.length > 0 && <section className="home-section related-section"><div className="section-heading"><div><span className="section-kicker">YOU MAY ALSO LIKE</span><h2>Related products</h2></div></div>
      <div className="product-grid">{related.map((item) => <ProductCard key={item.id} product={item} />)}</div>
    </section>}
  </div>;
}
