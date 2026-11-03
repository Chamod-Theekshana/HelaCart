"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { PageQueryBridge } from "@/components/page-query-bridge";
import { ReturnResolutionDialog } from "@/components/return-resolution-dialog";
import { RefundCard } from "@/components/returns-workspace";
import { RotateCcw, Search } from "lucide-react";
import { money } from "@/lib/api";
import { useAdmin, useAdminList } from "@/components/admin-provider";
import {
  AdminBadge,
  AdminDecision,
  AdminEmpty,
  AdminFeedback,
  AdminHeading,
} from "@/components/admin-ui";
import {
  dateTime,
  previewAdminReturns,
  shortId,
  type AdminReturn,
} from "@/lib/admin";

type ReturnStatus = AdminReturn["status"] | "ALL";
export default function AdminReturnsPage() {
  const { request, isPreview } = useAdmin();
  const [status, setStatus] = useState<ReturnStatus>("PENDING");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [action, setAction] = useState<"approve" | "reject" | "resolve" | null>(
    null,
  );
  const [notice, setNotice] = useState("");
  const [target, setTarget] = useState<AdminReturn | null>(null);
  const applyQuery = useCallback((params: URLSearchParams) => {
    const id = params.get("return");
    if (id) {
      setQuery(id);
      setSelectedId(id);
      setStatus("ALL");
    }
  }, []);
  const resource = useAdminList<AdminReturn>(
    "returns",
    { q: query, status },
    status === "PENDING" || status === "ALL" ? previewAdminReturns : [],
  );
  const shown = resource.data ?? [];
  const selected =
    shown.find((row) => row.id === selectedId) ?? shown[0] ?? null;
  async function commit(note: string) {
    if (!target || !action) return;
    await request(
      `/admin/returns/${target.id}/${action}`,
      "PATCH",
      action === "resolve"
        ? { note }
        : action === "reject"
          ? { reason: note }
          : {},
    );
    resource.reload();
    setSelectedId("");
    setNotice(
      `Return request ${action === "resolve" ? "resolved" : action === "reject" ? "rejected" : "approved"}.`,
    );
  }
  return (
    <>
      <PageQueryBridge onChange={applyQuery} />
      <AdminHeading
        eyebrow="FULFILMENT / CUSTOMER CASES"
        title="Returns"
        description="Review buyer return requests and record each decision. This workflow does not issue a bank refund."
      />
      <AdminFeedback error={resource.error} notice={notice} />
      <div className="admin-card admin-return-toolbar">
        <div className="admin-tabs" role="group" aria-label="Return status">
          {(
            ["PENDING", "APPROVED", "REJECTED", "RESOLVED", "ALL"] as const
          ).map((value) => (
            <button
              key={value}
              className={value === status ? "active" : ""}
              onClick={() => {
                setStatus(value);
                setSelectedId("");
              }}
            >
              {value.toLowerCase()}
            </button>
          ))}
        </div>
        <div className="admin-toolbar">
          <label className="admin-search">
            <Search size={16} />
            <input
              aria-label="Search returns"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search return, order or buyer ID"
            />
          </label>
          <span>
            {resource.page?.total ?? "—"} matching · all matching records
          </span>
        </div>
      </div>
      <div className="admin-split">
        <section className="admin-card">
          <div className="admin-card-head">
            <div>
              <h2>Return requests</h2>
              <p>Select a case to inspect</p>
            </div>
            <RotateCcw size={19} />
          </div>
          {resource.loading ? (
            <AdminEmpty message="Loading returns…" />
          ) : shown.length ? (
            <div className="admin-record-list">
              {shown.map((row) => (
                <button
                  className={selected?.id === row.id ? "selected" : ""}
                  onClick={() => setSelectedId(row.id)}
                  key={row.id}
                >
                  <span>
                    <strong>{shortId(row.id)}</strong>
                    <small>Order {shortId(row.sellerOrder.orderId)}</small>
                    <small>{dateTime(row.createdAt)}</small>
                  </span>
                  <span className="admin-record-end">
                    <AdminBadge value={row.status} />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <AdminEmpty
              message={
                resource.error
                  ? "Could not load returns."
                  : `No ${status.toLowerCase()} returns in this queue.`
              }
            />
          )}
        </section>
        <aside className="admin-card admin-order-detail">
          {selected ? (
            <>
              <div className="admin-card-head">
                <div>
                  <span className="admin-eyebrow">
                    RETURN CASE {shortId(selected.id)}
                  </span>
                  <h2>Buyer return request</h2>
                  <p>{dateTime(selected.createdAt)}</p>
                </div>
                <AdminBadge value={selected.status} />
              </div>
              <div className="admin-detail-section">
                <h3>Case details</h3>
                <dl className="admin-detail-list">
                  <dt>Order</dt>
                  <dd>{shortId(selected.sellerOrder.orderId)}</dd>
                  <dt>Seller order</dt>
                  <dd>{shortId(selected.sellerOrder.id)}</dd>
                  <dt>Seller ID</dt>
                  <dd>{selected.sellerOrder.sellerId}</dd>
                  <dt>Buyer ID</dt>
                  <dd>{selected.buyerId}</dd>
                </dl>
              </div>
              <div className="admin-detail-section">
                <h3>Buyer reason</h3>
                <p className="admin-description">{selected.reason}</p>
              </div>
              <div className="admin-detail-section">
                <h3>Requested items</h3>
                {(selected.items?.length
                  ? selected.items.map((item) => ({
                      id: item.id,
                      productTitle: item.orderItem.productTitle,
                      sku: item.orderItem.sku,
                      quantity: item.quantity,
                      lineLkrMinor: item.baseMinor,
                    }))
                  : selected.sellerOrder.items
                ).map((item) => (
                  <div className="admin-line" key={item.id}>
                    <span>
                      <strong>{item.productTitle}</strong>
                      <small>
                        {item.sku} · Qty {item.quantity}
                      </small>
                    </span>
                    <b>{money(item.lineLkrMinor)}</b>
                  </div>
                ))}
                {selected.items
                  ?.flatMap((i) => i.refunds)
                  .map((record) => (
                    <RefundCard key={record.id} record={record} />
                  ))}
                <Link className="text-link" href="/admin/refunds">
                  Review buyer refund records
                </Link>
              </div>
              {(selected.reviewReason || selected.resolutionNote) && (
                <div className="admin-detail-section">
                  <h3>Decision notes</h3>
                  {selected.reviewReason && (
                    <p>
                      {selected.reviewReason} · {dateTime(selected.reviewedAt)}
                    </p>
                  )}
                  {selected.resolutionNote && (
                    <p>
                      {selected.resolutionNote} ·{" "}
                      {dateTime(selected.resolvedAt)}
                    </p>
                  )}
                </div>
              )}
              {selected.status === "PENDING" && (
                <div className="admin-panel-actions">
                  <button
                    className="admin-danger-outline"
                    disabled={isPreview}
                    onClick={() => {
                      setTarget(selected);
                      setAction("reject");
                    }}
                  >
                    Reject return
                  </button>
                  <button
                    className="primary-btn"
                    disabled={isPreview}
                    onClick={() => {
                      setTarget(selected);
                      setAction("approve");
                    }}
                  >
                    Approve request
                  </button>
                </div>
              )}
              {selected.status === "APPROVED" && (
                <div className="admin-panel-actions">
                  <button
                    className="primary-btn"
                    disabled={isPreview}
                    onClick={() => {
                      setTarget(selected);
                      setAction("resolve");
                    }}
                  >
                    Record resolution
                  </button>
                </div>
              )}
            </>
          ) : (
            <AdminEmpty
              message={
                resource.loading
                  ? "Loading case…"
                  : "Select a return request to inspect it."
              }
            />
          )}
        </aside>
      </div>
      {action && action !== "resolve" && target && (
        <AdminDecision
          title={
            action === "reject"
              ? "Reject return request?"
              : "Approve return request?"
          }
          description={
            action === "approve"
              ? "Approve the selected item quantities for operational follow-up."
              : "Give the buyer a clear reason for the decision."
          }
          label={action === "reject" ? "Reject return" : "Approve return"}
          dangerous={action === "reject"}
          noteLabel={action === "reject" ? "Rejection reason" : undefined}
          minLength={10}
          maxLength={1000}
          onClose={() => setAction(null)}
          onConfirm={commit}
        />
      )}
      {action === "resolve" && target && (
        <ReturnResolutionDialog
          id={target.id}
          request={request}
          onClose={() => setAction(null)}
          onSaved={() => {
            resource.reload();
            setNotice(
              "Return outcome recorded with the refund verification status.",
            );
          }}
        />
      )}
      {resource.pagination}
    </>
  );
}
