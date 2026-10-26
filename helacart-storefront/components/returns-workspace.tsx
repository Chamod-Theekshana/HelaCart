"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import {
  FinanceFeedback,
  FinancePager,
  useFinanceResource,
} from "./commission-workspace";
import { emptyPage, localToday, type FinanceRequest } from "@/lib/commission";
import {
  effectiveRefunds,
  type RefundRecord,
  type ReturnCase,
} from "@/lib/after-sales";
import { errorMessage, money } from "@/lib/api";
import { dateTime } from "@/lib/admin";
import { rupeesToMinor } from "@/lib/seller";
import type { Page } from "@/lib/shops";
import styles from "./after-sales.module.css";
export function ReturnsWorkspace({
  root,
  role,
  request,
  isPreview,
  revision: externalRevision = 0,
}: {
  root: string;
  role: "BUYER" | "SELLER";
  request: FinanceRequest;
  isPreview: boolean;
  revision?: number;
}) {
  const [status, setStatus] = useState("ALL"),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [target, setTarget] = useState<{
      row: ReturnCase;
      item: ReturnCase["items"][number];
    } | null>(null),
    [notice, setNotice] = useState("");
  const list = useFinanceResource<Page<ReturnCase>>(
    `${root}/returns?page=${page}&status=${status}`,
    emptyPage(),
    request,
    isPreview,
    revision + externalRevision,
  );
  return (
    <div className={styles.workspace}>
      <div className={styles.toolbar}>
        <select
          aria-label="Filter item return status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="ALL">All return requests</option>
          {["PENDING", "APPROVED", "REJECTED", "RESOLVED"].map((s) => (
            <option value={s} key={s}>
              {s.toLowerCase()}
            </option>
          ))}
        </select>
        <button
          className="outline-btn"
          onClick={() => setRevision((v) => v + 1)}
        >
          Refresh returns
        </button>
        {role === "BUYER" && (
          <Link className="outline-btn" href="/orders">
            Return items from an order
          </Link>
        )}
      </div>
      <FinanceFeedback error={list.error} notice={notice} />
      {list.loading ? (
        <section className={styles.card}>Loading item returns…</section>
      ) : list.data?.items.length ? (
        list.data.items.map((row) => (
          <article className={styles.card} key={row.id}>
            <div className={styles.heading}>
              <div>
                <small>RETURN #{row.id.slice(0, 8).toUpperCase()}</small>
                <h2>{row.sellerOrder.seller.name}</h2>
                <small>
                  Order #{row.sellerOrder.orderId.slice(0, 8).toUpperCase()} ·{" "}
                  {dateTime(row.createdAt)}
                </small>
              </div>
              <span className={styles.badge}>{row.status.toLowerCase()}</span>
            </div>
            <p>{row.reason}</p>
            {row.items.map((item) => {
              const used = effectiveRefunds(item.refunds).reduce(
                (sum, r) => sum + r.merchandiseMinor,
                0,
              );
              return (
                <section key={item.id}>
                  <div className={styles.item}>
                    <div>
                      <strong>{item.orderItem.productTitle}</strong>
                      <small>
                        {item.orderItem.sku} · Return quantity {item.quantity}
                      </small>
                      <small>
                        Returned merchandise value {money(item.baseMinor)}
                      </small>
                    </div>
                    {role === "SELLER" &&
                      ["APPROVED", "RESOLVED"].includes(row.status) && (
                        <button
                          className="outline-btn"
                          disabled={
                            isPreview ||
                            (used >= item.baseMinor &&
                              (row.remainingShippingMinor ??
                                row.sellerOrder.shippingLkrMinor) <= 0)
                          }
                          onClick={() => setTarget({ row, item })}
                        >
                          Record actual refund
                        </button>
                      )}
                  </div>
                  {item.refunds.map((record) => (
                    <RefundCard key={record.id} record={record} />
                  ))}
                </section>
              );
            })}
            {row.reviewedAt && (
              <p className={styles.muted}>
                {row.status === "REJECTED" ? "Rejected" : "Approved"}{" "}
                {dateTime(row.reviewedAt)}
                {row.reviewReason ? ` · ${row.reviewReason}` : ""}
              </p>
            )}
            {row.resolvedAt && (
              <p className={styles.notice}>
                <strong>
                  {row.outcome?.toLowerCase().replaceAll("_", " ") ||
                    "Resolved"}
                </strong>{" "}
                · {dateTime(row.resolvedAt)}
                <br />
                {row.resolutionNote}
              </p>
            )}
            <Link
              className="text-link"
              href={`${role === "SELLER" ? "/seller/support" : "/account/support"}?order=${row.sellerOrder.id}`}
            >
              Get help with this return
            </Link>
          </article>
        ))
      ) : !list.error ? (
        <section className={styles.card}>
          <h2>No matching return requests</h2>
          <p className={styles.muted}>
            Item returns and their refund records will appear here.
          </p>
        </section>
      ) : null}
      <FinancePager data={list.data} onPage={setPage} loading={list.loading} />
      {target && (
        <RefundRecordDialog
          root={root}
          data={target}
          request={request}
          onClose={() => setTarget(null)}
          onSaved={() => {
            setTarget(null);
            setRevision((v) => v + 1);
            setNotice("Refund record submitted for admin verification.");
          }}
        />
      )}
    </div>
  );
}
export function RefundCard({
  record,
  action,
}: {
  record: RefundRecord;
  action?: React.ReactNode;
}) {
  const label = record.reversal
    ? "Reversed record"
    : record.status === "APPROVED"
      ? "Verified refund"
      : record.status === "PENDING"
        ? "Awaiting verification"
        : "Refund record rejected";
  return (
    <article className={styles.refund}>
      <div className={styles.heading}>
        <strong>{money(record.amountMinor)}</strong>
        <span className={styles.badge}>{label}</span>
      </div>
      <p>
        {record.reference} · {record.method.toLowerCase().replaceAll("_", " ")}{" "}
        · {record.paidOn}
      </p>
      <p className={styles.muted}>
        Items {money(record.merchandiseMinor)} · Delivery{" "}
        {money(record.shippingMinor)}
      </p>
      {record.note && <p>{record.note}</p>}
      {record.reviewNote && (
        <p>
          <strong>Review:</strong> {record.reviewNote}
        </p>
      )}
      {record.reversal && (
        <p className={styles.notice}>
          <strong>Correction:</strong> {record.reversal.reason}
          <br />
          {record.reversal.reference} · {dateTime(record.reversal.createdAt)}
        </p>
      )}
      {action}
    </article>
  );
}
function RefundRecordDialog({
  root,
  data,
  request,
  onClose,
  onSaved,
}: {
  root: string;
  data: { row: ReturnCase; item: ReturnCase["items"][number] };
  request: FinanceRequest;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    operation = useRef(false),
    intent = useRef({ payload: "", key: "" }),
    remaining =
      data.item.baseMinor -
      effectiveRefunds(data.item.refunds).reduce(
        (s, r) => s + r.merchandiseMinor,
        0,
      );
  const [merch, setMerch] = useState((remaining / 100).toFixed(2)),
    [shipping, setShipping] = useState("0.00"),
    [method, setMethod] = useState("BANK_TRANSFER"),
    [reference, setReference] = useState(""),
    [paidOn, setPaidOn] = useState(localToday),
    [note, setNote] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (operation.current || !confirmed) return;
    const merchandiseMinor = rupeesToMinor(merch),
      shippingMinor = rupeesToMinor(shipping);
    if (
      merchandiseMinor == null ||
      shippingMinor == null ||
      merchandiseMinor > remaining ||
      shippingMinor >
        (data.row.remainingShippingMinor ??
          data.row.sellerOrder.shippingLkrMinor) ||
      merchandiseMinor + shippingMinor < 1
    ) {
      setError(
        "Enter an actual refund within the remaining item and delivery amounts.",
      );
      return;
    }
    const body = {
        returnItemId: data.item.id,
        merchandiseMinor,
        shippingMinor,
        method,
        reference: reference.trim(),
        paidOn,
        note: note.trim(),
      },
      payload = JSON.stringify(body);
    if (intent.current.payload !== payload)
      intent.current = { payload, key: crypto.randomUUID() };
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      await request(`${root}/refunds`, "POST", {
        ...body,
        requestKey: intent.current.key,
      });
      onSaved();
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
        <div className={styles.heading}>
          <h2>Record an actual refund</h2>
          <button
            type="button"
            className="outline-btn"
            disabled={busy}
            onClick={onClose}
            aria-label="Close refund record"
          >
            <X size={18} />
          </button>
        </div>
        <p>
          <strong>{data.item.orderItem.productTitle}</strong> · Return quantity{" "}
          {data.item.quantity}
        </p>
        <p className={styles.muted}>
          Use this after returning money to the buyer. Remaining merchandise{" "}
          {money(remaining)}; delivery{" "}
          {money(
            data.row.remainingShippingMinor ??
              data.row.sellerOrder.shippingLkrMinor,
          )}
          . HelaCart verifies the record before marking it confirmed.
        </p>
        <fieldset disabled={busy}>
          <div className={styles.grid}>
            <label>
              Merchandise refunded (LKR)
              <input
                required
                inputMode="decimal"
                value={merch}
                onChange={(e) => setMerch(e.target.value)}
              />
            </label>
            <label>
              Delivery refunded (LKR)
              <input
                required
                inputMode="decimal"
                value={shipping}
                onChange={(e) => setShipping(e.target.value)}
              />
            </label>
            <label>
              Refund method
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="CASH">Cash</option>
              </select>
            </label>
            <label>
              Refund date
              <input
                type="date"
                required
                max={localToday()}
                value={paidOn}
                onChange={(e) => setPaidOn(e.target.value)}
              />
            </label>
          </div>
          <label>
            Transaction or receipt reference
            <input
              required
              minLength={3}
              maxLength={100}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
          <label>
            Note (optional)
            <textarea
              maxLength={500}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <label className={styles.check}>
            <input
              required
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />{" "}
            I have already refunded this amount to the buyer.
          </label>
          <button className="primary-btn" type="submit">
            {busy ? "Submitting…" : "Submit refund record for verification"}
          </button>
        </fieldset>
        <FinanceFeedback error={error} />
      </form>
    </dialog>
  );
}
