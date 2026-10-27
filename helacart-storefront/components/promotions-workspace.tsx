"use client";
import { useRef, useState } from "react";
import { errorMessage } from "@/lib/api";
import type { Page } from "@/lib/shops";
import type { SellerProduct } from "@/lib/seller";
import { formatSellerDate, rupeesToMinor } from "@/lib/seller";
import type { ToolRequest } from "@/lib/business-tools";
import { useDebounced } from "./list-controls";
import { useFeedbackResource, ReasonDialog } from "./product-reviews";
import { ToolPagination } from "./bulk-tools-workspace";
import s from "./business-tools.module.css";
import d from "./discovery.module.css";
type Promotion = {
  id: string;
  productId: string;
  name: string;
  discountBps: number;
  startsAt: string;
  endsAt: string;
  status: string;
  version: number;
  product: { id: string; title: string; sku: string };
  seller: { name: string };
  events: {
    version: number;
    status: string;
    reason: string;
    createdAt: string;
  }[];
};
export function PromotionsWorkspace({
  root,
  request,
  isPreview,
  isAdmin = false,
  canCreate = true,
}: {
  root: string;
  request: ToolRequest;
  isPreview: boolean;
  isAdmin?: boolean;
  canCreate?: boolean;
}) {
  const [status, setStatus] = useState(isAdmin ? "PENDING" : "ALL");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<{
    row: Promotion;
    status: string;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const list = useFeedbackResource<Page<Promotion>>(
    `${root}?status=${status}&page=${page}`,
    request,
    !isPreview,
  );
  return (
    <>
      <div className={s.intro}>
        <span className="section-kicker">
          GIVE BUYERS A GOOD REASON TO LOOK
        </span>
        <h1>Product promotions</h1>
        <p>
          {isAdmin
            ? "Review seller-funded product offers before they become visible."
            : "Create a scheduled offer for an approved product. HelaCart reviews each promotion before it can run."}{" "}
          Active offers apply automatically to all variants, using the strongest
          approved offer when schedules overlap.
        </p>
      </div>
      <p className={s.notice}>
        Discounts apply to merchandise before delivery charges. Commission uses
        the discounted order value. Dates shown here use Sri Lanka time;
        existing orders retain their saved prices.
      </p>
      {isPreview ? (
        <p className={s.notice}>Connect the API to manage real promotions.</p>
      ) : !isAdmin && canCreate ? (
        <PromotionCreate
          root={root}
          request={request}
          onSaved={() => {
            setNotice("Promotion submitted for HelaCart approval.");
            list.reload();
          }}
        />
      ) : null}
      {notice && (
        <p className={s.notice} role="status">
          {notice}
        </p>
      )}
      <section className={s.panel}>
        <div className={s.toolbar}>
          <label>
            Promotion status
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              {["ALL", "PENDING", "APPROVED", "REJECTED", "CANCELLED"].map(
                (v) => (
                  <option key={v}>{v}</option>
                ),
              )}
            </select>
          </label>
          <button
            className="outline-btn"
            disabled={isPreview}
            onClick={list.reload}
          >
            Refresh promotions
          </button>
        </div>
        {list.loading && <p role="status">Loading promotions…</p>}
        {list.error && (
          <p className={s.error} role="alert">
            {list.error}
            <button className="outline-btn" onClick={list.reload}>
              Retry
            </button>
          </p>
        )}
        <div className={s.picker}>
          {list.data?.items.map((row) => (
            <article className={d.promotionCard} key={row.id}>
              <h3>{row.name}</h3>
              <span className={s.badge}>{row.status}</span>
              <p>
                <strong>{row.product.title}</strong>
                <br />
                {row.product.sku} · {row.seller.name}
              </p>
              <p>
                {row.discountBps / 100}% merchandise discount
                <br />
                {formatSellerDate(row.startsAt, true)} →{" "}
                {formatSellerDate(row.endsAt, true)}
              </p>
              <div className={d.promotionActions}>
                {isAdmin && row.status === "PENDING" && (
                  <>
                    <button
                      className="outline-btn"
                      onClick={() => setTarget({ row, status: "REJECTED" })}
                    >
                      Reject promotion
                    </button>
                    <button
                      className="primary-btn"
                      onClick={() => setTarget({ row, status: "APPROVED" })}
                    >
                      Approve promotion
                    </button>
                  </>
                )}
                {["PENDING", "APPROVED"].includes(row.status) && (
                  <button
                    className="outline-btn"
                    onClick={() => setTarget({ row, status: "CANCELLED" })}
                  >
                    Cancel promotion
                  </button>
                )}
              </div>
              {row.events.length > 0 && (
                <details className={d.history}>
                  <summary>Decision history</summary>
                  {row.events.map((e) => (
                    <p key={e.version}>
                      <strong>
                        {e.status} · {formatSellerDate(e.createdAt, true)}
                      </strong>
                      <br />
                      {e.reason}
                    </p>
                  ))}
                </details>
              )}
            </article>
          ))}
        </div>
        {list.data && !list.data.items.length && (
          <p className={s.muted}>No promotions match this status.</p>
        )}
        {list.data && (
          <ToolPagination
            page={page}
            pages={list.data.pages}
            onPage={setPage}
          />
        )}
      </section>
      {target && (
        <ReasonDialog
          title={
            target.status === "APPROVED"
              ? "Approve product promotion"
              : target.status === "REJECTED"
                ? "Reject product promotion"
                : "Cancel product promotion"
          }
          description={`${target.row.name} · ${target.row.product.title}. This decision is recorded. Approved offers apply only within their scheduled dates.`}
          submitLabel="Record promotion decision"
          onClose={() => setTarget(null)}
          onConfirm={async (reason) => {
            await request(`${root}/${target.row.id}`, "PATCH", {
              version: target.row.version,
              status: target.status,
              reason,
            });
            setNotice("Promotion decision recorded.");
            list.reload();
          }}
        />
      )}
    </>
  );
}
function PromotionCreate({
  root,
  request,
  onSaved,
}: {
  root: string;
  request: ToolRequest;
  onSaved: () => void;
}) {
  const [q, setQ] = useState("");
  const search = useDebounced(q);
  const [product, setProduct] = useState("");
  const [name, setName] = useState("");
  const [discount, setDiscount] = useState("");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const identity = useRef({ payload: "", key: "" });
  const sellerId = root.split("/")[2];
  const products = useFeedbackResource<Page<SellerProduct>>(
    `/workspace/sellers/${sellerId}/products?status=APPROVED&limit=50${search.trim().length >= 2 ? `&q=${encodeURIComponent(search.trim())}` : ""}`,
    request,
  );
  return (
    <section className={s.panel}>
      <h2>Schedule a product offer</h2>
      <form
        className={d.promotionForm}
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setError("");
          const bps = rupeesToMinor(discount);
          if (bps === null || bps < 100 || bps > 9000) {
            setError(
              "Use a discount from 1% to 90%, with at most two decimal places",
            );
            return;
          }
          const startsAt = new Date(`${starts}:00+05:30`),
            endsAt = new Date(`${ends}:00+05:30`);
          if (
            !Number.isFinite(startsAt.getTime()) ||
            !Number.isFinite(endsAt.getTime()) ||
            endsAt <= startsAt
          ) {
            setError("End time must be after the start time");
            return;
          }
          setBusy(true);
          try {
            const input = {
                productId: product,
                name: name.trim(),
                discountBps: bps,
                startsAt: startsAt.toISOString(),
                endsAt: endsAt.toISOString(),
              },
              payload = JSON.stringify(input);
            if (identity.current.payload !== payload)
              identity.current = { payload, key: crypto.randomUUID() };
            await request(root, "POST", {
              ...input,
              requestKey: identity.current.key,
            });
            setName("");
            setDiscount("");
            setStarts("");
            setEnds("");
            identity.current = { payload: "", key: "" };
            onSaved();
          } catch (error) {
            setError(errorMessage(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Find an approved product
          <input
            value={q}
            maxLength={80}
            disabled={busy}
            onChange={(e) => {
              setQ(e.target.value);
              setProduct("");
            }}
            placeholder="Search title or SKU to narrow the first 50 matches"
          />
        </label>
        <label>
          Product
          <select
            value={product}
            required
            disabled={busy || products.loading}
            onChange={(e) => setProduct(e.target.value)}
          >
            <option value="">Choose a product</option>
            {products.data?.items.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} · {p.sku}
              </option>
            ))}
          </select>
        </label>
        {products.error && (
          <p className={s.error} role="alert">
            {products.error}
            <button type="button" onClick={products.reload}>
              Retry products
            </button>
          </p>
        )}
        <div className={d.formGrid}>
          <label>
            Promotion name
            <input
              required
              minLength={3}
              maxLength={100}
              value={name}
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weekend finds"
            />
          </label>
          <label>
            Discount percentage
            <input
              required
              inputMode="decimal"
              value={discount}
              disabled={busy}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="e.g. 10"
            />
          </label>
          <label>
            Starts (Sri Lanka time)
            <input
              type="datetime-local"
              required
              value={starts}
              disabled={busy}
              onChange={(e) => setStarts(e.target.value)}
            />
          </label>
          <label>
            Ends (Sri Lanka time)
            <input
              type="datetime-local"
              required
              value={ends}
              disabled={busy}
              onChange={(e) => setEnds(e.target.value)}
            />
          </label>
        </div>
        {error && (
          <p className={s.error} role="alert">
            {error}
          </p>
        )}
        <div>
          <button className="primary-btn" disabled={busy}>
            {busy ? "Submitting…" : "Submit promotion for approval"}
          </button>
        </div>
      </form>
    </section>
  );
}
