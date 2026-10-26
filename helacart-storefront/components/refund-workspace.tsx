"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import {
  FinanceFeedback,
  FinancePager,
  useFinanceResource,
} from "./commission-workspace";
import { RefundCard } from "./returns-workspace";
import type { RefundRecord } from "@/lib/after-sales";
import { emptyPage, type FinanceRequest } from "@/lib/commission";
import type { Page } from "@/lib/shops";
import { errorMessage, money } from "@/lib/api";
import styles from "./after-sales.module.css";
export function RefundWorkspace({
  request,
  isPreview,
}: {
  request: FinanceRequest;
  isPreview: boolean;
}) {
  const [status, setStatus] = useState("PENDING"),
    [page, setPage] = useState(1),
    [q, setQ] = useState(""),
    [revision, setRevision] = useState(0),
    [target, setTarget] = useState<{
      record: RefundRecord;
      reverse: boolean;
    } | null>(null),
    [notice, setNotice] = useState("");
  const list = useFinanceResource<Page<RefundRecord>>(
    `/admin/after-sales/refunds?page=${page}&status=${status}&q=${encodeURIComponent(q)}`,
    emptyPage(),
    request,
    isPreview,
    revision,
  );
  return (
    <div className={styles.workspace}>
      <div className={styles.toolbar}>
        <input
          aria-label="Search refund references"
          placeholder="Search refund reference"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="Filter refund records"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          {["PENDING", "APPROVED", "REJECTED", "ALL"].map((s) => (
            <option value={s} key={s}>
              {s === "ALL" ? "All records" : s.toLowerCase()}
            </option>
          ))}
        </select>
        <button
          className="outline-btn"
          onClick={() => setRevision((v) => v + 1)}
        >
          Refresh refund records
        </button>
      </div>
      <FinanceFeedback error={list.error} notice={notice} />
      {list.loading ? (
        <section className={styles.card}>Loading refund records…</section>
      ) : list.data?.items.length ? (
        list.data.items.map((record) => (
          <section className={styles.card} key={record.id}>
            <div className={styles.heading}>
              <div>
                <h2>{record.returnItem.orderItem.productTitle}</h2>
                <small>
                  {record.returnItem.returnRequest.sellerOrder.seller.name} ·
                  Order #
                  {record.returnItem.returnRequest.sellerOrder.orderId
                    .slice(0, 8)
                    .toUpperCase()}
                </small>
              </div>
            </div>
            <RefundCard
              record={record}
              action={
                record.status === "PENDING" ? (
                  <button
                    className="primary-btn"
                    disabled={isPreview}
                    onClick={() => setTarget({ record, reverse: false })}
                  >
                    Review refund evidence
                  </button>
                ) : record.status === "APPROVED" && !record.reversal ? (
                  <button
                    className="outline-btn"
                    disabled={isPreview}
                    onClick={() => setTarget({ record, reverse: true })}
                  >
                    Correct verified record
                  </button>
                ) : null
              }
            />
          </section>
        ))
      ) : !list.error ? (
        <section className={styles.card}>
          <h2>No matching refund records</h2>
          <p className={styles.muted}>
            Seller-submitted buyer refunds appear here for verification.
          </p>
        </section>
      ) : null}
      <FinancePager data={list.data} onPage={setPage} loading={list.loading} />
      {target && (
        <RefundDecision
          key={`${target.record.id}:${target.reverse}`}
          target={target}
          request={request}
          onClose={() => setTarget(null)}
          onSaved={() => {
            setTarget(null);
            setRevision((v) => v + 1);
            setNotice("Refund decision recorded with its history.");
          }}
        />
      )}
    </div>
  );
}
function RefundDecision({
  target,
  request,
  onClose,
  onSaved,
}: {
  target: { record: RefundRecord; reverse: boolean };
  request: FinanceRequest;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    operation = useRef(false),
    intent = useRef({ payload: "", key: "" });
  const [decision, setDecision] = useState("APPROVED"),
    [reason, setReason] = useState(""),
    [reference, setReference] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (operation.current || !confirmed) return;
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      const data = target.reverse
        ? { reference: reference.trim(), reason: reason.trim() }
        : { decision, reason: reason.trim() };
      let body: unknown = data;
      if (target.reverse) {
        const payload = JSON.stringify(data);
        if (intent.current.payload !== payload)
          intent.current = { payload, key: crypto.randomUUID() };
        body = { ...data, requestKey: intent.current.key };
      }
      await request(
        `/admin/after-sales/refunds/${target.record.id}${target.reverse ? "/reverse" : ""}`,
        target.reverse ? "POST" : "PATCH",
        body,
      );
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
          <h2>
            {target.reverse
              ? "Correct verified refund record"
              : "Review refund evidence"}
          </h2>
          <button
            type="button"
            className="outline-btn"
            disabled={busy}
            onClick={onClose}
            aria-label="Close refund decision"
          >
            <X size={18} />
          </button>
        </div>
        <p>
          <strong>{money(target.record.amountMinor)}</strong> ·{" "}
          {target.record.reference}
        </p>
        <p className={styles.muted}>
          {target.reverse
            ? "This reverses an incorrect record and its linked commission credit while retaining both histories."
            : "Check evidence that the buyer actually received this refund. Verification updates the record and any applicable original-rate commission credit."}
        </p>
        <fieldset disabled={busy}>
          {!target.reverse ? (
            <label>
              Decision
              <select
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
              >
                <option value="APPROVED">Verify refund</option>
                <option value="REJECTED">Reject record</option>
              </select>
            </label>
          ) : (
            <label>
              Correction reference
              <input
                required
                minLength={3}
                maxLength={100}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </label>
          )}
          <label>
            Review reason
            <textarea
              required
              minLength={10}
              maxLength={500}
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <label className={styles.check}>
            <input
              required
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            {target.reverse
              ? "I checked that this refund record was entered incorrectly."
              : decision === "APPROVED"
                ? "I verified evidence that this amount was refunded to the buyer."
                : "I reviewed the evidence and recorded the reason for rejection."}
          </label>
          <button className="primary-btn" type="submit">
            {busy
              ? "Recording…"
              : target.reverse
                ? "Record refund correction"
                : decision === "APPROVED"
                  ? "Confirm verified refund"
                  : "Reject refund record"}
          </button>
        </fieldset>
        <FinanceFeedback error={error} />
      </form>
    </dialog>
  );
}
