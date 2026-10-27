"use client";
import { useState } from "react";
import { errorMessage, money } from "@/lib/api";
import {
  defaultReportDates,
  useBusinessDownload,
  type BusinessReport,
  type ToolRequest,
} from "@/lib/business-tools";
import { useFeedbackResource } from "./product-reviews";
import { ToolPagination } from "./bulk-tools-workspace";
import { formatSellerDate } from "@/lib/seller";
import s from "./business-tools.module.css";
export function BusinessReportsWorkspace({
  root,
  request,
  isPreview,
  isAdmin = false,
}: {
  root: string;
  request: ToolRequest;
  isPreview: boolean;
  isAdmin?: boolean;
}) {
  const [range, setRange] = useState(defaultReportDates);
  const [draft, setDraft] = useState(range);
  const [section, setSection] = useState("DAILY");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const download = useBusinessDownload();
  const query = `from=${range.from}&to=${range.to}`;
  const report = useFeedbackResource<BusinessReport>(
    `${root}?${query}`,
    request,
    !isPreview,
  );
  const data = report.data;
  const maxSale = Math.max(
    1,
    ...(data?.daily.map((r) => r.grossMerchandiseMinor) ?? []),
  );
  const metrics = data
    ? ([
        ["Delivered merchandise", data.totals.grossMerchandiseMinor, "money"],
        ["Delivered shop orders", data.totals.deliveredOrders, "count"],
        ["Units delivered", data.totals.units, "count"],
        ["Seller COD total", data.totals.codMinor, "money"],
        [
          "Verified merchandise refunds",
          data.totals.refundMerchandiseMinor,
          "money",
        ],
        ["Net merchandise", data.totals.netMerchandiseMinor, "money"],
        [
          isAdmin ? "HelaCart commission accrued" : "Commission accrued",
          data.totals.commissionAccruedMinor,
          "money",
        ],
        [
          isAdmin
            ? "Verified commission collected"
            : "Verified commission payments",
          data.totals.commissionCollectedMinor,
          "money",
        ],
        ["Delivery fees", data.totals.shippingMinor, "money"],
        ["Verified delivery refunds", data.totals.refundShippingMinor, "money"],
      ] as const)
    : [];
  const productPages = Math.max(
    1,
    Math.ceil((data?.products.length ?? 0) / 20),
  );
  return (
    <>
      <div className={s.intro}>
        <span className="section-kicker">KNOW YOUR BUSINESS</span>
        <h1>{isAdmin ? "Marketplace reports" : "Business reports"}</h1>
        <p>
          {isAdmin
            ? "Track delivered marketplace sales, shop performance and HelaCart commission."
            : "Track your shop’s delivered sales, products, returns and commission."}{" "}
          All date boundaries use Sri Lanka time.
        </p>
      </div>
      {isPreview && (
        <p className={s.notice}>
          Connect the live API to load your business reports. Preview screens do
          not invent sales figures.
        </p>
      )}
      <section className={s.panel}>
        <form
          className={s.toolbar}
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            if (draft.from > draft.to) {
              setError("Start date must be on or before the end date");
              return;
            }
            if (
              (Date.parse(draft.to) - Date.parse(draft.from)) / 86400000 >=
              366
            ) {
              setError("Choose a date range of at most 366 days");
              return;
            }
            setRange({ ...draft });
            setPage(1);
            report.reload();
          }}
        >
          <label>
            From date
            <input
              required
              type="date"
              min="2000-01-01"
              max="2100-12-31"
              value={draft.from}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            />
          </label>
          <label>
            To date
            <input
              required
              type="date"
              min="2000-01-01"
              max="2100-12-31"
              value={draft.to}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            />
          </label>
          <button type="submit" className="primary-btn" disabled={isPreview}>
            Load report
          </button>
        </form>
        <div className={s.toolbar}>
          <label>
            CSV report
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
            >
              <option value="DAILY">Daily totals</option>
              <option value="PRODUCTS">Product performance</option>
              {isAdmin && <option value="SHOPS">Shop performance</option>}
              <option value="SUMMARY">Summary & current stock</option>
            </select>
          </label>
          <button
            type="button"
            className="outline-btn"
            disabled={isPreview || !data || busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await download(
                  `${root}/export.csv?${query}&section=${section}`,
                  `helacart-${section.toLowerCase()}-${range.from}-${range.to}.csv`,
                );
              } catch (error) {
                setError(errorMessage(error));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Preparing CSV…" : "Download CSV"}
          </button>
        </div>
      </section>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      {report.loading && <p role="status">Preparing your business report…</p>}
      {report.error && (
        <p className={s.error} role="alert">
          {report.error}{" "}
          <button className="outline-btn" onClick={report.reload}>
            Retry report
          </button>
        </p>
      )}
      {data && (
        <>
          <p className={s.small}>
            Report: {data.from} to {data.to} · Asia/Colombo · Generated{" "}
            {formatSellerDate(data.generatedAt, true)}
          </p>
          <div className={s.grid}>
            {metrics.map(([label, value, type]) => (
              <article className={s.stat} key={label}>
                <span>{label}</span>
                <strong>
                  {type === "money"
                    ? money(value)
                    : value.toLocaleString("en-LK")}
                </strong>
              </article>
            ))}
          </div>
          <details className={s.panel}>
            <summary>How these figures are calculated</summary>
            <p className={s.muted}>
              Sales use the delivered date and saved order prices. The COD total
              is money collected by sellers. Refunds and commission payments use
              their verification dates, with corrections recorded on the
              correction date. Net merchandise subtracts verified merchandise
              refunds recorded in the period; those refunds can relate to older
              sales. Commission accrued includes ledger charges and credits,
              including amounts still held. These figures describe sales and
              ledger activity; product costs, taxes and operating expenses are
              not recorded here.
            </p>
          </details>
          <section className={s.panel}>
            <div className={s.heading}>
              <h2>Daily delivered sales</h2>
              <span className={s.small}>
                Merchandise value · {data.daily.length} days
              </span>
            </div>
            {data.daily.every((r) => r.grossMerchandiseMinor === 0) ? (
              <p className={s.notice}>
                No delivered sales were recorded in this period.
              </p>
            ) : (
              <div
                className={s.chartWrap}
                role="region"
                tabIndex={0}
                aria-label="Daily delivered merchandise sales"
              >
                <div className={s.chart}>
                  {data.daily.map((row) => (
                    <div
                      className={s.bar}
                      key={row.day}
                      tabIndex={0}
                      style={{
                        height: `${Math.max(1, (row.grossMerchandiseMinor / maxSale) * 100)}%`,
                      }}
                      title={`${row.day}: ${money(row.grossMerchandiseMinor)} · ${row.deliveredOrders} orders`}
                      aria-label={`${row.day}: ${money(row.grossMerchandiseMinor)}, ${row.deliveredOrders} delivered shop orders`}
                    />
                  ))}
                </div>
              </div>
            )}
            <p className={s.small}>
              Hover or focus a bar for its date and amount. Download daily
              totals for every value.
            </p>
          </section>
          <section className={s.panel}>
            <h2>Product performance</h2>
            <p className={s.muted}>
              Ranked by delivered merchandise value at order prices. CSV
              includes all {data.products.length} matching products.
            </p>
            <div
              className={s.tableWrap}
              role="region"
              tabIndex={0}
              aria-label="Product performance"
            >
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Units</th>
                    <th>Shop orders</th>
                    <th>Merchandise</th>
                  </tr>
                </thead>
                <tbody>
                  {data.products
                    .slice((page - 1) * 20, page * 20)
                    .map((row) => (
                      <tr key={row.id}>
                        <td>
                          <strong>{row.title}</strong>
                          <small>{row.sku}</small>
                        </td>
                        <td>{row.units}</td>
                        <td>{row.orders}</td>
                        <td>{money(row.merchandiseMinor)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {!data.products.length && (
              <p className={s.muted}>No delivered products in this period.</p>
            )}
            <ToolPagination page={page} pages={productPages} onPage={setPage} />
          </section>
          {isAdmin && (
            <section className={s.panel}>
              <h2>Shop performance</h2>
              <p className={s.muted}>
                Top 20 shops by delivered merchandise. Download the shop CSV for
                all {data.shops.length} matching shops.
              </p>
              <div
                className={s.tableWrap}
                role="region"
                tabIndex={0}
                aria-label="Shop performance"
              >
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>Shop</th>
                      <th>Delivered shop orders</th>
                      <th>Merchandise</th>
                      <th>Delivery fees</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.shops.slice(0, 20).map((row) => (
                      <tr key={row.id}>
                        <td>{row.name}</td>
                        <td>{row.orders}</td>
                        <td>{money(row.merchandiseMinor)}</td>
                        <td>{money(row.shippingMinor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          <section className={s.panel}>
            <h2>Orders & customer care</h2>
            <p className={s.muted}>
              Shop orders placed in the selected period, grouped by their
              current status. Support and return counts use the date the case
              was opened.
            </p>
            <div className={s.actions}>
              {data.orderStatuses.map((row) => (
                <span className={s.badge} key={row.status}>
                  {row.status}: {row.count}
                </span>
              ))}
            </div>
            <p>
              Returns opened: <strong>{data.customerCare.returnsOpened}</strong>{" "}
              · Support cases opened:{" "}
              <strong>{data.customerCare.supportOpened}</strong>
            </p>
          </section>
          <section className={s.panel}>
            <h2>Current stock snapshot</h2>
            <p className={s.muted}>
              Current quantities across all listings, including drafts. This
              snapshot is taken when the report is generated and does not use
              the date filter.
            </p>
            <div className={s.grid}>
              {[
                ["Variants", data.inventory.variants],
                ["On hand", data.inventory.onHand],
                ["Reserved", data.inventory.reserved],
                ["Available", data.inventory.available],
                ["Low stock alerts enabled", data.inventory.low],
                ["Out of available stock", data.inventory.out],
              ].map(([label, value]) => (
                <article className={s.stat} key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}
