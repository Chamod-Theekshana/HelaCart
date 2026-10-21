"use client";
/* eslint-disable react/no-unescaped-entities */

import { useState } from "react";
import Link from "next/link";
import {
  Bell,
  ClipboardList,
  House,
  LogOut,
  MapPin,
  Package,
  RotateCcw,
  ShieldCheck,
  Truck,
  UserRound,
} from "lucide-react";
import { AccountProfileEditor } from "./account-profile";
import { AccountSecurity } from "./account-security";
import { ProfileAvatar } from "./profile-avatar";
import { previewAccount } from "@/lib/profile";
import { api, errorMessage, money } from "@/lib/api";
import { demoOrders } from "@/lib/demo";
import { shopPath } from "@/lib/shops";
import { pageOf, type Page } from "@/lib/shops";
import { queryString, type BuyerSummary } from "@/lib/workspace";
import {
  ListPagination,
  useBuyerResource,
  useDebounced,
} from "./list-controls";
import { BuyerReturns } from "./buyer-returns";
import { BuyerCancelOrder } from "./buyer-order-actions";
import s from "./list-controls.module.css";
import profileStyles from "./profile.module.css";
import type { Address, Notification, Order, SellerOrder } from "@/lib/types";
import { Breadcrumbs } from "./breadcrumbs";
import { useShop } from "./shop-provider";

type Tab = "profile" | "orders" | "returns" | "addresses" | "notifications" | "security";
const progress = ["PLACED", "ACCEPTED", "PACKED", "SHIPPED", "DELIVERED"];
export function AccountDashboard({ initialTab }: { initialTab: Tab }) {
  const { user, authReady, isPreview, signOutBuyer, accountProfile } = useShop();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [revision, setRevision] = useState(0),
    [orderPage, setOrderPage] = useState(1),
    [noticePage, setNoticePage] = useState(1),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("ALL");
  const search = useDebounced(query);
  const ordersResource = useBuyerResource<Page<Order>>(
    `/workspace/me/orders?${queryString({ page: orderPage, q: search, status })}`,
    pageOf(
      demoOrders.filter(
        (row) =>
          (status === "ALL" ||
            row.sellerOrders.some((part) => part.status === status)) &&
          `${row.id} ${row.recipient}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
      orderPage,
    ),
    revision,
    tab === "orders",
  );
  const addressResource = useBuyerResource<Address[]>(
    "/me/addresses",
    [],
    revision,
    tab === "addresses",
  );
  const noticesResource = useBuyerResource<Page<Notification>>(
    `/workspace/me/notifications?page=${noticePage}`,
    pageOf<Notification>([], noticePage),
    revision,
    tab === "notifications",
  );
  const summary = useBuyerResource<BuyerSummary>(
    "/workspace/me/summary",
    {
      orders: demoOrders.length,
      activeSellerOrders: demoOrders
        .flatMap((row) => row.sellerOrders)
        .filter((row) => !["DELIVERED", "CANCELLED"].includes(row.status))
        .length,
      addresses: 0,
      unreadNotifications: 0,
      returns: 0,
    },
    revision,
  );
  const orders = ordersResource.data?.items ?? [],
    addresses = addressResource.data ?? [],
    notifications = noticesResource.data?.items ?? [],
    loading = ordersResource.loading;
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [returnOrder, setReturnOrder] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [returnBusy, setReturnBusy] = useState(false);
  async function removeAddress(id: string) {
    if (!user) return;
    try {
      await api(`/me/addresses/${id}`, {
        method: "DELETE",
        token: await user.getIdToken(),
      });
      setRevision((value) => value + 1);
      setMessage("Address removed.");
    } catch (issue) {
      setError(errorMessage(issue));
    }
  }
  async function readNotice(id: string) {
    if (!user) return;
    try {
      await api(`/me/notifications/${id}/read`, {
        method: "PATCH",
        token: await user.getIdToken(),
      });
      setRevision((value) => value + 1);
    } catch (issue) {
      setError(errorMessage(issue));
    }
  }
  async function requestReturn(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !returnOrder || returnBusy) return;
    setReturnBusy(true);
    setError("");
    try {
      await api("/me/returns", {
        method: "POST",
        token: await user.getIdToken(),
        body: { sellerOrderId: returnOrder, reason: reason.trim() },
      });
      setMessage(
        "Return request submitted for review. Follow its progress below.",
      );
      setReturnOrder(null);
      setReason("");
      setRevision((value) => value + 1);
      setTab("returns");
    } catch (issue) {
      setError(errorMessage(issue));
    } finally {
      setReturnBusy(false);
    }
  }
  const buyerName = isPreview
    ? previewAccount.name!
    : accountProfile?.name || user?.displayName || user?.email?.split("@")[0] || "Your account";
  return (
    <div className="container account-page">
      <Breadcrumbs
        items={[
          { label: "My Account" },
          ...(tab === "orders" ? [{ label: "Orders & Tracking" }] : []),
        ]}
      />
      {!isPreview && !authReady ? (
        <div className="empty-panel" role="status">
          Loading your account…
        </div>
      ) : !isPreview && authReady && !user ? (
        <div className="empty-panel">
          <UserRound size={35} />
          <h1>Sign in to your account</h1>
          <p>See your orders, addresses and notifications.</p>
          <Link className="primary-btn" href="/auth">
            Sign in
          </Link>
        </div>
      ) : (
        <>
          <section className="profile-hero">
            <ProfileAvatar name={buyerName} />
            <div className={profileStyles.identityCopy}>
              <span className="section-kicker">BUYER ACCOUNT</span>
              <h1>{buyerName}</h1>
              <p>
                {isPreview
                  ? "This is a sample buyer profile for design preview."
                  : user?.email || "Loading account..."}
              </p>
            </div>
            <span className="profile-badge">
              <ShieldCheck size={15} />{" "}
              {isPreview
                ? "Preview account"
                : user?.emailVerified
                  ? "Email verified"
                  : "Verify email"}
            </span>
          </section>
          <div className="account-stats">
            <div>
              <Truck size={20} />
              <span>
                <strong>{summary.data?.activeSellerOrders ?? "—"}</strong>
                <small>Active seller orders</small>
              </span>
            </div>
            <div>
              <Package size={20} />
              <span>
                <strong>{summary.data?.orders ?? "—"}</strong>
                <small>Orders</small>
              </span>
            </div>
            <div>
              <MapPin size={20} />
              <span>
                <strong>{summary.data?.addresses ?? "—"}</strong>
                <small>Saved addresses</small>
              </span>
            </div>
            <div>
              <Bell size={20} />
              <span>
                <strong>{summary.data?.unreadNotifications ?? "—"}</strong>
                <small>Unread notifications</small>
              </span>
            </div>
          </div>
          <div
            className="account-tabs"
            role="tablist"
            aria-label="Account sections"
          >
            {(
              [
                ["profile", UserRound, "My Profile"],
                ["orders", ClipboardList, "Orders & Tracking"],
                ["returns", RotateCcw, "Returns"],
                ["addresses", MapPin, "Delivery Addresses"],
                ["notifications", Bell, "Notifications"],
                ["security", ShieldCheck, "Account Security"],
              ] as const
            ).map(([value, Icon, label]) => (
              <button
                role="tab"
                aria-selected={tab === value}
                className={tab === value ? "active" : ""}
                key={value}
                onClick={() => setTab(value)}
              >
                <Icon size={17} /> {label}
              </button>
            ))}
          </div>
          {(error ||
            (tab === "orders" && ordersResource.error) ||
            (tab === "addresses" && addressResource.error) ||
            (tab === "notifications" && noticesResource.error) ||
            summary.error) && (
            <div className="message error" role="alert">
              {error ||
                (tab === "orders" && ordersResource.error) ||
                (tab === "addresses" && addressResource.error) ||
                (tab === "notifications" && noticesResource.error) ||
                summary.error}
              <button
                className={s.retry}
                onClick={() => {
                  setError("");
                  setRevision((value) => value + 1);
                }}
              >
                Refresh account
              </button>
            </div>
          )}
          {message && (
            <div className="message success" role="status">
              {message}
            </div>
          )}
          {!isPreview && !user?.emailVerified && tab !== "security" && tab !== "profile" ? (
            <div className={s.notice}>
              Verify your email to view your orders and returns.{" "}
              <button
                className={s.returnButton}
                onClick={() => setTab("security")}
              >
                Check verification
              </button>
            </div>
          ) : (
            <div className="account-content">
              <aside className="panel account-side">
                <strong>ACCOUNT NAVIGATION</strong>
                <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}><UserRound size={17} /> My Profile</button>
                <button
                  className={tab === "returns" ? "active" : ""}
                  onClick={() => setTab("returns")}
                >
                  <RotateCcw size={17} />
                  My Returns
                </button>
                <button
                  className={tab === "orders" ? "active" : ""}
                  onClick={() => setTab("orders")}
                >
                  <Truck size={17} /> My Orders
                </button>
                <button
                  className={tab === "addresses" ? "active" : ""}
                  onClick={() => setTab("addresses")}
                >
                  <MapPin size={17} /> Delivery Addresses
                </button>
                <button
                  className={tab === "notifications" ? "active" : ""}
                  onClick={() => setTab("notifications")}
                >
                  <Bell size={17} /> Notifications
                </button>
                <button
                  className={tab === "security" ? "active" : ""}
                  onClick={() => setTab("security")}
                >
                  <ShieldCheck size={17} /> Security
                </button>
                {!isPreview && user && (
                  <button className="signout-btn" onClick={signOutBuyer}>
                    <LogOut size={17} /> Sign out
                  </button>
                )}
              </aside>
              <div className="account-main">
                {tab === "profile" && <AccountProfileEditor />}
                {tab === "orders" && (
                  <>
                    <div className="account-section-title">
                      <h2>Orders & Tracking</h2>
                      <span>{ordersResource.data?.total ?? "—"} orders</span>
                    </div>
                    <div className={s.filters}>
                      <input
                        aria-label="Search your orders"
                        maxLength={80}
                        placeholder="Search order reference or recipient"
                        value={query}
                        onChange={(event) => {
                          setQuery(event.target.value);
                          setOrderPage(1);
                        }}
                      />
                      <select
                        aria-label="Filter your order status"
                        value={status}
                        onChange={(event) => {
                          setStatus(event.target.value);
                          setOrderPage(1);
                        }}
                      >
                        <option value="ALL">All statuses</option>
                        {[...progress, "CANCELLED"].map((value) => (
                          <option value={value} key={value}>
                            {value.toLowerCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                    {loading ? (
                      <div className="empty-panel">Loading your orders...</div>
                    ) : orders.length ? (
                      orders.map((order) => (
                        <section className="panel account-order" key={order.id}>
                          <div className="account-order-heading">
                            <div>
                              <small>
                                ORDER #{order.id.slice(0, 8).toUpperCase()}
                              </small>
                              <h3>
                                {new Date(order.createdAt).toLocaleDateString(
                                  "en-LK",
                                  {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                  },
                                )}
                              </h3>
                              <span>
                                Cash on Delivery · {order.city},{" "}
                                {order.district}
                              </span>
                            </div>
                            <div>
                              <small>ORIGINAL TOTAL</small>
                              <strong>{money(order.totalLkrMinor)}</strong>
                              {order.sellerOrders.some(
                                (part) => part.status === "CANCELLED",
                              ) && (
                                <small>
                                  Excluding cancelled deliveries:{" "}
                                  {money(
                                    order.sellerOrders
                                      .filter(
                                        (part) => part.status !== "CANCELLED",
                                      )
                                      .reduce(
                                        (sum, part) => sum + part.totalLkrMinor,
                                        0,
                                      ),
                                  )}
                                </small>
                              )}
                            </div>
                          </div>
                          {order.sellerOrders.map(
                            (sellerOrder: SellerOrder) => (
                              <div
                                className="seller-order"
                                key={sellerOrder.id}
                              >
                                <div className="seller-order-name">
                                  <House size={17} />
                                  <Link href={shopPath(sellerOrder.seller)}>
                                    <strong>{sellerOrder.seller.name}</strong>
                                  </Link>
                                  <span className="status-pill">
                                    {sellerOrder.status.replaceAll("_", " ")}
                                  </span>
                                </div>
                                {sellerOrder.status !== "CANCELLED" && (
                                  <div className="order-progress">
                                    {progress.map((stage) => (
                                      <span
                                        className={
                                          progress.indexOf(stage) <=
                                          progress.indexOf(sellerOrder.status)
                                            ? "done"
                                            : ""
                                        }
                                        key={stage}
                                      >
                                        {stage.toLowerCase()}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {sellerOrder.items.map((item) => (
                                  <div className="order-item" key={item.id}>
                                    <span className="order-item-icon">
                                      <Package size={20} />
                                    </span>
                                    <div>
                                      <strong>{item.productTitle}</strong>
                                      <small>
                                        Qty {item.quantity} · {item.sku}
                                      </small>
                                    </div>
                                    <b>{money(item.lineLkrMinor)}</b>
                                  </div>
                                ))}
                                {sellerOrder.status === "DELIVERED" && (
                                  <Link
                                    className="outline-btn return-trigger"
                                    href={`${shopPath(sellerOrder.seller)}#reviews`}
                                  >
                                    Review this shop
                                  </Link>
                                )}
                                {sellerOrder.status === "PLACED" && (
                                  <BuyerCancelOrder
                                    key={sellerOrder.id + ":" + revision}
                                    orderId={order.id}
                                    sellerOrderId={sellerOrder.id}
                                    sellerName={sellerOrder.seller.name}
                                    onChanged={() => {
                                      setRevision((value) => value + 1);
                                      setMessage("Order status refreshed.");
                                    }}
                                  />
                                )}
                                {sellerOrder.returnRequest ? (
                                  <button
                                    className={s.returnButton}
                                    onClick={() => setTab("returns")}
                                  >
                                    Return{" "}
                                    {sellerOrder.returnRequest.status.toLowerCase()}{" "}
                                    · View progress
                                  </button>
                                ) : (
                                  sellerOrder.status === "DELIVERED" &&
                                  !isPreview && (
                                    <button
                                      className="outline-btn return-trigger"
                                      onClick={() =>
                                        setReturnOrder(sellerOrder.id)
                                      }
                                    >
                                      <RotateCcw size={15} /> Request return
                                    </button>
                                  )
                                )}
                              </div>
                            ),
                          )}
                        </section>
                      ))
                    ) : (
                      <div className="empty-panel">
                        <Package size={32} />
                        <h3>No orders yet</h3>
                        <p>Your order history will appear here.</p>
                        <Link className="primary-btn" href="/products">
                          Shop products
                        </Link>
                      </div>
                    )}
                    <ListPagination
                      data={ordersResource.data}
                      onPage={(next) => {
                        setOrderPage(next);
                        setReturnOrder(null);
                      }}
                      label="Your order pages"
                    />
                    {returnOrder && (
                      <form
                        className="panel return-form"
                        onSubmit={requestReturn}
                      >
                        <h3>Request a return</h3>
                        <p>
                          Tell the seller why you would like to return this
                          delivered order.
                        </p>
                        <textarea
                          required
                          minLength={10}
                          maxLength={1000}
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                        />
                        <div>
                          <button
                            className="primary-btn"
                            type="submit"
                            disabled={returnBusy || reason.trim().length < 10}
                          >
                            {returnBusy ? "Sending…" : "Send request"}
                          </button>
                          <button
                            className="outline-btn"
                            type="button"
                            disabled={returnBusy}
                            onClick={() => setReturnOrder(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                )}
                {tab === "returns" && <BuyerReturns revision={revision} />}
                {tab === "addresses" && (
                  <>
                    <div className="account-section-title">
                      <h2>Saved Addresses</h2>
                      <Link className="text-link" href="/checkout">
                        Add in checkout
                      </Link>
                    </div>
                    {addresses.length ? (
                      <div className="address-list">
                        {addresses.map((address) => (
                          <div className="panel" key={address.id}>
                            <MapPin size={20} />
                            <div>
                              <strong>{address.recipient}</strong>
                              <p>
                                {address.line1}, {address.city},{" "}
                                {address.district} {address.postalCode}
                              </p>
                              <small>{address.phone}</small>
                            </div>
                            <button onClick={() => removeAddress(address.id)}>
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-panel">
                        No saved addresses yet. Add one when you check out.
                      </div>
                    )}
                  </>
                )}
                {tab === "notifications" && (
                  <>
                    <div className="account-section-title">
                      <h2>Notifications</h2>
                    </div>
                    {notifications.length ? (
                      notifications.map((entry) => (
                        <div className="panel notification-card" key={entry.id}>
                          <Bell size={19} />
                          <div>
                            <strong>
                              {entry.type?.replaceAll("_", " ") ||
                                "HelaCart update"}
                            </strong>
                            <p>{entry.message}</p>
                            <small>
                              {new Date(entry.createdAt).toLocaleDateString(
                                "en-LK",
                              )}
                            </small>
                          </div>
                          {!entry.readAt && (
                            <button onClick={() => readNotice(entry.id)}>
                              Mark read
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="empty-panel">
                        You're all caught up. Notifications will appear here.
                      </div>
                    )}
                  </>
                )}
                {tab === "notifications" && (
                  <ListPagination
                    data={noticesResource.data}
                    onPage={setNoticePage}
                    label="Notification pages"
                  />
                )}
                {tab === "security" && <AccountSecurity />}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
