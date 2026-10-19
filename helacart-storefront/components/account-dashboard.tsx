"use client";
/* eslint-disable react/no-unescaped-entities */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Check, ClipboardList, House, LogOut, MapPin, Package, RotateCcw, ShieldCheck, Truck, UserRound } from "lucide-react";
import { reload, sendEmailVerification } from "firebase/auth";
import { api, errorMessage, money } from "@/lib/api";
import { demoOrders } from "@/lib/demo";
import type { Address, Notification, Order, SellerOrder } from "@/lib/types";
import { Breadcrumbs } from "./breadcrumbs";
import { useShop } from "./shop-provider";

type Tab = "orders" | "addresses" | "notifications" | "security";
const progress = ["PLACED", "ACCEPTED", "PACKED", "SHIPPED", "DELIVERED"];
export function AccountDashboard({ initialTab }: { initialTab: Tab }) {
  const { user, authReady, isPreview, signOutBuyer, refreshCart } = useShop();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [orders, setOrders] = useState<Order[]>(isPreview ? demoOrders : []);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(!isPreview);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [returnOrder, setReturnOrder] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (isPreview || !user?.emailVerified) return;
    let active = true;
    user.getIdToken().then(async (token) => {
      const result = await Promise.allSettled([
        api<Order[]>("/me/orders", { token }),
        api<Address[]>("/me/addresses", { token }),
        api<Notification[]>("/me/notifications", { token }),
      ]);
      if (!active) return;
      if (result[0].status === "fulfilled") setOrders(result[0].value);
      else setError(errorMessage(result[0].reason));
      if (result[1].status === "fulfilled") setAddresses(result[1].value);
      if (result[2].status === "fulfilled") setNotifications(result[2].value);
      setLoading(false);
    }).catch((issue) => { if (active) { setError(errorMessage(issue)); setLoading(false); } });
    return () => { active = false; };
  }, [user, isPreview]);
  async function removeAddress(id: string) {
    if (!user) return;
    try {
      await api(`/me/addresses/${id}`, { method: "DELETE", token: await user.getIdToken() });
      setAddresses((old) => old.filter((entry) => entry.id !== id)); setMessage("Address removed.");
    } catch (issue) { setError(errorMessage(issue)); }
  }
  async function readNotice(id: string) {
    if (!user) return;
    try {
      await api(`/me/notifications/${id}/read`, { method: "PATCH", token: await user.getIdToken() });
      setNotifications((old) => old.map((entry) => entry.id === id ? { ...entry, readAt: new Date().toISOString() } : entry));
    } catch (issue) { setError(errorMessage(issue)); }
  }
  async function requestReturn(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !returnOrder) return;
    try {
      await api("/me/returns", { method: "POST", token: await user.getIdToken(),
        body: { sellerOrderId: returnOrder, reason: reason.trim() } });
      setMessage("Return request submitted for review."); setReturnOrder(null); setReason("");
    } catch (issue) { setError(errorMessage(issue)); }
  }
  async function verification(action: "send" | "check") {
    if (!user) return;
    try {
      if (action === "send") { await sendEmailVerification(user); setMessage("Verification email sent."); }
      else { await reload(user); await user.getIdToken(true); if (user.emailVerified) await refreshCart(); setMessage(user.emailVerified ? "Email verified." : "Verification is still pending."); }
    } catch (issue) { setError(errorMessage(issue)); }
  }
  const buyerName = isPreview ? "Sample buyer" : user?.displayName || user?.email?.split("@")[0] || "Your account";
  return <div className="container account-page"><Breadcrumbs items={[{ label: "My Account" }, ...(tab === "orders" ? [{ label: "Orders & Tracking" }] : [])]} />
    {!isPreview && authReady && !user ? <div className="empty-panel"><UserRound size={35} /><h1>Sign in to your account</h1><p>See your orders, addresses and notifications.</p><Link className="primary-btn" href="/auth">Sign in</Link></div> : <>
      <section className="profile-hero"><div className="profile-avatar">{buyerName.slice(0, 1).toUpperCase()}</div><div><span className="section-kicker">BUYER ACCOUNT</span><h1>{buyerName}</h1><p>{isPreview ? "This is a sample buyer profile for design preview." : user?.email || "Loading account..."}</p></div><span className="profile-badge"><ShieldCheck size={15} /> {isPreview ? "Preview account" : user?.emailVerified ? "Email verified" : "Verify email"}</span></section>
      <div className="account-stats"><div><Truck size={20} /><span><strong>{orders.flatMap((order) => order.sellerOrders).filter((entry) => !["DELIVERED", "CANCELLED"].includes(entry.status)).length}</strong><small>Active seller orders</small></span></div><div><Package size={20} /><span><strong>{orders.length}</strong><small>Orders</small></span></div><div><MapPin size={20} /><span><strong>{addresses.length}</strong><small>Saved addresses</small></span></div><div><Bell size={20} /><span><strong>{notifications.filter((entry) => !entry.readAt).length}</strong><small>Unread notifications</small></span></div></div>
      <div className="account-tabs" role="tablist" aria-label="Account sections">
        {([["orders", ClipboardList, "Orders & Tracking"], ["addresses", MapPin, "Delivery Addresses"], ["notifications", Bell, "Notifications"], ["security", ShieldCheck, "Account Security"]] as const).map(([value, Icon, label]) =>
          <button role="tab" aria-selected={tab === value} className={tab === value ? "active" : ""} key={value} onClick={() => setTab(value)}><Icon size={17} /> {label}</button>)}
      </div>
      {error && <div className="message error" role="alert">{error}</div>}
      {message && <div className="message success" role="status">{message}</div>}
      <div className="account-content"><aside className="panel account-side"><strong>ACCOUNT NAVIGATION</strong><button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}><Truck size={17} /> My Orders</button><button className={tab === "addresses" ? "active" : ""} onClick={() => setTab("addresses")}><MapPin size={17} /> Delivery Addresses</button><button className={tab === "notifications" ? "active" : ""} onClick={() => setTab("notifications")}><Bell size={17} /> Notifications</button><button className={tab === "security" ? "active" : ""} onClick={() => setTab("security")}><ShieldCheck size={17} /> Security</button>{!isPreview && user && <button className="signout-btn" onClick={signOutBuyer}><LogOut size={17} /> Sign out</button>}</aside>
        <div className="account-main">
          {tab === "orders" && <><div className="account-section-title"><h2>Orders & Tracking</h2><span>{orders.length} orders</span></div>
            {loading ? <div className="empty-panel">Loading your orders...</div> : orders.length ? orders.map((order) => <section className="panel account-order" key={order.id}>
              <div className="account-order-heading"><div><small>ORDER #{order.id.slice(0, 8).toUpperCase()}</small><h3>{new Date(order.createdAt).toLocaleDateString("en-LK", { day: "numeric", month: "long", year: "numeric" })}</h3><span>Cash on Delivery · {order.city}, {order.district}</span></div><div><small>TOTAL</small><strong>{money(order.totalLkrMinor)}</strong></div></div>
              {order.sellerOrders.map((sellerOrder: SellerOrder) => <div className="seller-order" key={sellerOrder.id}>
                <div className="seller-order-name"><House size={17} /><strong>{sellerOrder.seller.name}</strong><span className="status-pill">{sellerOrder.status.replaceAll("_", " ")}</span></div>
                {sellerOrder.status !== "CANCELLED" && <div className="order-progress">{progress.map((stage) => <span className={progress.indexOf(stage) <= progress.indexOf(sellerOrder.status) ? "done" : ""} key={stage}>{stage.toLowerCase()}</span>)}</div>}
                {sellerOrder.items.map((item) => <div className="order-item" key={item.id}><span className="order-item-icon"><Package size={20} /></span><div><strong>{item.productTitle}</strong><small>Qty {item.quantity} · {item.sku}</small></div><b>{money(item.lineLkrMinor)}</b></div>)}
                {sellerOrder.status === "DELIVERED" && !isPreview && <button className="outline-btn return-trigger" onClick={() => setReturnOrder(sellerOrder.id)}><RotateCcw size={15} /> Request return</button>}
              </div>)}
            </section>) : <div className="empty-panel"><Package size={32} /><h3>No orders yet</h3><p>Your order history will appear here.</p><Link className="primary-btn" href="/products">Shop products</Link></div>}
            {returnOrder && <form className="panel return-form" onSubmit={requestReturn}><h3>Request a return</h3><p>Tell the seller why you would like to return this delivered order.</p><textarea required minLength={10} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} /><div><button className="primary-btn" type="submit">Send request</button><button className="outline-btn" type="button" onClick={() => setReturnOrder(null)}>Cancel</button></div></form>}
          </>}
          {tab === "addresses" && <><div className="account-section-title"><h2>Saved Addresses</h2><Link className="text-link" href="/checkout">Add in checkout</Link></div>{addresses.length ? <div className="address-list">{addresses.map((address) => <div className="panel" key={address.id}><MapPin size={20} /><div><strong>{address.recipient}</strong><p>{address.line1}, {address.city}, {address.district} {address.postalCode}</p><small>{address.phone}</small></div><button onClick={() => removeAddress(address.id)}>Remove</button></div>)}</div> : <div className="empty-panel">No saved addresses yet. Add one when you check out.</div>}</>}
          {tab === "notifications" && <><div className="account-section-title"><h2>Notifications</h2></div>{notifications.length ? notifications.map((entry) => <div className="panel notification-card" key={entry.id}><Bell size={19} /><div><strong>{entry.type?.replaceAll("_", " ") || "HelaCart update"}</strong><p>{entry.message}</p><small>{new Date(entry.createdAt).toLocaleDateString("en-LK")}</small></div>{!entry.readAt && <button onClick={() => readNotice(entry.id)}>Mark read</button>}</div>) : <div className="empty-panel">You're all caught up. Notifications will appear here.</div>}</>}
          {tab === "security" && <div className="panel security-card"><ShieldCheck size={30} /><h2>Email verification</h2><p>{isPreview ? "Connect Firebase to manage your real account." : user?.emailVerified ? "Your email is verified." : "Verify your email before adding items or checking out."}</p>{!isPreview && user && !user.emailVerified && <div><button className="outline-btn" onClick={() => verification("send")}>Resend email</button><button className="primary-btn" onClick={() => verification("check")}><Check size={16} /> I've verified it</button></div>}{!isPreview && user && <button className="signout-btn" onClick={signOutBuyer}>Sign out</button>}</div>}
        </div>
      </div>
    </>}
  </div>;
}
