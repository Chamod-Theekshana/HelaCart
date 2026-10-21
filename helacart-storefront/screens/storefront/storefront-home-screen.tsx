import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  ChevronDown,
  PackageCheck,
  Search,
  Store,
} from "lucide-react";
import { api, hasApi } from "@/lib/api";
import { demoCategories, demoProducts } from "@/lib/demo";
import type { Category, Product } from "@/lib/types";
import { pageOf, previewShops, type Page, type PublicShop } from "@/lib/shops";
import {
  categoryHref,
  categoryPresentation,
} from "@/lib/storefront-categories";
import { ProductCard } from "@/components/product-card";
import { StorefrontHero } from "@/components/storefront-hero";
import { StorefrontRetry } from "@/components/storefront-retry";
import { CategoryArtwork } from "@/components/storefront-category";
import { StorefrontImage } from "@/components/storefront-image";
import { ShopCard } from "@/components/shop-ui";
import s from "@/components/storefront-home.module.css";
import { defaultHero, type HeroContent } from "@/lib/storefront-content";

export default async function HomePage() {
  let productsFailed = false;
  const [list, categories, shops, hero] = await Promise.all([
    hasApi
      ? api<Page<Product>>("/catalog/products?limit=8&sort=newest").catch(
          () => {
            productsFailed = true;
            return pageOf<Product>([], 1, 8);
          },
        )
      : Promise.resolve(pageOf(demoProducts, 1, 8)),
    hasApi
      ? api<Category[]>("/categories").catch(() => [])
      : Promise.resolve(demoCategories),
    hasApi
      ? api<Page<PublicShop>>("/shops?limit=3").catch(() =>
          pageOf<PublicShop>([], 1, 3),
        )
      : Promise.resolve(pageOf(previewShops, 1, 3)),
    hasApi
      ? api<HeroContent>("/storefront/hero").catch(() => defaultHero)
      : Promise.resolve(defaultHero),
  ]);
  const products = list.items;
  const primary =
    categories.find(
      (category) => categoryPresentation(category).family === "home",
    ) ?? categories[0];
  const secondary =
    categories.find(
      (category) =>
        category.id !== primary?.id &&
        categoryPresentation(category).family === "tech",
    ) ?? categories.find((category) => category.id !== primary?.id);
  const collections = [primary, secondary].filter(
    (category): category is Category => Boolean(category),
  );
  const firstProducts = products.slice(0, 4);
  return (
    <div className={`container ${s.home}`}>
      <StorefrontHero hasCategories={categories.length > 0} content={hero} />

      {categories.length > 0 && (
        <section
          id="categories"
          className={s.section}
          tabIndex={-1}
          aria-labelledby="categories-heading"
        >
          <div className={s.heading}>
            <div>
              <span className={s.eyebrow}>A GOOD PLACE TO START</span>
              <h2 id="categories-heading">Shop by category</h2>
            </div>
            <Link className={s.moreLink} href="/products">
              See everything <ArrowRight size={16} />
            </Link>
          </div>
          <div className={s.categoryGrid} data-compact={categories.length <= 3}>
            {categories.map((category) => {
              const { family } = categoryPresentation(category);
              return (
                <Link
                  key={category.id}
                  href={categoryHref(category)}
                  className={s.categoryTile}
                >
                  <span className={s.categoryMedia}>
                    <StorefrontImage
                      src={category.imageUrl}
                      alt=""
                      className={s.categoryImage}
                      fallback={<CategoryArtwork family={family} />}
                    />
                  </span>
                  <span>{category.name}</span>
                  <ArrowRight
                    className={s.categoryArrow}
                    size={15}
                    aria-hidden="true"
                  />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className={s.section} aria-labelledby="new-arrivals-heading">
        <div className={s.heading}>
          <div>
            <span className={s.eyebrow}>JUST ADDED</span>
            <h2 id="new-arrivals-heading">Fresh finds, just in.</h2>
            <p>The latest finds from shops on HelaCart.</p>
          </div>
          <Link className={s.moreLink} href="/products?sort=newest">
            Browse new arrivals <ArrowRight size={16} />
          </Link>
        </div>
        {productsFailed ? (
          <div className={s.empty} role="alert">
            <PackageCheck size={28} />
            <h3>Our shelves need a moment.</h3>
            <p>We couldn&apos;t load the products. Please try again.</p>
            <StorefrontRetry />
          </div>
        ) : firstProducts.length > 0 ? (
          <div className={s.featuredGrid} data-count={firstProducts.length}>
            {firstProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
            {firstProducts.length < 4 && (
              <div className={s.browseNote}>
                <span className={s.noteIcon}>
                  <Store size={29} strokeWidth={1.4} />
                </span>
                <span className={s.eyebrow}>GET TO KNOW THE SHOPS</span>
                <h3>
                  A good find starts
                  <br />
                  with a little exploring.
                </h3>
                <p>
                  Meet the shops, browse their collections and read what buyers
                  have to say.
                </p>
                <Link className={s.moreLink} href="/shops">
                  Take a look around <ArrowRight size={16} />
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className={s.empty}>
            <Store size={28} />
            <h3>Good things are on their way.</h3>
            <p>
              Products will appear here as our shops add to their collections.
            </p>
            <Link className="outline-btn" href="/shops">
              Meet the shops
            </Link>
          </div>
        )}
      </section>

      {collections.length > 0 && (
        <section
          className={`${s.section} ${s.collectionGrid}`}
          aria-label="Explore collections"
        >
          {collections.map((category) => {
            const presentation = categoryPresentation(category);
            const product = products.find(
              (item) => item.category.id === category.id,
            );
            return (
              <Link
                key={category.id}
                href={categoryHref(category)}
                className={s.collection}
              >
                <div className={s.collectionCopy}>
                  <span className={s.eyebrow}>{category.name}</span>
                  <h2>{presentation.title}</h2>
                  <p>{presentation.description}</p>
                  <span className={s.collectionAction}>
                    {presentation.action} <ArrowRight size={17} />
                  </span>
                </div>
                <div className={s.collectionVisual}>
                  <StorefrontImage
                    src={product?.imageUrls[0]}
                    alt={product?.title ?? ""}
                    className={s.collectionPhoto}
                    fallback={
                      <CategoryArtwork family={presentation.family} large />
                    }
                  />
                </div>
              </Link>
            );
          })}
        </section>
      )}

      {shops.items.length > 0 && (
        <section className={s.section} aria-labelledby="shops-heading">
          <div className={s.heading}>
            <div>
              <span className={s.eyebrow}>THE PEOPLE BEHIND THE FINDS</span>
              <h2 id="shops-heading">Small shops. Plenty to discover.</h2>
              <p>Get to know a shop before you make it a favourite.</p>
            </div>
            <Link className={s.moreLink} href="/shops">
              Meet all the shops <ArrowRight size={16} />
            </Link>
          </div>
          <div className={s.shopGrid} data-count={shops.items.length}>
            {shops.items.map((shop) => (
              <ShopCard key={shop.id} shop={shop} />
            ))}
            {shops.items.length === 1 && (
              <div className={s.shopInvitation}>
                <Store size={30} strokeWidth={1.3} />
                <h3>
                  Find a shop you&apos;ll
                  <br />
                  come back to.
                </h3>
                <p>
                  Look through the collection, read the reviews and get a feel
                  for the shop behind your next find.
                </p>
                <Link className={s.moreLink} href="/shops">
                  Get to know the shops <ArrowRight size={16} />
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {products.length > 4 && (
        <section className={s.section} aria-labelledby="more-finds-heading">
          <div className={s.heading}>
            <div>
              <span className={s.eyebrow}>KEEP LOOKING</span>
              <h2 id="more-finds-heading">A little more to explore.</h2>
            </div>
            <Link className={s.moreLink} href="/products">
              Find your next favourite <ArrowRight size={16} />
            </Link>
          </div>
          <div className={s.featuredGrid}>
            {products.slice(4, 8).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      <section
        id="how-it-works"
        className={`${s.section} ${s.howItWorks}`}
        aria-labelledby="how-it-works-heading"
      >
        <div className={s.howIntro}>
          <span className={s.eyebrow}>NICE AND SIMPLE</span>
          <h2 id="how-it-works-heading">
            Find it. Love it.
            <br />
            <span>Pay when it arrives.</span>
          </h2>
          <p>A few simple steps from a good find to your front door.</p>
        </div>
        <ol className={s.steps}>
          <li>
            <span>
              <Search size={19} />
            </span>
            <div>
              <small>01 / TAKE A LOOK</small>
              <h3>Find something for you</h3>
              <p>Explore the shops and choose your products.</p>
            </div>
          </li>
          <li>
            <span>
              <PackageCheck size={19} />
            </span>
            <div>
              <small>02 / MAKE IT YOURS</small>
              <h3>Check the details</h3>
              <p>
                Add your address and review the full total, including delivery.
              </p>
            </div>
          </li>
          <li>
            <span>
              <Banknote size={19} />
            </span>
            <div>
              <small>03 / AT YOUR DOOR</small>
              <h3>Pay on delivery</h3>
              <p>Place your order and pay when it arrives.</p>
            </div>
          </li>
        </ol>
      </section>

      <section
        className={`${s.section} ${s.questions}`}
        aria-labelledby="questions-heading"
      >
        <div>
          <span className={s.eyebrow}>BEFORE YOU CHECK OUT</span>
          <h2 id="questions-heading">
            A few things
            <br />
            you might be wondering.
          </h2>
        </div>
        <div className={s.answers}>
          <details>
            <summary>
              How do I pay for my order?
              <ChevronDown size={17} />
            </summary>
            <p>
              HelaCart currently supports cash on delivery. Review your order
              total at checkout, then pay when your order arrives.
            </p>
          </details>
          <details>
            <summary>
              Can I shop from more than one seller?
              <ChevronDown size={17} />
            </summary>
            <p>
              Yes. Products can share one cart, and each shop handles its part
              of the order. You&apos;ll see each shop&apos;s delivery fee before
              placing your order.
            </p>
          </details>
          <details>
            <summary>
              Where can I follow an order or return?
              <ChevronDown size={17} />
            </summary>
            <p>
              Open <Link href="/account">your account</Link> to follow your
              orders. You can request a return for an eligible delivered order
              and follow its progress in{" "}
              <Link href="/account/returns">My Returns</Link>.
            </p>
          </details>
        </div>
      </section>
    </div>
  );
}
