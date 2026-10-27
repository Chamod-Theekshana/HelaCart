"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { errorMessage, money } from "@/lib/api";
import type { Page } from "@/lib/shops";
import type { SellerProduct } from "@/lib/seller";
import { formatSellerDate } from "@/lib/seller";
import { useDebounced } from "./list-controls";
import { useFeedbackResource } from "./product-reviews";
import { ProductSpecifications } from "./product-specifications";
import { StorefrontImage } from "./storefront-image";
import {
  useBusinessDownload,
  type BulkJob,
  type BulkHistory,
  type BulkKind,
  type ToolRequest,
} from "@/lib/business-tools";
import s from "./business-tools.module.css";
const labels: Record<BulkKind, string> = {
  STOCK_SET: "Update physical stock from CSV",
  PRODUCT_SUBMIT: "Submit products for approval",
  PRODUCT_HIDE: "Hide live products",
  PRODUCT_APPROVE: "Approve product listings",
  PRODUCT_REJECT: "Reject product listings",
};
export function BulkToolsWorkspace({
  root,
  role,
  request,
  isPreview,
}: {
  root: string;
  role: "SELLER" | "ADMIN";
  request: ToolRequest;
  isPreview: boolean;
}) {
  const [kind, setKind] = useState<BulkKind>(
    role === "SELLER" ? "STOCK_SET" : "PRODUCT_APPROVE",
  );
  const [csv, setCsv] = useState("");
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [job, setJob] = useState<BulkJob | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [page, setPage] = useState(1);
  const [jobPage, setJobPage] = useState(1);
  const [search, setSearch] = useState("");
  const identity = useRef({ payload: "", key: "" });
  const download = useBusinessDownload();
  const history = useFeedbackResource<Page<BulkHistory>>(
    `${root}/jobs?page=${jobPage}`,
    request,
    !isPreview,
  );
  async function preview(e: FormEvent) {
    e.preventDefault();
    if (isPreview || busy) return;
    setError("");
    setNotice("");
    setBusy("preview");
    try {
      if (kind !== "STOCK_SET" && !selected.length)
        throw Error("Select at least one product");
      const input = {
        kind,
        reason: reason.trim(),
        ...(kind === "STOCK_SET"
          ? { csv }
          : { productIds: selected.slice().sort() }),
      };
      const payload = JSON.stringify(input);
      if (identity.current.payload !== payload)
        identity.current = { payload, key: crypto.randomUUID() };
      const result = await request<BulkJob>(`${root}/preview`, "POST", {
        ...input,
        requestKey: identity.current.key,
      });
      setJob(result);
      setPage(1);
      setConfirmed(false);
      history.reload();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy("");
    }
  }
  async function apply() {
    if (!job || busy || !confirmed || isPreview) return;
    setBusy("apply");
    setError("");
    setNotice("");
    try {
      const result = await request<BulkJob>(
        `${root}/jobs/${job.id}/apply`,
        "POST",
      );
      setJob(result);
      setNotice("Bulk changes applied and recorded.");
      history.reload();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy("");
    }
  }
  async function open(id: string) {
    if (busy) return;
    setBusy("history");
    setError("");
    try {
      setJob(await request<BulkJob>(`${root}/jobs/${id}`));
      setConfirmed(false);
      setPage(1);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <div className={s.intro}>
        <span className="section-kicker">SAVE TIME ON DAILY WORK</span>
        <h1>Bulk tools</h1>
        <p>
          {role === "SELLER"
            ? "Update stock or manage several listings in one action."
            : "Review selected listings and record one approval or rejection action."}{" "}
          Preview the exact changes before applying them.
        </p>
      </div>
      {isPreview && (
        <p className={s.notice}>
          Design preview. Connect the API to import files or change real
          listings.
        </p>
      )}
      <div className={s.steps}>
        <span>1. Choose rows</span>
        <span>2. Review preview</span>
        <span>3. Confirm & apply</span>
      </div>
      {!job && (
        <form
          className={`${s.panel} ${s.form}`}
          onSubmit={(e) => void preview(e)}
        >
          <label>
            Bulk action
            <select
              value={kind}
              disabled={!!busy}
              onChange={(e) => {
                setKind(e.target.value as BulkKind);
                setSelected([]);
                setError("");
              }}
            >
              {(role === "SELLER"
                ? ["STOCK_SET", "PRODUCT_SUBMIT", "PRODUCT_HIDE"]
                : ["PRODUCT_APPROVE", "PRODUCT_REJECT"]
              ).map((k) => (
                <option key={k} value={k}>
                  {labels[k as BulkKind]}
                </option>
              ))}
            </select>
          </label>
          {kind === "STOCK_SET" ? (
            <>
              <div className={s.toolbar}>
                <label>
                  Template search
                  <input
                    value={search}
                    maxLength={100}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Product name or SKU"
                  />
                </label>
                <button
                  type="button"
                  className="outline-btn"
                  disabled={isPreview || !!busy}
                  onClick={async () => {
                    setBusy("download");
                    setError("");
                    try {
                      await download(
                        `${root}/stock-template.csv${search.trim().length >= 2 ? `?q=${encodeURIComponent(search.trim())}` : ""}`,
                        "helacart-stock-template.csv",
                      );
                    } catch (error) {
                      setError(errorMessage(error));
                    } finally {
                      setBusy("");
                    }
                  }}
                >
                  Download stock template
                </button>
              </div>
              <p className={s.muted}>
                The template contains all matching variants, up to 500. Change{" "}
                <strong>on_hand</strong> to the physical quantity you counted.
                Reserved units stay protected.
              </p>
              <label className={s.file}>
                Choose a CSV file
                <input
                  type="file"
                  accept=".csv,text/csv"
                  disabled={isPreview || !!busy}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    if (file.size > 65536) {
                      setError(
                        "Choose a CSV file up to 64 KB. Import up to 500 rows at a time.",
                      );
                      return;
                    }
                    setBusy('file');
                    try {setCsv(await file.text());setError('');}
                    catch(error){setError(errorMessage(error));}
                    finally {setBusy('');}
                  }}
                />
              </label>
              <label>
                CSV contents
                <textarea
                  rows={8}
                  maxLength={100000}
                  value={csv}
                  disabled={!!busy}
                  onChange={(e) => setCsv(e.target.value)}
                  placeholder={"sku,on_hand\nSHIRT-BLUE,25\nBAG-001,10"}
                  required
                />
              </label>
            </>
          ) : (
            <ProductPicker
              key={kind}
              kind={kind}
              role={role}
              root={root}
              request={request}
              isPreview={isPreview}
              selected={selected}
              onSelected={setSelected}
              disabled={!!busy}
            />
          )}
          <label>
            Reason for this change
            <textarea
              required
              minLength={10}
              maxLength={500}
              rows={3}
              value={reason}
              disabled={!!busy}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Physical stock count after the weekly delivery"
            />
          </label>
          <div className={s.actions}>
            <button
              className="primary-btn"
              type="submit"
              disabled={isPreview || !!busy}
            >
              {busy === "preview" ? "Preparing preview…" : "Create preview"}
            </button>
            <small className={s.small}>
              Previews remain available for 20 minutes.
            </small>
          </div>
        </form>
      )}
      {error && (
        <div className={s.error} role="alert">
          {error}
        </div>
      )}
      {notice && (
        <p className={s.notice} role="status">
          {notice}
        </p>
      )}
      {job && (
        <section className={s.panel}>
          <div className={s.heading}>
            <div>
              <h2>{labels[job.kind]}</h2>
              <p className={s.muted}>
                {job.preview.rows.length} rows ·{" "}
                {job.status === "APPLIED"
                  ? "Applied"
                  : `Expires ${formatSellerDate(job.expiresAt, true)}`}
              </p>
            </div>
            <button
              className="outline-btn"
              disabled={!!busy}
              onClick={() => {
                setJob(null);
                setConfirmed(false);
                identity.current = { payload: "", key: "" };
                setError("");
                setNotice("");
              }}
            >
              Start a new preview
            </button>
          </div>
          <p className={s.text}>
            <strong>Reason: </strong>
            {job.reason}
          </p>
          {!job.preview.valid && (
            <p className={s.error}>
              Some rows are invalid. Correct the data and create a new preview;
              this preview cannot be applied.
            </p>
          )}
          <div
            className={s.tableWrap}
            tabIndex={0}
            role="region"
            aria-label="Bulk change preview"
          >
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Product / SKU</th>
                  <th>Before</th>
                  <th>After</th>
                  <th>Check</th>
                </tr>
              </thead>
              <tbody>
                {job.preview.rows
                  .slice((page - 1) * 20, page * 20)
                  .map((row, index) => (
                    <tr key={`${row.id}:${index}`}>
                      <td>
                        <strong>{row.title}</strong>
                        <small>
                          {row.sku}
                          {row.row ? ` · CSV row ${row.row}` : ""}
                        </small>
                      </td>
                      <td>
                        {row.before}
                        {row.reserved !== undefined && (
                          <small>{row.reserved} reserved</small>
                        )}
                      </td>
                      <td>
                        {row.after}
                        {row.delta !== undefined && (
                          <small>
                            Change: {row.delta > 0 ? "+" : ""}
                            {row.delta}
                          </small>
                        )}
                      </td>
                      <td>
                        {row.error ? (
                          <span className={s.error}>{row.error}</span>
                        ) : (
                          <span className={s.badge}>
                            {job.status === "APPLIED" ? "Applied" : "Ready"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <ToolPagination
            page={page}
            pages={Math.ceil(job.preview.rows.length / 20)}
            onPage={setPage}
          />
          {job.status === "PREVIEW" && (
            <div className={s.form}>
              <p className={s.muted}>
                If stock, reservations or listing details change after this
                preview, the entire action is rejected so you can review a fresh
                preview.
              </p>
              <label className={s.check}>
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={!!busy || !job.preview.valid}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                I checked these rows and confirm this{" "}
                {role === "ADMIN"
                  ? "listing decision"
                  : "stock or listing change"}
                .
              </label>
              <button
                className="primary-btn"
                disabled={
                  isPreview || !!busy || !job.preview.valid || !confirmed
                }
                onClick={() => void apply()}
              >
                {busy === "apply" ? "Applying changes…" : "Apply these changes"}
              </button>
            </div>
          )}
        </section>
      )}
      <section className={s.panel}>
        <div className={s.heading}>
          <h2>Your recent bulk actions</h2>
          <button
            className="outline-btn"
            disabled={isPreview || !!busy}
            onClick={history.reload}
          >
            Refresh history
          </button>
        </div>
        {history.loading && <p role="status">Loading action history…</p>}
        {history.error && (
          <p className={s.error} role="alert">
            {history.error}
          </p>
        )}
        {history.data && (
          <>
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Created</th>
                    <th>Status</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {history.data.items.map((row) => (
                    <tr key={row.id}>
                      <td>
                        {labels[row.kind]}
                        <small>{row.reason}</small>
                      </td>
                      <td>{formatSellerDate(row.createdAt, true)}</td>
                      <td>{row.status}</td>
                      <td>
                        <button
                          className="outline-btn"
                          disabled={!!busy}
                          onClick={() => void open(row.id)}
                        >
                          Open action
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!history.data.items.length && (
              <p className={s.muted}>No bulk actions yet.</p>
            )}
            <ToolPagination
              page={jobPage}
              pages={history.data.pages}
              onPage={setJobPage}
            />
          </>
        )}
      </section>
    </>
  );
}
function ProductPicker({
  kind,
  role,
  root,
  request,
  isPreview,
  selected,
  onSelected,
  disabled,
}: {
  kind: BulkKind;
  role: "SELLER" | "ADMIN";
  root: string;
  request: ToolRequest;
  isPreview: boolean;
  selected: string[];
  onSelected: (ids: string[]) => void;
  disabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const search = useDebounced(query);
  const [status, setStatus] = useState(
    kind === "PRODUCT_SUBMIT"
      ? "DRAFT"
      : kind === "PRODUCT_HIDE"
        ? "APPROVED"
        : "PENDING",
  );
  const filter = `${search}:${status}`;
  const [paging, setPaging] = useState({ filter: "", page: 1 });
  const page = paging.filter === filter ? paging.page : 1;
  const sellerId = root.split("/")[2];
  const path =
    role === "ADMIN"
      ? "/workspace/admin/products"
      : `/workspace/sellers/${sellerId}/products`;
  const list = useFeedbackResource<Page<SellerProduct>>(
    `${path}?status=${status}&page=${page}${search.trim().length >= 2 ? `&q=${encodeURIComponent(search.trim())}` : ""}`,
    request,
    !isPreview,
  );
  return (
    <fieldset disabled={disabled}>
      <div className={s.toolbar}>
        <label>
          Find products
          <input
            value={query}
            maxLength={100}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title or SKU"
          />
        </label>
        {kind === "PRODUCT_SUBMIT" && (
          <label>
            Listing status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="DRAFT">Draft</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </label>
        )}
      </div>
      <div className={s.actions}>
        <strong>{selected.length}/100 selected</strong>
        <button
          type="button"
          className="outline-btn"
          onClick={() => onSelected([])}
        >
          Clear selection
        </button>
      </div>
      {list.loading && <p role="status">Loading products…</p>}
      {list.error && (
        <p className={s.error} role="alert">
          {list.error}{" "}
          <button type="button" className="outline-btn" onClick={list.reload}>
            Retry
          </button>
        </p>
      )}
      <div className={s.picker}>
        {list.data?.items.map((product) => (
          <article className={s.pickCard} key={product.id}>
            <label>
              <input
                type="checkbox"
                checked={selected.includes(product.id)}
                disabled={
                  disabled ||
                  (!selected.includes(product.id) && selected.length >= 100)
                }
                onChange={(e) =>
                  onSelected(
                    e.target.checked
                      ? [...selected, product.id]
                      : selected.filter((id) => id !== product.id),
                  )
                }
              />
              <span>
                <strong>{product.title}</strong>
                <br />
                <small>
                  {product.sku} · {product.status}
                </small>
              </span>
            </label>
            <details>
              <summary>Review listing details</summary>
              <p>{product.description}</p>
              <div className={s.images}>
                {product.imageUrls.map((url) => (
                  <StorefrontImage
                    key={url}
                    src={url}
                    alt={product.title}
                    fallback={<span>Image unavailable</span>}
                  />
                ))}
              </div>
              <ProductSpecifications product={product} />
              <p>
                {money(product.priceLkrMinor)} · {product.variants.length}{" "}
                variants
              </p>
              {role === "SELLER" && (
                <Link
                  className="text-link"
                  href={`/seller/products/${product.id}`}
                >
                  Open product
                </Link>
              )}
            </details>
          </article>
        ))}
      </div>
      {list.data && !list.data.items.length && (
        <p className={s.notice}>No products match these filters.</p>
      )}
      {list.data && (
        <ToolPagination
          page={page}
          pages={list.data.pages}
          onPage={(p) => setPaging({ filter, page: p })}
        />
      )}
    </fieldset>
  );
}
export function ToolPagination({
  page,
  pages,
  onPage,
}: {
  page: number;
  pages: number;
  onPage: (page: number) => void;
}) {
  return pages > 1 ? (
    <div className={s.pagination}>
      <button
        type="button"
        className="outline-btn"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </button>
      <span>
        Page {page} of {pages}
      </span>
      <button
        type="button"
        className="outline-btn"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </div>
  ) : null;
}
