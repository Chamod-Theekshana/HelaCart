"use client";
import {variantNeedsStock} from "@/lib/seller";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Box,
  PackageCheck,
  Search,
  ShieldCheck,
} from "lucide-react";
import { errorMessage, money } from "@/lib/api";
import {
  previewInventory,
  previewSellerSummary,
  type SellerSummary,
  type InventoryEntry,
} from "@/lib/workspace";
import {
  useSeller,
  useSellerList,
  useSellerResource,
} from "@/components/seller-provider";
import { SellerPageHeading, SellerStatusBadge } from "@/components/seller-ui";

type Entry = InventoryEntry;
export default function SellerInventory() {
  const { seller, isPreview, request, refreshProducts } = useSeller();
  const [query, setQuery] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const sample = previewInventory.filter(
    ({ product, variant }) =>
      (!lowOnly || variantNeedsStock(variant)) &&
      (product.title + " " + variant.sku)
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const resource = useSellerList<Entry>(
    "inventory",
    { q: query, stock: lowOnly ? "LOW" : "ALL" },
    sample,
  );
  const summary = useSellerResource<SellerSummary>(
    "summary",
    previewSellerSummary,
  );
  const rows = resource.data ?? [],
    dataLoading = resource.loading,
    totalOnHand = summary.data?.onHand ?? 0,
    totalReserved = summary.data?.reserved ?? 0;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!seller || !selected || isPreview) return;
    const change = Number(delta);
    if (
      !Number.isInteger(change) ||
      change === 0 ||
      Math.abs(change) > 1_000_000
    ) {
      setNotice(
        "Enter a nonzero whole stock change, between -1000000 and 1000000.",
      );
      return;
    }
    if (reason.trim().length < 5) {
      setNotice("Add a reason of at least five characters.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      await request(
        `/sellers/${seller.id}/products/${selected.product.id}/variants/${selected.variant.id}/stock-adjustments`,
        "POST",
        { delta: change, reason: reason.trim() },
      );
      await refreshProducts();
      setSelected(null);
      setDelta("");
      setReason("");
      setNotice("Stock saved and adjustment recorded.");
    } catch (cause) {
      setNotice(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <SellerPageHeading
        kicker="STOCK CONTROL"
        title="Inventory & stock"
        description="Track physical, reserved and available units for every variant."
      />
      <section className="seller-stock-formula">
        <div>
          <ShieldCheck size={23} />
          <div>
            <strong>Available inventory</strong>
            <small>
              On hand minus stock reserved for active orders is what buyers can
              purchase.
            </small>
          </div>
        </div>
        <div className="seller-formula-values">
          <span>
            <small>On hand</small>
            <strong>{totalOnHand}</strong>
          </span>
          <b>−</b>
          <span>
            <small>Reserved</small>
            <strong>{totalReserved}</strong>
          </span>
          <b>=</b>
          <span className="result">
            <small>Available</small>
            <strong>{Math.max(0, totalOnHand - totalReserved)}</strong>
          </span>
        </div>
        {resource.pagination}
      </section>
      <div className="seller-stats compact">
        <article className="seller-stat">
          <span className="seller-stat-label">
            Total variants <Box size={17} />
          </span>
          <strong>{summary.data?.variants ?? "—"}</strong>
        </article>
        <article className="seller-stat">
          <span className="seller-stat-label">
            Low stock (configured levels) <PackageCheck size={17} />
          </span>
          <strong>{summary.data?.lowStock ?? "—"}</strong>
        </article>
        <article className="seller-stat">
          <span className="seller-stat-label">
            Out of stock <Box size={17} />
          </span>
          <strong>{summary.data?.outOfStock ?? "—"}</strong>
        </article>
      </div>
      {(resource.error || summary.error) && (
        <div className="message error" role="alert">
          {resource.error || summary.error}
          <button
            onClick={() => {
              resource.reload();
              summary.reload();
            }}
          >
            Try again
          </button>
        </div>
      )}
      {notice && (
        <div className="message info" role="status">
          {notice}
        </div>
      )}
      <div className="seller-card seller-toolbar">
        <label className="seller-search">
          <Search size={17} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search product or SKU"
            aria-label="Search inventory"
          />
        </label>
        <label className="seller-checkbox">
          <input
            type="checkbox"
            checked={lowOnly}
            onChange={(e) => setLowOnly(e.target.checked)}
          />{" "}
          Low stock only
        </label>
        <span>{resource.page?.total ?? "—"} variants</span>
      </div>
      <section className="seller-card seller-inventory-matrix">
        <div className="seller-card-heading">
          <div>
            <h2>Active variant matrix</h2>
            <p>{rows.length} variants in view</p>
          </div>
        </div>
        <div
          className="seller-table-wrap"
          role="region"
          aria-label="Inventory variants"
          tabIndex={0}
        >
          {rows.length ? (
            <table className="seller-table">
              <thead>
                <tr>
                  <th>Product / variant</th>
                  <th>Price</th>
                  <th>On hand</th>
                  <th>Reserved</th>
                  <th>Available</th>
                  <th>Stock</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ product, variant }) => (
                  <tr key={variant.id}>
                    <td>
                      <Link
                        className="seller-product-cell"
                        href={`/seller/products/${product.id}`}
                      >
                        <span className="seller-thumb">
                          {product.imageUrls[0] ? (
                            <img src={product.imageUrls[0]} alt="" />
                          ) : (
                            <Box size={21} />
                          )}
                        </span>
                        <span>
                          <strong>{product.title}</strong>
                          <small>
                            {variant.sku} ·{" "}
                            <SellerStatusBadge status={product.status} />
                          </small>
                        </span>
                      </Link>
                    </td>
                    <td>{money(variant.priceLkrMinor)}</td>
                    <td>{variant.onHand}</td>
                    <td>{variant.reserved}</td>
                    <td>
                      <strong
                        className={
                          variantNeedsStock(variant)
                            ? "seller-low"
                            : ""
                        }
                      >
                        {Math.max(0, variant.onHand - variant.reserved)}
                      </strong>
                      <small className="seller-cell-note">
                        {variant.onHand - variant.reserved <= 0
                          ? "Out of stock"
                          : variantNeedsStock(variant)
                            ? "Low stock"
                            : "In stock"}
                      </small>
                    </td>
                    <td>
                      <button
                        className="seller-text-button"
                        disabled={isPreview}
                        onClick={() => {
                          setSelected({ product, variant });
                          setDelta("");
                          setReason("");
                        }}
                      >
                        Adjust <ArrowRight size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="seller-empty">
              {dataLoading
                ? "Loading inventory…"
                : "No variants match your search."}
            </div>
          )}
        </div>
      </section>
      {selected && (
        <section className="seller-card seller-adjust-panel">
          <div>
            <span className="section-kicker">QUICK STOCK ADJUSTMENT</span>
            <h2>{selected.product.title}</h2>
            <p>
              {selected.variant.sku} · On hand {selected.variant.onHand} ·
              Reserved {selected.variant.reserved}
            </p>
            <div className="seller-projected">
              <small>Projected available after adjustment</small>
              <strong>
                {Number.isInteger(Number(delta))
                  ? Math.max(
                      0,
                      selected.variant.onHand +
                        Number(delta) -
                        selected.variant.reserved,
                    )
                  : Math.max(
                      0,
                      selected.variant.onHand - selected.variant.reserved,
                    )}{" "}
                units
              </strong>
            </div>
          </div>
          <form onSubmit={(event) => void save(event)}>
            <label>
              Change in units
              <input
                required
                type="number"
                step="1"
                min="-1000000"
                max="1000000"
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                placeholder="+10 or -2"
              />
            </label>
            <label>
              Reason
              <input
                required
                minLength={5}
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="New stock received"
              />
            </label>
            <div className="seller-form-actions">
              <button
                type="button"
                className="outline-btn"
                onClick={() => setSelected(null)}
              >
                Cancel
              </button>
              <button type="submit" disabled={busy} className="primary-btn">
                {busy ? "Saving…" : "Save adjustment"}
              </button>
            </div>
          </form>
        </section>
      )}
      <p className="seller-footnote">
        Changes are recorded by the backend. You can inspect adjustment history
        on the product page.
      </p>
    </>
  );
}
