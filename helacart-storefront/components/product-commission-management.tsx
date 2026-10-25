"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import {
  FinanceFeedback,
  FinancePager,
  FinanceTable,
  useFinanceResource,
} from "./commission-workspace";
import { emptyPage, rateLabel, type FinanceRequest } from "@/lib/commission";
import { errorMessage } from "@/lib/api";
import { dateTime } from "@/lib/admin";
import type { Page } from "@/lib/shops";
import styles from "./commission-workspace.module.css";

type ProductRate = {
  id: string;
  title: string;
  sku: string;
  status: string;
  commissionRateBps: number | null;
  commissionVersion: number;
  seller: { name: string };
};
type RateChange = {
  id: string;
  version: number;
  rateBps: number | null;
  beforeRateBps: number | null;
  reason: string;
  createdAt: string;
};
const rateText = (rate: number | null) =>
  rate == null ? "Not assigned · inactive" : rateLabel(rate);
const samples: ProductRate[] = [
  {
    id: "sample",
    title: "Handcrafted woven tote",
    sku: "TOTE-01",
    status: "APPROVED",
    commissionRateBps: 725,
    commissionVersion: 1,
    seller: { name: "HelaCraft Studio" },
  },
  {
    id: "sample-2",
    title: "Ceramic tea cup",
    sku: "CUP-02",
    status: "APPROVED",
    commissionRateBps: null,
    commissionVersion: 0,
    seller: { name: "HelaCraft Studio" },
  },
];

export function ProductCommissionManagement({
  request,
  isPreview,
  sellerId,
}: {
  request: FinanceRequest;
  isPreview: boolean;
  sellerId?: string;
}) {
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [selected, setSelected] = useState<ProductRate | null>(null),
    [notice, setNotice] = useState("");
  const data = useFinanceResource<Page<ProductRate>>(
    `${sellerId ? `/sellers/${sellerId}/commission` : "/admin/commission"}/products?q=${encodeURIComponent(q)}&page=${page}`,
    emptyPage(samples),
    request,
    isPreview,
    revision,
  );
  return (
    <div className={styles.workspace}>
      <p className={styles.muted}>
        {sellerId
          ? "Rates are assigned by HelaCart admin. Every new order item saves its rate and commission amount at checkout."
          : "Set each product’s rate separately. Leave unassigned products inactive; clearing a rate affects new orders only. Delivery fees are excluded."}
      </p>
      <div className={styles.toolbar}>
        <input
          aria-label="Search product commission rates"
          placeholder="Search product, SKU or shop"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <button
          className="outline-btn"
          onClick={() => setRevision((v) => v + 1)}
        >
          Refresh rates
        </button>
      </div>
      <FinanceFeedback error={data.error} notice={notice} />
      <FinanceTable
        headers={[
          "Product",
          "Shop",
          "Commission",
          ...(!sellerId ? ["Action"] : []),
        ]}
        empty={
          data.loading
            ? "Loading product rates…"
            : !data.data?.items.length
              ? "No matching products."
              : undefined
        }
      >
        {data.data?.items.map((row) => (
          <tr key={row.id}>
            <td>
              <strong>{row.title}</strong>
              <small>
                {row.sku} · {row.status.toLowerCase()}
              </small>
            </td>
            <td>{row.seller.name}</td>
            <td>
              <strong>{rateText(row.commissionRateBps)}</strong>
              <small>Version {row.commissionVersion}</small>
            </td>
            {!sellerId && (
              <td>
                <button
                  className="outline-btn"
                  onClick={() => setSelected(row)}
                >
                  {isPreview ? "View rate" : "Manage rate"}
                </button>
              </td>
            )}
          </tr>
        ))}
      </FinanceTable>
      <FinancePager data={data.data} onPage={setPage} loading={data.loading} />
      {selected && (
        <ProductRateDialog
          key={`${selected.id}:${selected.commissionVersion}`}
          product={selected}
          request={request}
          isPreview={isPreview}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setRevision((v) => v + 1);
            setNotice(
              "Product rate saved. Existing order items retain their original rate and amount.",
            );
          }}
        />
      )}
    </div>
  );
}
function ProductRateDialog({
  product,
  request,
  isPreview,
  onClose,
  onSaved,
}: {
  product: ProductRate;
  request: FinanceRequest;
  isPreview: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    operation = useRef(false);
  const [rate, setRate] = useState(
      product.commissionRateBps == null
        ? ""
        : (product.commissionRateBps / 100).toFixed(2),
    ),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const history = useFinanceResource<RateChange[]>(
    `/admin/commission/products/${product.id}/history`,
    [],
    request,
    isPreview,
  );
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (operation.current || isPreview) return;
    const value = rate.trim();
    if (
      value !== "" &&
      (!/^\d+(?:\.\d{1,2})?$/.test(value) || Number(value) > 100)
    ) {
      setError(
        "Use 0–100% with at most two decimals, or leave blank to deactivate.",
      );
      return;
    }
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      await request(`/admin/commission/products/${product.id}`, "PATCH", {
        version: product.commissionVersion,
        rateBps: value === "" ? null : Math.round(Number(value) * 100),
        reason: reason.trim(),
      });
      onSaved();
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
    >
      <form className={styles.form} onSubmit={(e) => void save(e)}>
        <div className={styles.cardHead}>
          <h2>Product commission</h2>
          <button
            className="outline-btn"
            type="button"
            aria-label="Close product commission"
            disabled={busy}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <p>
          <strong>{product.title}</strong>
          <br />
          {product.seller.name} · {product.sku}
        </p>
        <p className={styles.muted}>
          Current: {rateText(product.commissionRateBps)}. A blank rate
          deactivates commission for this product on future orders. Previously
          placed orders keep their terms.
        </p>
        <fieldset disabled={busy || isPreview}>
          <label>
            Commission rate (%)
            <input
              inputMode="decimal"
              placeholder="Unassigned"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </label>
          <label>
            Reason for this change
            <textarea
              required
              minLength={10}
              maxLength={500}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button className="primary-btn" type="submit">
            {busy ? "Saving…" : "Save product rate"}
          </button>
        </fieldset>
        <FinanceFeedback error={error || history.error} />
        <details>
          <summary>Rate history (latest 20)</summary>
          {history.loading ? (
            <p>Loading history…</p>
          ) : !history.data?.length ? (
            <p>No previous changes.</p>
          ) : (
            history.data.map((change) => (
              <p key={change.id}>
                <strong>
                  Version {change.version}: {rateText(change.beforeRateBps)} →{" "}
                  {rateText(change.rateBps)}
                </strong>
                <br />
                {change.reason}
                <br />
                <small>{dateTime(change.createdAt)}</small>
              </p>
            ))
          )}
        </details>
      </form>
    </dialog>
  );
}
