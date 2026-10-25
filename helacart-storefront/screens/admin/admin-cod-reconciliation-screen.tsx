"use client";
import Link from "next/link";
import { useState } from "react";
import { useAdminList } from "@/components/admin-provider";
import { AdminHeading, AdminFeedback } from "@/components/admin-ui";
import { FinanceCard, FinanceTable } from "@/components/commission-workspace";
import { dateTime, previewAdminCod, shortId, type AdminCod } from "@/lib/admin";
import { money } from "@/lib/api";
export default function AdminCodPage() {
  const [query, setQuery] = useState("");
  const resource = useAdminList<AdminCod>("cod", { q: query }, previewAdminCod);
  return (
    <>
      <AdminHeading
        eyebrow="FULFILMENT / COD"
        title="Seller COD records"
        description="Review delivered orders marked as collected by sellers. Verify seller payments to HelaCart in Commission & collections."
        action={
          <Link className="primary-btn" href="/admin/commission">
            Commission & collections
          </Link>
        }
      />
      <AdminFeedback error={resource.error} />
      <FinanceCard
        title="Seller-reported COD collections"
        description="This queue retains orders without a legacy COD reconciliation. The full buyer payment stays with the seller; commission payments are recorded separately."
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
                  </p>
                ))}
              </td>
            </tr>
          ))}
        </FinanceTable>
        {resource.pagination}
      </FinanceCard>
    </>
  );
}
