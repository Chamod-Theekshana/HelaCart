"use client";
import { PageQueryBridge } from "@/components/page-query-bridge";

import { useCallback, useState } from "react";
import { ShipmentTracking } from "@/components/shipment-tracking";
import { MapPin, Phone, Search, ShoppingBag } from "lucide-react";
import { previewAdminSummary, type AdminSummary } from "@/lib/workspace";
import { money } from "@/lib/api";
import { useAdminResource, useAdminList } from "@/components/admin-provider";
import {
  AdminBadge,
  AdminEmpty,
  AdminFeedback,
  AdminHeading,
} from "@/components/admin-ui";
import {
  dateTime,
  previewAdminOrders,
  shortId,
  type AdminOrder,
} from "@/lib/admin";

export default function AdminOrdersPage() {
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
        description="Monitor buyer orders and seller fulfilment. Status changes are made through Seller Center."
      />
      <AdminFeedback error={resource.error || summary.error} />
      <div className="admin-kpis compact">
        <div className="admin-kpi">
          <span className="admin-kpi-head">
            Total orders <ShoppingBag size={18} />
          </span>
          <strong>{summary.data?.orders ?? "—"}</strong>
          <small>Across the marketplace</small>
        </div>
        {["PLACED", "SHIPPED", "DELIVERED"].map((value) => (
          <div className="admin-kpi" key={value}>
            <span className="admin-kpi-head">{value.toLowerCase()}</span>
            <strong>
              {summary.data
                ? (summary.data.orderStatusCounts[value] ?? 0)
                : "—"}
            </strong>
            <small>Seller orders across all records</small>
          </div>
        ))}
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
          {[
            "ALL",
            "PLACED",
            "ACCEPTED",
            "PACKED",
            "SHIPPED",
            "DELIVERED",
            "CANCELLED",
          ].map((value) => (
            <option key={value} value={value}>
              {value === "ALL" ? "All statuses" : value}
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
              <p>Read-only operations view</p>
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
                    <AdminBadge value={row.sellerOrders[0]?.status ?? "—"} />
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
                  <MapPin size={16} /> {selected.recipient}, {selected.line1}
                  {selected.line2 ? `, ${selected.line2}` : ""}, {selected.city}
                  , {selected.district} {selected.postalCode}
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
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div className="admin-total">
                <span>Original order total</span>
                <strong>{money(selected.totalLkrMinor)}</strong>
              </div>
              {selected.sellerOrders.some(
                (part) => part.status === "CANCELLED",
              ) && (
                <div className="admin-total">
                  <span>Excluding cancelled deliveries</span>
                  <strong>
                    {money(
                      selected.sellerOrders
                        .filter((part) => part.status !== "CANCELLED")
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
  );
}
