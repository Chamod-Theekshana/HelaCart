import Link from "next/link";
import { ArrowRight, Banknote, Headphones, House, Shirt, ShoppingBag, Sparkles, Truck, UtensilsCrossed } from "lucide-react";
import { api, hasApi } from "@/lib/api";
import { demoCategories, demoProducts } from "@/lib/demo";
import type { Category, ProductPage } from "@/lib/types";
import { ProductCard, ProductImage } from "@/components/product-card";

export default async function HomePage() {
  let error = false;
  const [list, categories] = await Promise.all([
    hasApi ? api<ProductPage>("/products?limit=20").catch(() => { error = true; return { items: [], nextCursor: null }; })
      : Promise.resolve({ items: demoProducts, nextCursor: null }),
    hasApi ? api<Category[]>("/categories").catch(() => []) : Promise.resolve(demoCategories),
  ]);
  const products = list.items;
  const spotlight = products.slice(0, 3);
  const sellers = [...new Map(products.map((entry) => [entry.seller.name, entry])).values()].slice(0, 3);
  return <>
    <div className="container home-page">
      <section className="hero-grid">
        <div className="hero-panel">
          <span className="hero-kicker"><Sparkles size={14} /> SRI LANKAN MULTI-SELLER MARKETPLACE</span>
          <h1>Everyday essentials.<br /><span>Local discoveries.</span></h1>
          <p>Browse quality goods from sellers across Sri Lanka. Find your next favorite for home, work and everything in between.</p>
          <div className="hero-actions"><Link className="primary-btn" href="/products">Shop all products <ArrowRight size={18} /></Link><Link className="light-btn" href="#categories">Explore categories</Link></div>
          <div className="hero-benefits"><span><Banknote size={17} /> Cash on delivery</span><span><ShoppingBag size={17} /> Multi-seller finds</span><span><Truck size={17} /> Delivery shown at checkout</span></div>
        </div>
        <div className="hero-collage">
          {spotlight.map((item, index) => <Link className={`collage-card collage-${index}`} key={item.id} href={`/products/${item.id}`}>
            <ProductImage product={item} /><span>{item.category.name}<strong>{item.title}</strong></span>
          </Link>)}
          {!spotlight.length && <div className="collage-empty">New discoveries are on the way.</div>}
        </div>
      </section>

      <section id="categories" className="home-section categories-section">
        <div className="section-heading"><div><span className="section-kicker">EXPLORE CATALOG</span><h2>Explore core categories</h2></div><Link className="text-link" href="/products">Shop everything <ArrowRight size={17} /></Link></div>
        <div className="category-grid">{categories.map((category, index) => {
          const icons = [Shirt, Headphones, House, Sparkles, UtensilsCrossed, Truck];
          const Icon = icons[index % icons.length];
          return <Link className="category-tile" key={category.id} href={`/products?category=${encodeURIComponent(category.slug)}`}><span><Icon size={25} /></span><strong>{category.name}</strong><small>Explore products</small></Link>;
        })}</div>
      </section>

      <section className="home-section">
        <div className="section-heading"><div><span className="section-kicker">FRESH FINDS</span><h2>Featured products</h2><p>Browse products currently available in the marketplace.</p></div><Link className="text-link" href="/products">View all products <ArrowRight size={17} /></Link></div>
        {error && <div className="message error">Could not load products from the API. Check the backend and try again.</div>}
        {products.length ? <div className="product-grid">{products.slice(0, 4).map((item) => <ProductCard key={item.id} product={item} />)}</div>
          : <div className="empty-panel">There are no approved products to show yet.</div>}
      </section>

      {sellers.length > 0 && <section className="home-section seller-section">
        <div className="section-heading"><div><span className="section-kicker">MEET THE MAKERS</span><h2>Explore local sellers</h2><p>Discover the shops behind the goods.</p></div></div>
        <div className="seller-grid">{sellers.map((product) => <Link className="storefront-seller-card" key={product.seller.name} href={`/products/${product.id}`}>
          <span className="seller-avatar">{product.seller.name.slice(0, 1)}</span><div><strong>{product.seller.name}</strong><p>Explore a product from this seller</p></div><ArrowRight size={18} />
        </Link>)}</div>
      </section>}

      {products.length > 4 && <section className="home-section last-products"><div className="section-heading"><div><span className="section-kicker">MORE TO DISCOVER</span><h2>Trending around Sri Lanka</h2></div><Link className="text-link" href="/products">Browse catalog <ArrowRight size={17} /></Link></div>
        <div className="product-grid">{products.slice(4, 8).map((item) => <ProductCard key={item.id} product={item} />)}</div>
      </section>}
    </div>
    <section className="how-it-works"><div className="container"><span className="section-kicker">A SIMPLE WAY TO SHOP</span><h2>Shopping with Cash on Delivery</h2><div className="steps-grid">
      <div><span>1</span><h3>Choose your finds</h3><p>Browse products and check available variants.</p></div>
      <div><span>2</span><h3>Review the total</h3><p>See the item prices and seller delivery fees before placing the order.</p></div>
      <div><span>3</span><h3>Pay on delivery</h3><p>Confirm your address and place a cash on delivery order.</p></div>
    </div></div></section>
  </>;
}
