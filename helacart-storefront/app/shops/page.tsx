import type { Metadata } from "next";
import Link from "next/link";
import { api, hasApi } from "@/lib/api";
import { pageOf, previewShops, type Page, type PublicShop } from "@/lib/shops";
import { Pagination, ShopCard } from "@/components/shop-ui";
import s from "@/components/shop.module.css";
export const metadata: Metadata = {
  title: "Explore local shops",
  description:
    "Meet Sri Lankan sellers, explore their products and read verified buyer reviews.",
};
export default async function ShopsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 80) : "";
  const page =
    typeof params.page === "string" && /^\d+$/.test(params.page)
      ? Math.max(1, Math.min(10000, Number(params.page)))
      : 1;
  const query = new URLSearchParams({ q, page: String(page) });
  let list: Page<PublicShop> | null = null;
  try {
    list = hasApi
      ? await api<Page<PublicShop>>(`/shops?${query}`)
      : pageOf(
          previewShops.filter((shop) =>
            `${shop.name} ${shop.description}`
              .toLowerCase()
              .includes(q.toLowerCase()),
          ),
          page,
        );
  } catch {
    /* Show a retry state instead of sample shops on a live API. */
  }
  return (
    <div className={`container ${s.page}`}>
      <div className={s.intro}>
        <div>
          <span className="section-kicker">MEET YOUR LOCAL FAVOURITES</span>
          <h1>Good finds. Great little shops.</h1>
          <p>
            Get to know the people behind your next favourite find. Browse their
            collections and hear from verified buyers.
          </p>
        </div>
        <form className={s.search}>
          <input
            name="q"
            maxLength={80}
            defaultValue={q}
            placeholder="Search shops"
            aria-label="Search shops"
          />
          <button className="primary-btn">Find a shop</button>
        </form>
      </div>
      {!hasApi && (
        <div className={s.notice}>
          Design preview · Sample shops and reviews.
        </div>
      )}
      {!list ? (
        <div className={s.error}>
          Shops could not be loaded. <Link href="/shops">Try again</Link>
        </div>
      ) : (
        <>
          <div className={s.sectionHeading}>
            <p>
              {list.total} {list.total === 1 ? "shop" : "shops"}
              {q ? ` matching “${q}”` : " to explore"}
            </p>
          </div>
          {list.items.length ? (
            <div className={s.directory}>
              {list.items.map((shop) => (
                <ShopCard key={shop.id} shop={shop} />
              ))}
            </div>
          ) : (
            <div className={s.empty}>No shops found. Try another search.</div>
          )}
          <Pagination
            page={list.page}
            pages={list.pages}
            href={(next) =>
              `/shops?${new URLSearchParams({ q, page: String(next) })}`
            }
          />
        </>
      )}
    </div>
  );
}
