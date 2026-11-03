"use client";
import { PageQueryBridge } from "@/components/page-query-bridge";

import { useCallback, useState } from "react";
import { ShipmentTracking } from "@/components/shipment-tracking";
import { MapPin, Phone, Search, ShoppingBag } from "lucide-react";
import { previewAdminSummary, type AdminSummary } from "@/lib/workspace";
import { money } from "@/lib/api";
import {
  useAdminCursorList,
  useAdminResource,
  useAdminList,
} from "@/components/admin-provider";
import { AdminOrderActions } from "@/components/admin-order-actions";
import {
  AdminBadge,
  AdminEmpty,
  AdminFeedback,
  AdminHeading,
} from "@/components/admin-ui";
import {
  dateTime,
  previewAdminOrders,
  previewAttention,
  shortId,
  type AdminOrder,
  type AdminSellerOrder,
} from "@/lib/admin";

const statuses = [
  "ALL",
  "PLACED",
  "ACCEPTED",
  "PACKED",
  "SHIPPED",
  "DELIVERY_FAILED",
  "DELIVERED",
  "RETURNED_TO_SELLER",
  "CANCELLED",
];
const closed = ["CANCELLED", "RETURNED_TO_SELLER"];

export default function AdminOrdersPage() {
  const [view, setView] = useState<"all" | "attention">("all");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const resource = useAdminList<AdminOrder>(
    "orders",
    { q: query, status },
    previewAdminOrders,
  );
  const summary = useAdminResource<AdminSummary>(
    "/workspace/admin/summary",
    previewAdminSummary,
  );
  const [selectedId, setSelectedId] = useState("");
  const applyQuery = useCallback((params: URLSearchParams) => {
    const target = params.get("order");
    if (target) {
      setQuery(target);
      setSelectedId(target);
      setStatus("ALL");
    }
  }, []);
  const shown = resource.data ?? [];
  const selected =
    shown.find((row) => row.id === selectedId) ?? shown[0] ?? null;
  return (
    <>
      <PageQueryBridge onChange={applyQuery} />
      <AdminHeading
        eyebrow="FULFILMENT / COD"
        title="Orders"
        description="Monitor buyer orders and seller fulfilment. Sellers update statuses in Seller Center; administrators can intervene with a recorded reason."
      />
      <div className="admin-card">
        <div className="admin-tabs" role="tablist" aria-label="Order views">
          <button
            role="tab"
            aria-selected={view === "all"}
            className={view === "all" ? "active" : ""}
            onClick={() => setView("all")}
          >
            All orders
          </button>
          <button
            role="tab"
            aria-selected={view === "attention"}
            className={view === "attention" ? "active" : ""}
            onClick={() => setView("attention")}
          >
            Needs attention
          </button>
        </div>
      </div>
      <AdminFeedback error={resource.error || summary.error} notice={notice} />
      {view === "attention" ? (
        <AttentionQueue onNotice={setNotice} />
      ) : (
        <>
          <div className="admin-kpis compact">
            <div className="admin-kpi">
              <span className="admin-kpi-head">
                Total orders <ShoppingBag size={18} />
              </span>
              <strong>{summary.data?.orders ?? "—"}</strong>
              <small>Across the marketplace</small>
            </div>
            {["PLACED", "SHIPPED", "DELIVERY_FAILED", "DELIVERED"].map(
              (value) => (
                <div className="admin-kpi" key={value}>
                  <span className="admin-kpi-head">
                    {value.toLowerCase().replaceAll("_", " ")}
                  </span>
                  <strong>
                    {summary.data
                      ? (summary.data.orderStatusCounts[value] ?? 0)
                      : "—"}
                  </strong>
                  <small>Seller orders across all records</small>
                </div>
              ),
            )}
          </div>
          <div className="admin-card admin-toolbar">
            <label className="admin-search">
              <Search size={16} />
              <input
                aria-label="Search orders"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search order ID, buyer, district or seller"
              />
            </label>
            <select
              aria-label="Filter seller order status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {value === "ALL"
                    ? "All statuses"
                    : value.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <span>{resource.page?.total ?? "—"} matching</span>
          </div>
          <div className="admin-split">
            <section className="admin-card">
              <div className="admin-card-head">
                <div>
                  <h2>Latest orders</h2>
                  <p>Select an order to inspect or intervene</p>
                </div>
              </div>
              {resource.loading ? (
                <AdminEmpty message="Loading orders…" />
              ) : shown.length ? (
                <div className="admin-record-list">
                  {shown.map((row) => (
                    <button
                      key={row.id}
                      className={selected?.id === row.id ? "selected" : ""}
                      onClick={() => setSelectedId(row.id)}
                    >
                      <span>
                        <strong>{shortId(row.id)}</strong>
                        <small>
                          {row.recipient} · {row.district}
                        </small>
                        <small>{dateTime(row.createdAt)}</small>
                      </span>
                      <span className="admin-record-end">
                        <strong>{money(row.totalLkrMinor)}</strong>
                        <AdminBadge
                          value={row.sellerOrders[0]?.status ?? "—"}
                        />
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <AdminEmpty
                  message={
                    resource.error
                      ? "Could not load orders."
                      : "No orders match this filter."
                  }
                />
              )}
            </section>
            <aside className="admin-card admin-order-detail">
              {selected ? (
                <>
                  <div className="admin-card-head">
                    <div>
                      <span className="admin-eyebrow">ORDER DETAILS</span>
                      <h2>{shortId(selected.id)}</h2>
                      <p>
                        Placed {dateTime(selected.createdAt)} · Cash on delivery
                      </p>
                    </div>
                  </div>
                  <div className="admin-detail-section">
                    <h3>Delivery</h3>
                    <p>
                      <MapPin size={16} /> {selected.recipient},{" "}
                      {selected.line1}
                      {selected.line2 ? `, ${selected.line2}` : ""},{" "}
                      {selected.city}, {selected.district} {selected.postalCode}
                    </p>
                    <p>
                      <Phone size={16} /> {selected.phone}
                    </p>
                  </div>
                  {selected.sellerOrders.map((part) => (
                    <div className="admin-detail-section" key={part.id}>
                      <div className="admin-detail-section-title">
                        <h3>{part.seller.name}</h3>
                        <AdminBadge value={part.status} />
                      </div>
                      <small>Seller order {shortId(part.id)}</small>
                      {part.statusReason && (
                        <p className="status-reason">
                          Reason: {part.statusReason}
                          {part.statusChangedAt
                            ? ` · ${dateTime(part.statusChangedAt)}`
                            : ""}
                        </p>
                      )}
                      <ShipmentTracking order={part} />
                      {part.items.map((item) => (
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
                      <div className="admin-line">
                        <span>Delivery fee</span>
                        <b>{money(part.shippingLkrMinor)}</b>
                      </div>
                      {part.events.length > 0 && (
                        <div className="admin-history">
                          <strong>Fulfilment history</strong>
                          {part.events.map((event) => (
                            <p key={event.id}>
                              {event.fromStatus} → {event.toStatus} ·{" "}
                              {dateTime(event.createdAt)}
                              {event.actorUserId === null
                                ? " · by HelaCart"
                                : ""}
                              {event.reason ? ` · ${event.reason}` : ""}
                            </p>
                          ))}
                        </div>
                      )}
                      <AdminOrderActions
                        sellerOrderId={part.id}
                        status={part.status}
                        onDone={() => {
                          resource.reload();
                          summary.reload();
                          setNotice(
                            `Seller order ${shortId(part.id)} updated and recorded in the audit log.`,
                          );
                        }}
                      />
                    </div>
                  ))}
                  <div className="admin-total">
                    <span>Original order total</span>
                    <strong>{money(selected.totalLkrMinor)}</strong>
                  </div>
                  {selected.sellerOrders.some((part) =>
                    closed.includes(part.status),
                  ) && (
                    <div className="admin-total">
                      <span>Excluding cancelled or returned deliveries</span>
                      <strong>
                        {money(
                          selected.sellerOrders
                            .filter((part) => !closed.includes(part.status))
                            .reduce((sum, part) => sum + part.totalLkrMinor, 0),
                        )}
                      </strong>
                    </div>
                  )}
                </>
              ) : (
                <AdminEmpty
                  message={
                    resource.loading
                      ? "Loading details…"
                      : "Select an order to inspect it."
                  }
                />
              )}
            </aside>
          </div>
          {resource.pagination}
        </>
      )}
    </>
  );
}

/** Seller orders stuck in SHIPPED / DELIVERY_FAILED or close to auto-cancel (§1.5). */
function AttentionQueue({ onNotice }: { onNotice: (text: string) => void }) {
  const [days, setDays] = useState("7");
  const list = useAdminCursorList<AdminSellerOrder>(
    `/admin/orders/attention?days=${days}&limit=20`,
    previewAttention,
  );
  return (
    <section className="admin-card">
      <div className="admin-card-head">
        <div>
          <h2>Needs attention</h2>
          <p>
            Shipped or failed deliveries with no update for the selected period,
            and placed orders close to automatic cancellation.
          </p>
        </div>
        <label className="admin-search">
          No update for
          <select
            aria-label="Days without an update"
            value={days}
            onChange={(event) => setDays(event.target.value)}
          >
            {["1", "3", "7", "14", "30", "60"].map((value) => (
              <option key={value} value={value}>
                {value} {value === "1" ? "day" : "days"}
              </option>
            ))}
          </select>
        </label>
      </div>
      <AdminFeedback error={list.error} />
      {list.loading ? (
        <AdminEmpty message="Loading orders that need attention…" />
      ) : list.items.length ? (
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Seller order</th>
                <th>Shop</th>
                <th>Buyer</th>
                <th>COD total</th>
                <th>Status</th>
                <th>Last change</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((row) => (
                <tr key={row.id}>
                  <td>
                    {shortId(row.id)}
                    {row.orderId && (
                      <small> · order {shortId(row.orderId)}</small>
                    )}
                  </td>
                  <td>{row.seller?.name ?? "—"}</td>
                  <td>
                    {row.order?.recipient ?? "—"}
                    {row.order?.district ? (
                      <small> · {row.order.district}</small>
                    ) : null}
                  </td>
                  <td className="admin-money">
                    {row.totalLkrMinor == null ? "—" : money(row.totalLkrMinor)}
                  </td>
                  <td>
                    <AdminBadge value={row.status} />
                    {row.statusReason && <small> {row.statusReason}</small>}
                  </td>
                  <td>{dateTime(row.statusChangedAt ?? row.createdAt)}</td>
                  <td>
                    <AdminOrderActions
                      sellerOrderId={row.id}
                      status={row.status}
                      onDone={() => {
                        list.reload();
                        onNotice(
                          `Seller order ${shortId(row.id)} updated and recorded in the audit log.`,
                        );
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <AdminEmpty message="No seller orders need attention right now." />
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
    </section>
  );
}
