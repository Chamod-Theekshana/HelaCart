"use client";
import Link from "next/link";
import { useState } from "react";
import { useAdmin, useAdminList } from "@/components/admin-provider";
import {
  AdminDecision,
  AdminHeading,
  AdminFeedback,
} from "@/components/admin-ui";
import { FinanceCard, FinanceTable } from "@/components/commission-workspace";
import { dateTime, previewAdminCod, shortId, type AdminCod } from "@/lib/admin";
import { money } from "@/lib/api";
import { rupeesToMinor } from "@/lib/seller";

export default function AdminCodPage() {
  const { isPreview, request } = useAdmin();
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [target, setTarget] = useState<AdminCod | null>(null);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const resource = useAdminList<AdminCod>("cod", { q: query }, previewAdminCod);
  function open(row: AdminCod) {
    setAmount((row.totalLkrMinor / 100).toFixed(2));
    setReference("");
    setTarget(row);
  }
  /** POST /admin/cod/:sellerOrderId/reconciliations (ReconcileCodDto). */
  async function reconcile(row: AdminCod, note: string) {
    const amountReceivedMinor = rupeesToMinor(amount);
    if (amountReceivedMinor === null || amountReceivedMinor > 1_000_000_000)
      throw new Error(
        "Enter the amount received in rupees, for example 4550.00.",
      );
    const ref = reference.trim();
    if (ref.length < 4 || ref.length > 120)
      throw new Error(
        "Enter a reference of 4 to 120 characters (bank slip or courier remittance ID).",
      );
    const disputed = amountReceivedMinor !== row.totalLkrMinor;
    if ((disputed || note) && (note.length < 10 || note.length > 1000))
      throw new Error(
        disputed
          ? "The amount differs from the COD total, so this is recorded as disputed. Explain the difference in at least 10 characters."
          : "Notes must be 10 to 1000 characters, or leave the note empty.",
      );
    await request(
      `/admin/cod/${encodeURIComponent(row.id)}/reconciliations`,
      "POST",
      { amountReceivedMinor, reference: ref, ...(note ? { note } : {}) },
    );
    resource.reload();
    setNotice(
      `${shortId(row.id)} recorded as ${disputed ? "disputed" : "reconciled"}.`,
    );
  }
  return (
    <>
      <AdminHeading
        eyebrow="FULFILMENT / COD"
        title="Seller COD records"
        description="Review delivered orders marked as collected by sellers and record the COD money HelaCart received. Verify seller commission payments in Commission & collections."
        action={
          <Link className="primary-btn" href="/admin/commission">
            Commission & collections
          </Link>
        }
      />
      <AdminFeedback error={resource.error} notice={notice} />
      <FinanceCard
        title="Seller-reported COD collections"
        description="Orders without a reconciled record. An amount equal to the buyer's COD total is recorded as reconciled; any other amount is recorded as disputed and needs a note."
      >
        <label className="admin-search">
          Search seller order or seller ID
          <input
            aria-label="Search COD records"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Order or seller reference"
          />
        </label>
        <FinanceTable
          headers={[
            "Seller order",
            "Shop",
            "Buyer COD amount",
            "Collection reported",
            "Previous records",
            "Action",
          ]}
          empty={
            resource.loading
              ? "Loading COD records…"
              : !resource.data?.length
                ? "No matching records in this queue."
                : undefined
          }
        >
          {resource.data?.map((row) => (
            <tr key={row.id}>
              <td>{shortId(row.id)}</td>
              <td>{shortId(row.sellerId)}</td>
              <td>{money(row.totalLkrMinor)}</td>
              <td>{dateTime(row.paymentCollectedAt)}</td>
              <td>
                {row.codReconciliations?.map((record) => (
                  <p key={record.id}>
                    {record.decision.toLowerCase()} · {record.reference} ·{" "}
                    {money(record.amountReceivedMinor)}
                    {record.note ? ` · ${record.note}` : ""}
                  </p>
                ))}
              </td>
              <td>
                <button
                  className="outline-btn"
                  disabled={isPreview}
                  onClick={() => open(row)}
                >
                  Record reconciliation
                </button>
              </td>
            </tr>
          ))}
        </FinanceTable>
        {resource.pagination}
      </FinanceCard>
      {target && (
        <AdminDecision
          title={`Reconcile ${shortId(target.id)}`}
          description={`Buyer COD total ${money(target.totalLkrMinor)}, reported collected ${dateTime(target.paymentCollectedAt)}. Record what HelaCart actually received.`}
          label="Save reconciliation"
          noteLabel="Note (required when the amount differs)"
          minLength={0}
          maxLength={1000}
          onClose={() => setTarget(null)}
          onConfirm={(note) => reconcile(target, note)}
        >
          <label>
            Amount received (LKR)
            <input
              inputMode="decimal"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <label>
            Reference
            <input
              required
              minLength={4}
              maxLength={120}
              value={reference}
              placeholder="Bank slip or courier remittance ID"
              onChange={(event) => setReference(event.target.value)}
            />
          </label>
        </AdminDecision>
      )}
    </>
  );
}
