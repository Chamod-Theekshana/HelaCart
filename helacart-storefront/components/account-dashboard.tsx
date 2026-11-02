"use client";
import { PageQueryBridge } from "./page-query-bridge";

/* eslint-disable react/no-unescaped-entities */

import { useCallback, useState } from "react";
import { ShipmentTracking } from "./shipment-tracking";
import { notificationHref } from "@/lib/notifications";
import Link from "next/link";
import {
  Bell,
  MessageSquare,
  ClipboardList,
  House,
  Heart,
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
import { errorMessage, money, userApi } from "@/lib/api";
import { demoOrders } from "@/lib/demo";
import { shopPath } from "@/lib/shops";
import { pageOf, type Page } from "@/lib/shops";
import { queryString, type BuyerSummary } from "@/lib/workspace";
import {
  ListPagination,
  useBuyerResource,
  useDebounced,
} from "./list-controls";
import { ItemReturnDialog } from "./item-return-dialog";
import { BuyerReturns } from "./buyer-returns";
import { BuyerCancelOrder, BuyerConfirmReceipt } from "./buyer-order-actions";
import { AccountPrivacy } from "./account-privacy";
import { AddressForm } from "./address-form";
import { PhoneVerification } from "./phone-verification";
import { SignInLink } from "./sign-in-link";
import { useLanguage } from "./language-provider";
import {
  closedStatuses,
  fulfilmentSteps,
  orderStatusLabel,
  progressIndex,
  sellerOrderStatuses,
} from "@/lib/order-status";
import s from "./list-controls.module.css";
import profileStyles from "./profile.module.css";
import type {
  Address,
  AddressPatch,
  Notification,
  Order,
  SellerOrder,
} from "@/lib/types";
import { Breadcrumbs } from "./breadcrumbs";
import { useShop } from "./shop-provider";
import { useFavorites } from "./favorites-provider";

type Tab =
  | "profile"
  | "orders"
  | "returns"
  | "addresses"
  | "notifications"
  | "security";
export function AccountDashboard({ initialTab }: { initialTab: Tab }) {
  const { user, authReady, isPreview, signOutBuyer, accountProfile } =
    useShop();
  const favorites = useFavorites();
  const { t, dateLocale } = useLanguage();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [verifyingAddress, setVerifyingAddress] = useState<string | null>(null);
  const [revision, setRevision] = useState(0),
    [orderPage, setOrderPage] = useState(1),
    [noticePage, setNoticePage] = useState(1),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("ALL");
  const applyQuery = useCallback((params: URLSearchParams) => {
    const order = params.get("order"),
      tab = params.get("tab");
    if (order) {
      setQuery(order);
      setTab("orders");
    } else if (
      tab &&
      [
        "orders",
        "returns",
        "addresses",
        "notifications",
        "profile",
        "security",
      ].includes(tab)
    )
      setTab(tab as Tab);
  }, []);
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
        .filter((row) => !closedStatuses.includes(row.status)).length,
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
  async function removeAddress(id: string) {
    if (!user) return;
    try {
      await userApi(user, `/me/addresses/${id}`, { method: "DELETE" });
      setRevision((value) => value + 1);
      setMessage(t("address.removed"));
    } catch (issue) {
      setError(errorMessage(issue));
    }
  }
  async function updateAddress(id: string, body: AddressPatch) {
    if (!user) return;
    await userApi<Address>(user, `/me/addresses/${id}`, {
      method: "PATCH",
      body,
    });
    setEditingAddress(null);
    setRevision((value) => value + 1);
    setMessage(body.isDefault ? t("address.defaultSet") : t("address.updated"));
  }
  async function readNotice(id: string) {
    if (!user) return;
    try {
      await userApi(user, `/me/notifications/${id}/read`, { method: "PATCH" });
      setRevision((value) => value + 1);
    } catch (issue) {
      setError(errorMessage(issue));
    }
  }
  const buyerName = isPreview
    ? previewAccount.name!
    : accountProfile?.name ||
      user?.displayName ||
      user?.email?.split("@")[0] ||
      t("account.yourAccount");
  return (
    <div className="container account-page">
      <PageQueryBridge onChange={applyQuery} />
      <Breadcrumbs
        items={[
          { label: t("account.title") },
          ...(tab === "orders" ? [{ label: t("account.tab.orders") }] : []),
        ]}
      />
      {!isPreview && !authReady ? (
        <div className="empty-panel" role="status">
          {t("account.loading")}
        </div>
      ) : !isPreview && authReady && !user ? (
        <div className="empty-panel">
          <UserRound size={35} />
          <h1>{t("account.signIn.title")}</h1>
          <p>{t("account.signIn.text")}</p>
          <SignInLink className="primary-btn">{t("auth.signIn")}</SignInLink>
        </div>
      ) : (
        <>
          <section className="profile-hero">
            <ProfileAvatar name={buyerName} />
            <div className={profileStyles.identityCopy}>
              <span className="section-kicker">{t("account.kicker")}</span>
              <h1>{buyerName}</h1>
              <p>
                {isPreview
                  ? t("account.previewProfile")
                  : user?.email || t("account.loading")}
              </p>
            </div>
            <span className="profile-badge">
              <ShieldCheck size={15} />{" "}
              {isPreview
                ? t("account.previewBadge")
                : user?.emailVerified
                  ? t("account.emailVerified")
                  : t("account.verifyEmail")}
            </span>
          </section>
          <div className="account-stats">
            <div>
              <Truck size={20} />
              <span>
                <strong>{summary.data?.activeSellerOrders ?? "—"}</strong>
                <small>{t("account.stats.active")}</small>
              </span>
            </div>
            <div>
              <Package size={20} />
              <span>
                <strong>{summary.data?.orders ?? "—"}</strong>
                <small>{t("account.stats.orders")}</small>
              </span>
            </div>
            <div>
              <MapPin size={20} />
              <span>
                <strong>{summary.data?.addresses ?? "—"}</strong>
                <small>{t("account.stats.addresses")}</small>
              </span>
            </div>
            <div>
              <Bell size={20} />
              <span>
                <strong>{summary.data?.unreadNotifications ?? "—"}</strong>
                <small>{t("account.stats.unread")}</small>
              </span>
            </div>
          </div>
          <div
            className="account-tabs"
            role="tablist"
            aria-label={t("account.sections")}
          >
            <Link href="/favorites" className="account-favorites">
              <Heart size={17} />
              {t("account.nav.favorites")}{" "}
              <span>
                {favorites.loading
                  ? "…"
                  : favorites.error
                    ? "—"
                    : favorites.count}
              </span>
            </Link>
            <Link href="/account/support" className="account-favorites">
              <MessageSquare size={17} /> {t("account.nav.support")}
            </Link>
            <Link href="/account/reviews" className="account-favorites">
              <MessageSquare size={17} /> {t("account.nav.reviews")}
            </Link>
            {(
              [
                ["profile", UserRound, t("account.tab.profile")],
                ["orders", ClipboardList, t("account.tab.orders")],
                ["returns", RotateCcw, t("account.tab.returns")],
                ["addresses", MapPin, t("account.tab.addresses")],
                ["notifications", Bell, t("account.tab.notifications")],
                ["security", ShieldCheck, t("account.tab.security")],
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
                {t("account.refresh")}
              </button>
            </div>
          )}
          {message && (
            <div className="message success" role="status">
              {message}
            </div>
          )}
          {!isPreview &&
          !user?.emailVerified &&
          tab !== "security" &&
          tab !== "profile" ? (
            <div className={s.notice}>
              {t("account.verifyToView")}{" "}
              <button
                className={s.returnButton}
                onClick={() => setTab("security")}
              >
                {t("cart.checkVerification")}
              </button>
            </div>
          ) : (
            <div className="account-content">
              <aside className="panel account-side">
                <strong>{t("account.navTitle")}</strong>
                <Link href="/favorites" className="account-favorites">
                  <Heart size={17} />
                  {t("account.nav.favorites")}{" "}
                  <span>
                    {favorites.loading
                      ? "…"
                      : favorites.error
                        ? "—"
                        : favorites.count}
                  </span>
                </Link>
                <button
                  className={tab === "profile" ? "active" : ""}
                  onClick={() => setTab("profile")}
                >
                  <UserRound size={17} /> {t("account.tab.profile")}
                </button>
                <button
                  className={tab === "returns" ? "active" : ""}
                  onClick={() => setTab("returns")}
                >
                  <RotateCcw size={17} />
                  {t("account.nav.returns")}
                </button>
                <button
                  className={tab === "orders" ? "active" : ""}
                  onClick={() => setTab("orders")}
                >
                  <Truck size={17} /> {t("account.nav.orders")}
                </button>
                <button
                  className={tab === "addresses" ? "active" : ""}
                  onClick={() => setTab("addresses")}
                >
                  <MapPin size={17} /> {t("account.tab.addresses")}
                </button>
                <button
                  className={tab === "notifications" ? "active" : ""}
                  onClick={() => setTab("notifications")}
                >
                  <Bell size={17} /> {t("account.tab.notifications")}
                </button>
                <button
                  className={tab === "security" ? "active" : ""}
                  onClick={() => setTab("security")}
                >
                  <ShieldCheck size={17} /> {t("account.nav.security")}
                </button>
                {!isPreview && user && (
                  <button className="signout-btn" onClick={signOutBuyer}>
                    <LogOut size={17} /> {t("account.signOut")}
                  </button>
                )}
              </aside>
              <div className="account-main">
                {tab === "profile" && <AccountProfileEditor />}
                {tab === "orders" && (
                  <>
                    <div className="account-section-title">
                      <h2>{t("account.tab.orders")}</h2>
                      <span>
                        {t("orders.count", {
                          count: ordersResource.data?.total ?? "—",
                        })}
                      </span>
                    </div>
                    <div className={s.filters}>
                      <input
                        aria-label={t("orders.searchLabel")}
                        maxLength={80}
                        placeholder={t("orders.searchPlaceholder")}
                        value={query}
                        onChange={(event) => {
                          setQuery(event.target.value);
                          setOrderPage(1);
                        }}
                      />
                      <select
                        aria-label={t("orders.filterLabel")}
                        value={status}
                        onChange={(event) => {
                          setStatus(event.target.value);
                          setOrderPage(1);
                        }}
                      >
                        <option value="ALL">{t("orders.allStatuses")}</option>
                        {sellerOrderStatuses.map((value) => (
                          <option value={value} key={value}>
                            {orderStatusLabel(t, value)}
                          </option>
                        ))}
                      </select>
                    </div>
                    {loading ? (
                      <div className="empty-panel">{t("orders.loading")}</div>
                    ) : orders.length ? (
                      orders.map((order) => (
                        <section className="panel account-order" key={order.id}>
                          <div className="account-order-heading">
                            <div>
                              <small>
                                {t("orders.number", {
                                  id: order.id.slice(0, 8).toUpperCase(),
                                })}
                              </small>
                              <h3>
                                {new Date(order.createdAt).toLocaleDateString(
                                  dateLocale,
                                  {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                  },
                                )}
                              </h3>
                              <span>
                                {t("trust.cod.title")} · {order.city},{" "}
                                {order.district}
                              </span>
                            </div>
                            <div>
                              <small>{t("orders.originalTotal")}</small>
                              <strong>{money(order.totalLkrMinor)}</strong>
                              {order.sellerOrders.some((part) =>
                                ["CANCELLED", "RETURNED_TO_SELLER"].includes(
                                  part.status,
                                ),
                              ) && (
                                <small>
                                  {t("orders.excludingCancelled")}{" "}
                                  {money(
                                    order.sellerOrders
                                      .filter(
                                        (part) =>
                                          ![
                                            "CANCELLED",
                                            "RETURNED_TO_SELLER",
                                          ].includes(part.status),
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
                                  <span
                                    className={`status-pill status-${sellerOrder.status.toLowerCase()}`}
                                  >
                                    {orderStatusLabel(t, sellerOrder.status)}
                                  </span>
                                </div>
                                {!["CANCELLED", "RETURNED_TO_SELLER"].includes(
                                  sellerOrder.status,
                                ) && (
                                  <div className="order-progress">
                                    {fulfilmentSteps.map((stage, index) => (
                                      <span
                                        className={
                                          index <=
                                          progressIndex(sellerOrder.status)
                                            ? "done"
                                            : ""
                                        }
                                        key={stage}
                                      >
                                        {orderStatusLabel(t, stage)}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {sellerOrder.status === "DELIVERY_FAILED" && (
                                  <p className="status-reason" role="status">
                                    {t("orders.deliveryFailed")}
                                  </p>
                                )}
                                {sellerOrder.status ===
                                  "RETURNED_TO_SELLER" && (
                                  <p className="status-reason" role="status">
                                    {t("orders.returnedToSeller")}
                                  </p>
                                )}
                                {sellerOrder.statusReason && (
                                  <p className="status-reason">
                                    {t("orders.reason", {
                                      reason: sellerOrder.statusReason,
                                    })}
                                  </p>
                                )}
                                {sellerOrder.items.map((item) => (
                                  <div className="order-item" key={item.id}>
                                    <span className="order-item-icon">
                                      <Package size={20} />
                                    </span>
                                    <div>
                                      <strong>{item.productTitle}</strong>
                                      {sellerOrder.status === "DELIVERED" &&
                                        item.variant?.productId && (
                                          <Link
                                            className="text-link"
                                            href={`/products/${item.variant.productId}#product-reviews`}
                                          >
                                            {t("orders.reviewProduct")}
                                          </Link>
                                        )}
                                      <small>
                                        {t("checkout.qty", {
                                          count: item.quantity,
                                        })}{" "}
                                        · {item.sku}
                                      </small>
                                    </div>
                                    <b>{money(item.lineLkrMinor)}</b>
                                  </div>
                                ))}
                                <ShipmentTracking order={sellerOrder} />
                                {sellerOrder.status === "DELIVERED" && (
                                  <Link
                                    className="outline-btn return-trigger"
                                    href={`${shopPath(sellerOrder.seller)}#reviews`}
                                  >
                                    {t("orders.reviewShop")}
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
                                      setMessage(t("orders.refreshed"));
                                    }}
                                  />
                                )}
                                {sellerOrder.status === "SHIPPED" && (
                                  <div className={s.actions}>
                                    <BuyerConfirmReceipt
                                      orderId={order.id}
                                      sellerOrderId={sellerOrder.id}
                                      sellerName={sellerOrder.seller.name}
                                      total={money(sellerOrder.totalLkrMinor)}
                                      onChanged={() => {
                                        setRevision((value) => value + 1);
                                        setMessage(t("orders.receipt.done"));
                                      }}
                                    />
                                  </div>
                                )}
                                {!!sellerOrder.returnRequests?.length && (
                                  <button
                                    className={s.returnButton}
                                    onClick={() => setTab("returns")}
                                  >
                                    {t("orders.viewReturns")}
                                  </button>
                                )}
                                {sellerOrder.status === "DELIVERED" &&
                                  !isPreview && (
                                    <button
                                      className="outline-btn return-trigger"
                                      onClick={() =>
                                        setReturnOrder(sellerOrder.id)
                                      }
                                    >
                                      <RotateCcw size={15} />{" "}
                                      {t("orders.returnItems")}
                                    </button>
                                  )}
                                <Link
                                  className="outline-btn"
                                  href={`/account/support?order=${sellerOrder.id}`}
                                >
                                  {t("orders.support")}
                                </Link>
                              </div>
                            ),
                          )}
                        </section>
                      ))
                    ) : (
                      <div className="empty-panel">
                        <Package size={32} />
                        <h3>{t("orders.empty.title")}</h3>
                        <p>{t("orders.empty.text")}</p>
                        <Link className="primary-btn" href="/products">
                          {t("orders.empty.action")}
                        </Link>
                      </div>
                    )}
                    <ListPagination
                      data={ordersResource.data}
                      onPage={(next) => {
                        setOrderPage(next);
                        setReturnOrder(null);
                      }}
                      label={t("orders.pages")}
                    />
                    {returnOrder && (
                      <ItemReturnDialog
                        key={`${user?.uid}:${returnOrder}`}
                        sellerOrderId={returnOrder}
                        onClose={() => setReturnOrder(null)}
                        onSaved={() => {
                          setReturnOrder(null);
                          setRevision((v) => v + 1);
                          setTab("returns");
                          setMessage(t("orders.returnSubmitted"));
                        }}
                      />
                    )}
                  </>
                )}
                {tab === "returns" && <BuyerReturns revision={revision} />}
                {tab === "addresses" && (
                  <>
                    <div className="account-section-title">
                      <h2>{t("account.addresses.title")}</h2>
                      <Link className="text-link" href="/checkout">
                        {t("account.addresses.add")}
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
                                {address.line1}
                                {address.line2
                                  ? `, ${address.line2}`
                                  : ""}, {address.city}, {address.district}{" "}
                                {address.postalCode}
                              </p>
                              <small>{address.phone}</small>
                              <span className="address-badges">
                                {address.isDefault && (
                                  <span className="badge">
                                    {t("address.default")}
                                  </span>
                                )}
                                {address.phoneVerified === true && (
                                  <span className="badge good">
                                    {t("address.phoneVerified")}
                                  </span>
                                )}
                                {address.phoneVerified === false && (
                                  <span className="badge warn">
                                    {t("address.phoneUnverified")}
                                  </span>
                                )}
                              </span>
                              <span className="address-card-actions">
                                <button
                                  onClick={() =>
                                    setEditingAddress(
                                      editingAddress === address.id
                                        ? null
                                        : address.id,
                                    )
                                  }
                                >
                                  {t("address.edit")}
                                </button>
                                {!address.isDefault && (
                                  <button
                                    onClick={() =>
                                      void updateAddress(address.id, {
                                        isDefault: true,
                                      }).catch((cause) =>
                                        setError(errorMessage(cause)),
                                      )
                                    }
                                  >
                                    {t("address.makeDefault")}
                                  </button>
                                )}
                                {address.phoneVerified === false && (
                                  <button
                                    onClick={() =>
                                      setVerifyingAddress(
                                        verifyingAddress === address.id
                                          ? null
                                          : address.id,
                                      )
                                    }
                                  >
                                    {t("address.verifyPhone")}
                                  </button>
                                )}
                                <button
                                  onClick={() => removeAddress(address.id)}
                                >
                                  {t("address.remove")}
                                </button>
                              </span>
                              {verifyingAddress === address.id && (
                                <PhoneVerification
                                  phone={address.phone}
                                  onVerified={() => {
                                    setVerifyingAddress(null);
                                    setRevision((value) => value + 1);
                                    setMessage(t("phone.verified"));
                                  }}
                                />
                              )}
                              {editingAddress === address.id && (
                                <AddressForm
                                  initial={address}
                                  onCancel={() => setEditingAddress(null)}
                                  onSubmit={(body) =>
                                    updateAddress(address.id, body)
                                  }
                                />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-panel">
                        {t("account.addresses.empty")}
                      </div>
                    )}
                  </>
                )}
                {tab === "notifications" && (
                  <>
                    <div className="account-section-title">
                      <h2>{t("account.tab.notifications")}</h2>
                      <button
                        className="outline-btn"
                        disabled={isPreview || !user}
                        onClick={async () => {
                          if (!user) return;
                          try {
                            await userApi(user, "/me/notifications/read-all", {
                              method: "PATCH",
                            });
                            setRevision((v) => v + 1);
                          } catch (cause) {
                            setError(errorMessage(cause));
                          }
                        }}
                      >
                        {t("notifications.markAll")}
                      </button>
                    </div>
                    {notifications.length ? (
                      notifications.map((entry) => (
                        <div className="panel notification-card" key={entry.id}>
                          <Bell size={19} />
                          <div>
                            <strong>
                              {entry.type?.replaceAll("_", " ") ||
                                t("notifications.update")}
                            </strong>
                            <p>{entry.message}</p>
                            {entry.href &&
                              entry.href.startsWith("/") &&
                              !entry.href.startsWith("//") && (
                                <Link
                                  className="text-link"
                                  href={notificationHref(entry)}
                                  onClick={() => void readNotice(entry.id)}
                                >
                                  {t("notifications.view")}
                                </Link>
                              )}
                            <small>
                              {new Date(entry.createdAt).toLocaleDateString(
                                dateLocale,
                              )}
                            </small>
                          </div>
                          {!entry.readAt && (
                            <button onClick={() => readNotice(entry.id)}>
                              {t("notifications.markRead")}
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="empty-panel">
                        {t("notifications.empty")}
                      </div>
                    )}
                  </>
                )}
                {tab === "notifications" && (
                  <ListPagination
                    data={noticesResource.data}
                    onPage={setNoticePage}
                    label={t("notifications.pages")}
                  />
                )}
                {tab === "security" && (
                  <>
                    <AccountSecurity />
                    {(isPreview || user?.emailVerified) && <AccountPrivacy />}
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
