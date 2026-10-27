"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { errorMessage } from "@/lib/api";
import type { Page } from "@/lib/shops";
import type { StockAlert, ToolRequest } from "@/lib/business-tools";
import { useFeedbackResource } from "./product-reviews";
import { useDebounced } from "./list-controls";
import { ToolPagination } from "./bulk-tools-workspace";
import s from "./business-tools.module.css";
export function StockAlertsWorkspace({
  root,
  request,
  isPreview,
  canEdit = true,
}: {
  root: string;
  request: ToolRequest;
  isPreview: boolean;
  canEdit?: boolean;
}) {
  const [q, setQ] = useState("");
  const search = useDebounced(q);
  const [level, setLevel] = useState("ALL");
  const filter = `${search}:${level}`;
  const [paging, setPaging] = useState({ filter: "", page: 1 });
  const page = paging.filter === filter ? paging.page : 1;
  const [selected, setSelected] = useState<StockAlert | null>(null);
  const [notice, setNotice] = useState("");
  const list = useFeedbackResource<Page<StockAlert>>(
    `${root}?level=${level}&page=${page}${search.trim().length >= 2 ? `&q=${encodeURIComponent(search.trim())}` : ""}`,
    request,
    !isPreview,
  );
  return (
    <>
      <div className={s.intro}>
        <span className="section-kicker">STAY READY FOR THE NEXT ORDER</span>
        <h1>Stock alerts</h1>
        <p>
          Set the available-stock level that needs your attention. Available
          units are physical stock minus reservations. Published products notify
          your shop in the notification bell when stock becomes low or runs out.
        </p>
      </div>
      <p className={s.notice}>
        Checks run about once a minute while the API is running. Restocking
        clears an alert; the same level is not sent repeatedly. Draft and hidden
        products stay visible here without generating stock notifications.
      </p>
      {isPreview && (
        <p className={s.notice}>
          Connect the API to see real stock and configure alerts.
        </p>
      )}
      {notice && (
        <p className={s.notice} role="status">
          {notice}
        </p>
      )}
      <section className={s.panel}>
        <div className={s.toolbar}>
          <label>
            Search stock
            <input
              maxLength={100}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Product or SKU"
            />
          </label>
          <label>
            Stock filter
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="ALL">All variants</option>
              <option value="LOW">Low available stock</option>
              <option value="OUT">Out of stock</option>
              <option value="DISABLED">Alerts disabled</option>
            </select>
          </label>
          <button
            className="outline-btn"
            disabled={isPreview}
            onClick={list.reload}
          >
            Refresh
          </button>
        </div>
        {list.loading && <p role="status">Checking stock levels…</p>}
        {list.error && (
          <p className={s.error} role="alert">
            {list.error}{" "}
            <button className="outline-btn" onClick={list.reload}>
              Retry
            </button>
          </p>
        )}
        {list.data && (
          <>
            <div
              className={s.tableWrap}
              tabIndex={0}
              role="region"
              aria-label="Stock alert variants"
            >
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Product / SKU</th>
                    <th>Available</th>
                    <th>Threshold</th>
                    <th>Alert</th>
                    <th>Manage</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Link href={`/seller/products/${row.productId}`}>
                          <strong>{row.title}</strong>
                        </Link>
                        <small>
                          {row.sku} · {row.status}
                        </small>
                      </td>
                      <td>
                        <strong>{row.available}</strong>
                        <small>
                          {row.onHand} on hand · {row.reserved} reserved
                        </small>
                      </td>
                      <td>{row.threshold} or fewer</td>
                      <td>
                        <span
                          className={`${s.badge} ${row.enabled && row.available <= row.threshold ? s.warning : ""}`}
                        >
                          {!row.enabled
                            ? "Disabled"
                            : row.available === 0
                              ? "Out of stock"
                              : row.available <= row.threshold
                                ? "Low stock"
                                : "In stock"}
                        </span>
                      </td>
                      <td>
                        <button
                          className="outline-btn"
                          disabled={!canEdit}
                          onClick={() => setSelected(row)}
                        >
                          Alert settings
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!list.data.items.length && (
              <p className={s.muted}>No variants match these filters.</p>
            )}
            <ToolPagination
              page={page}
              pages={list.data.pages}
              onPage={(p) => setPaging({ filter, page: p })}
            />
          </>
        )}
      </section>
      {selected && (
        <StockSettingsDialog
          key={`${selected.id}:${selected.version}`}
          row={selected}
          root={root}
          request={request}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setNotice("Stock alert settings saved.");
            list.reload();
          }}
        />
      )}
    </>
  );
}
function StockSettingsDialog({
  row,
  root,
  request,
  onClose,
  onSaved,
}: {
  row: StockAlert;
  root: string;
  request: ToolRequest;
  onClose: () => void;
  onSaved: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [threshold, setThreshold] = useState(String(row.threshold));
  const [enabled, setEnabled] = useState(row.enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={s.dialog}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      aria-labelledby="stock-settings-title"
    >
      <h2 id="stock-settings-title">Stock alert settings</h2>
      <p className={s.text}>
        {row.title} · {row.sku}
      </p>
      <form
        className={s.form}
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            const quantity = Number(threshold);
            if (
              !Number.isInteger(quantity) ||
              quantity < 0 ||
              quantity > 1000000
            )
              throw Error("Use a whole threshold from 0 to 1000000");
            await request(`${root}/${row.id}/settings`, "PATCH", {
              version: row.version,
              threshold: quantity,
              enabled,
            });
            onSaved();
            onClose();
          } catch (error) {
            setError(errorMessage(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Low-stock threshold
          <input
            required
            type="number"
            min={0}
            max={1000000}
            step={1}
            disabled={busy}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
          />
        </label>
        <label className={s.check}>
          <input
            type="checkbox"
            checked={enabled}
            disabled={busy}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Enable in-app alerts for this variant
        </label>
        <small className={s.muted}>
          A threshold of zero alerts only when no available units remain.
        </small>
        {error && (
          <p className={s.error} role="alert">
            {error}
          </p>
        )}
        <div className={s.actions}>
          <button
            type="button"
            className="outline-btn"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="primary-btn" disabled={busy}>
            {busy ? "Saving…" : "Save alert settings"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
