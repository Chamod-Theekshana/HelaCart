"use client";

import { useEffect, useState } from "react";
import { ClipboardList, MapPin, Phone, Search, Truck } from "lucide-react";
import { errorMessage, money } from "@/lib/api";
import type { OrderStatus, SellerOrderRecord } from "@/lib/seller";
import { useSeller } from "@/components/seller-provider";
import { SellerPageHeading, SellerStatusBadge } from "@/components/seller-ui";

const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  PLACED: "ACCEPTED", ACCEPTED: "PACKED", PACKED: "SHIPPED", SHIPPED: "DELIVERED",
};
const actionName: Partial<Record<OrderStatus, string>> = {
  ACCEPTED: "Accept order", PACKED: "Mark packed", SHIPPED: "Mark shipped", DELIVERED: "Confirm delivered",
};

export default function SellerOrders() {
  const { seller, orders, isPreview, request, refreshOrders, dataLoading } = useSeller();
  const [status, setStatus] = useState("ALL"); const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(""); const [paymentCollected, setPaymentCollected] = useState(false);
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState("");
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const target = new URLSearchParams(window.location.search).get("order");
      if (target) setSelectedId(target);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const shown = orders.filter((row) => (status === "ALL" || row.status === status) &&
    `${row.order.id} ${row.order.recipient}`.toLowerCase().includes(query.toLowerCase()));
  const selected = shown.find((row) => row.id === selectedId) ?? shown[0] ?? null;
  const orderSteps: OrderStatus[] = ["PLACED", "ACCEPTED", "PACKED", "SHIPPED", "DELIVERED"];

  async function update(row: SellerOrderRecord, newStatus: OrderStatus) {
    if (!seller || isPreview) return;
    if (newStatus === "DELIVERED" && !paymentCollected) { setNotice("Confirm COD payment collection before marking this order delivered."); return; }
    if (newStatus === "CANCELLED" && !window.confirm("Cancel this seller order? This action cannot be undone.")) return;
    setBusy(true); setNotice("");
    try {
      await request(`/sellers/${seller.id}/orders/${row.id}/status`, "PATCH", {
        status: newStatus, ...(newStatus === "DELIVERED" ? { paymentCollected: true } : {}),
      });
      await refreshOrders(); setPaymentCollected(false); setNotice(`Order status updated to ${newStatus.toLowerCase()}.`);
    } catch (cause) { setNotice(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <>
    <SellerPageHeading kicker="FULFILMENT & COD" title="Customer orders" description="Follow cash on delivery orders from placement to delivery." />
    <div className="seller-order-summary"><span>All orders <strong>{orders.length}</strong></span><span>Needs packing <strong>{orders.filter((row) => ["PLACED", "ACCEPTED"].includes(row.status)).length}</strong></span><span>In delivery <strong>{orders.filter((row) => row.status === "SHIPPED").length}</strong></span><span>Delivered <strong>{orders.filter((row) => row.status === "DELIVERED").length}</strong></span></div>
    {notice && <div className="message info" role="status">{notice}</div>}
    <div className="seller-card seller-toolbar seller-order-toolbar"><label className="seller-search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search order ID or buyer" aria-label="Search seller orders" /></label>
      <div className="seller-order-filters" role="group" aria-label="Order status">{["ALL", "PLACED", "ACCEPTED", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED"].map((value) => <button key={value} type="button" className={status === value ? "active" : ""} onClick={() => setStatus(value)}>{value === "ALL" ? "All" : value.toLowerCase()}</button>)}</div><span>{shown.length} shown{orders.length === 50 ? " · most recent 50 loaded" : ""}</span></div>
    <div className="seller-orders-layout"><section className="seller-card seller-order-list">{shown.length ? shown.map((row) => <button key={row.id} onClick={() => { setSelectedId(row.id); setPaymentCollected(false); setNotice(""); }} className={`seller-order-entry ${selected?.id === row.id ? "selected" : ""}`}>
      <span className="list-icon"><ClipboardList size={19} /></span><span className="list-body"><strong>Order #{row.order.id.slice(0, 8)}</strong><small>{row.order.recipient} · {row.order.district}</small><small>{new Date(row.createdAt).toLocaleDateString("en-LK")} · {row.items.length} item{row.items.length === 1 ? "" : "s"}</small></span>
      <span className="list-right"><strong>{money(row.totalLkrMinor)}</strong><SellerStatusBadge status={row.status} /></span>
    </button>) : <div className="seller-empty">{dataLoading ? "Loading orders…" : "No orders match this filter."}</div>}</section>
      <aside className="seller-card seller-order-detail">{selected ? <>
        <div className="seller-card-heading"><div><span className="section-kicker">ORDER DETAIL</span><h2>#{selected.order.id.slice(0, 8)}</h2></div><SellerStatusBadge status={selected.status} /></div>
        <p className="seller-muted">Placed {new Date(selected.createdAt).toLocaleString("en-LK")} · Cash on delivery</p>
        {selected.status !== "CANCELLED" && <div className="seller-order-timeline" aria-label="Fulfilment progress">{orderSteps.map((step, index) => <span key={step} className={index <= orderSteps.indexOf(selected.status) ? "done" : ""}><i />{step.toLowerCase()}</span>)}</div>}
        <div className="seller-detail-section"><h3>Items</h3>{selected.items.map((item) => <div key={item.id} className="seller-detail-line"><span><strong>{item.productTitle}</strong><small>{item.sku} · Qty {item.quantity} {Object.values(item.optionValues).join(" / ")}</small></span><b>{money(item.lineLkrMinor)}</b></div>)}</div>
        <div className="seller-detail-section"><h3>Delivery fulfilment</h3><p><MapPin size={15} /> {selected.order.recipient}, {selected.order.line1}{selected.order.line2 ? `, ${selected.order.line2}` : ""}, {selected.order.city}, {selected.order.district} {selected.order.postalCode}</p><p><Phone size={15} /> <a href={`tel:${selected.order.phone.replace(/[^+\d]/g, "")}`}>{selected.order.phone}</a></p></div>
        <div className="seller-detail-section seller-order-totals"><div className="seller-detail-line"><span>Items</span><b>{money(selected.subtotalLkrMinor)}</b></div><div className="seller-detail-line"><span>Delivery</span><b>{money(selected.shippingLkrMinor)}</b></div><div className="seller-detail-line total"><strong>Cash to collect (COD)</strong><strong>{money(selected.totalLkrMinor)}</strong></div></div>
        {nextStatus[selected.status] === "DELIVERED" && <label className="seller-checkbox seller-payment"><input type="checkbox" checked={paymentCollected} onChange={(e) => setPaymentCollected(e.target.checked)} /> I have collected the COD payment</label>}
        <div className="seller-order-actions">{nextStatus[selected.status] && <button className="primary-btn" disabled={busy || isPreview || (nextStatus[selected.status] === "DELIVERED" && !paymentCollected)} onClick={() => void update(selected, nextStatus[selected.status]!)}><Truck size={16} /> {actionName[nextStatus[selected.status]!]}</button>}
          {["PLACED", "ACCEPTED", "PACKED"].includes(selected.status) && <button className="outline-btn seller-danger-button" disabled={busy || isPreview} onClick={() => void update(selected, "CANCELLED")}>Cancel order</button>}</div>
        {selected.events.length > 0 && <div className="seller-detail-section"><h3>History</h3>{selected.events.map((row) => <p key={row.id} className="seller-muted">{row.fromStatus} → {row.toStatus} · {new Date(row.createdAt).toLocaleString("en-LK")}</p>)}</div>}
      </> : <div className="seller-empty"><ClipboardList size={31} /><p>Select an order to see delivery details and update its status.</p></div>}</aside></div>
  </>;
}
