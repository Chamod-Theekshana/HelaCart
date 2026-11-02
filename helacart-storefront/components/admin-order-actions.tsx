"use client";
import { useState } from "react";
import { useAdmin } from "./admin-provider";
import { AdminDecision } from "./admin-ui";
import {
  adminOrderActions,
  shortId,
  type AdminOrderAction,
  type AdminSellerOrder,
} from "@/lib/admin";

const descriptions: Record<AdminOrderAction, string> = {
  CANCEL:
    "Cancels this seller order and restores its stock. The buyer and seller are notified with your reason.",
  MARK_DELIVERY_FAILED:
    "Records that the courier could not deliver. The seller can re-attempt delivery or mark the parcel returned.",
  MARK_RETURNED:
    "Closes the order as returned to the seller. Stock is restored and no commission is charged.",
  MARK_DELIVERED:
    "Marks the order delivered and COD collected. Commission accrues for the seller.",
};

/** Per-seller-order admin interventions (POST /admin/orders/:id/actions, §1.5). */
export function AdminOrderActions({
  sellerOrderId,
  status,
  onDone,
}: {
  sellerOrderId: string;
  status: string;
  onDone: (row: AdminSellerOrder | null) => void;
}) {
  const { isPreview, request } = useAdmin();
  const [action, setAction] = useState<
    (typeof adminOrderActions)[number] | null
  >(null);
  const available = adminOrderActions.filter((row) =>
    row.from.includes(status),
  );
  if (!available.length) return null;
  return (
    <>
      <div className="admin-row-actions" aria-label="Order actions">
        {available.map((row) => (
          <button
            key={row.action}
            type="button"
            className={row.danger ? "admin-danger-outline" : "outline-btn"}
            disabled={isPreview}
            onClick={() => setAction(row)}
          >
            {row.label}
          </button>
        ))}
      </div>
      {action && (
        <AdminDecision
          title={`${action.label}?`}
          description={`Seller order ${shortId(sellerOrderId)}. ${descriptions[action.action]} This is recorded in the audit log.`}
          label={action.label}
          noteLabel="Reason (shared with the buyer and seller)"
          minLength={5}
          maxLength={500}
          dangerous={Boolean(action.danger)}
          onClose={() => setAction(null)}
          onConfirm={async (reason) => {
            const updated = await request<AdminSellerOrder>(
              `/admin/orders/${encodeURIComponent(sellerOrderId)}/actions`,
              "POST",
              { action: action.action, reason },
            );
            onDone(updated ?? null);
          }}
        />
      )}
    </>
  );
}
