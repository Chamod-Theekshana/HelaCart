"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useAdmin, useAdminCursorList } from "@/components/admin-provider";
import { useDebounced } from "@/components/list-controls";
import {
  AdminBadge,
  AdminDecision,
  AdminEmpty,
  AdminFeedback,
  AdminHeading,
} from "@/components/admin-ui";
import {
  dateTime,
  previewAdminSellers,
  type AdminSellerRow,
  type AdminSellerStatus,
} from "@/lib/admin";
import { queryString } from "@/lib/workspace";

const statuses: AdminSellerStatus[] = [
  "APPROVED",
  "SUSPENDED",
  "PENDING",
  "REJECTED",
];

/** Seller directory with suspend / reinstate (GET /admin/sellers, §5). */
export default function AdminSellersPage() {
  const { isPreview, request } = useAdmin();
  const [status, setStatus] = useState<AdminSellerStatus>("APPROVED");
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<AdminSellerRow | null>(null);
  const [notice, setNotice] = useState("");
  const q = useDebounced(query);
  const list = useAdminCursorList<AdminSellerRow>(
    `/admin/sellers?${queryString({ status, q, limit: 20 })}`,
    previewAdminSellers.filter(
      (row) =>
        row.status === status &&
        (!q || row.name.toLowerCase().includes(q.toLowerCase())),
    ),
  );
  const suspending = target?.status === "APPROVED";
  return (
    <>
      <AdminHeading
        eyebrow="MODERATION & GOVERNANCE"
        title="Sellers"
        description="Review approved shops and suspend or reinstate them. Suspension hides a shop's products, blocks new orders and seller writes, and keeps existing orders fulfilable."
        action={
          <Link className="outline-btn" href="/admin/seller-applications">
            Seller applications
          </Link>
        }
      />
      <AdminFeedback error={list.error} notice={notice} />
      <div className="admin-card">
        <div className="admin-tabs" role="group" aria-label="Seller status">
          {statuses.map((value) => (
            <button
              key={value}
              className={status === value ? "active" : ""}
              onClick={() => setStatus(value)}
            >
              {value.toLowerCase()}
            </button>
          ))}
        </div>
        <div className="admin-toolbar">
          <label className="admin-search">
            <Search size={16} />
            <input
              aria-label="Search sellers"
              value={query}
              maxLength={80}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search shop name or slug"
            />
          </label>
          <span>{list.items.length} shown</span>
        </div>
        {list.loading ? (
          <AdminEmpty message="Loading sellers…" />
        ) : list.items.length ? (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Shop</th>
                  <th>Status</th>
                  <th>Products</th>
                  <th>Open orders</th>
                  <th>Joined</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.name}</strong>
                      <small>
                        {" "}
                        /{row.slug}
                        {row.isVerified ? " · verified" : ""}
                      </small>
                    </td>
                    <td>
                      <AdminBadge value={row.status} />
                      {row.statusReason && (
                        <small className="admin-muted">
                          {" "}
                          {row.statusReason}
                        </small>
                      )}
                    </td>
                    <td>{row.productCount}</td>
                    <td>{row.openOrderCount}</td>
                    <td>{dateTime(row.createdAt)}</td>
                    <td>
                      {row.status === "APPROVED" && (
                        <button
                          className="admin-danger-outline"
                          disabled={isPreview}
                          onClick={() => setTarget(row)}
                        >
                          Suspend
                        </button>
                      )}
                      {row.status === "SUSPENDED" && (
                        <button
                          className="primary-btn"
                          disabled={isPreview}
                          onClick={() => setTarget(row)}
                        >
                          Reinstate
                        </button>
                      )}
                      {row.status !== "APPROVED" &&
                        row.status !== "SUSPENDED" && (
                          <Link
                            className="admin-link-button"
                            href="/admin/seller-applications"
                          >
                            Review application
                          </Link>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <AdminEmpty
            message={
              list.error
                ? "Could not load sellers."
                : `No ${status.toLowerCase()} sellers match this search.`
            }
          />
        )}
        {list.hasMore && (
          <div className="admin-row-actions">
            <button
              className="outline-btn"
              disabled={list.loadingMore}
              onClick={() => void list.loadMore()}
            >
              {list.loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </div>
      {target && (
        <AdminDecision
          title={
            suspending ? `Suspend ${target.name}?` : `Reinstate ${target.name}?`
          }
          description={
            suspending
              ? `Products disappear from the catalog, carts with this shop cannot check out and seller writes are blocked. ${target.openOrderCount} open order(s) can still be fulfilled. Members are notified with your reason.`
              : "Products become visible again (if approved) and the shop can accept orders. Members are notified with your reason."
          }
          label={suspending ? "Suspend seller" : "Reinstate seller"}
          noteLabel="Reason (shared with the shop's members)"
          minLength={5}
          maxLength={500}
          dangerous={suspending}
          onClose={() => setTarget(null)}
          onConfirm={async (reason) => {
            const updated = await request<AdminSellerRow>(
              `/admin/sellers/${encodeURIComponent(target.id)}/status`,
              "PATCH",
              { status: suspending ? "SUSPENDED" : "APPROVED", reason },
            );
            // The row moves to the other status tab.
            if (updated?.id) list.replace(updated);
            list.reload();
            setNotice(
              `${target.name} ${suspending ? "suspended" : "reinstated"}. The change is recorded in the audit log.`,
            );
          }}
        />
      )}
    </>
  );
}
