"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Banknote,
  MapPin,
  Package,
  Plus,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { ApiError, errorMessage, money, userApi } from "@/lib/api";
import type { Address, AddressInput, Order, Cart } from "@/lib/types";
import { checkoutErrorCodes, checkoutErrorKey } from "@/lib/checkout-errors";
import deliveryStyles from "@/components/delivery-workspace.module.css";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { useShop } from "@/components/shop-provider";
import { CartFeedback } from "@/components/cart-feedback";
import { AddressForm } from "@/components/address-form";
import { PhoneVerification } from "@/components/phone-verification";
import { SignInLink } from "@/components/sign-in-link";
import { useT } from "@/components/language-provider";
import {
  clearCheckoutIntent,
  readCheckoutIntent,
  saveCheckoutIntent,
  type CheckoutIntent,
} from "@/lib/checkout-intent";

const sampleAddresses: Address[] = [
  {
    id: "sample-address",
    recipient: "Sample customer",
    phone: "+94 77 123 4567",
    line1: "42 Galle Road",
    city: "Colombo 04",
    district: "Colombo",
    postalCode: "00400",
    phoneVerified: true,
    isDefault: true,
  },
];
const preferredAddress = (rows: Address[], current: string) =>
  rows.some((row) => row.id === current)
    ? current
    : (rows.find((row) => row.isDefault) ?? rows[0])?.id || "";

export default function CheckoutPage() {
  const { user, isPreview } = useShop();
  return (
    <CheckoutForm key={isPreview ? "preview" : user?.uid || "signed-out"} />
  );
}
function CheckoutForm() {
  const t = useT();
  const router = useRouter();
  const { user, cart, isPreview, refreshCart, cartLoading, cartError } =
    useShop();
  const [addresses, setAddresses] = useState<Address[]>(
    isPreview ? sampleAddresses : [],
  );
  const [selected, setSelected] = useState(isPreview ? "sample-address" : "");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [verifyingId, setVerifyingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<CheckoutIntent | null>(null);
  const pendingRef = useRef<CheckoutIntent | null>(null);
  const operation = useRef(false);
  const [completedOrderId, setCompletedOrderId] = useState("");
  const [quoteAttempt, setQuoteAttempt] = useState(0);
  const quoteKey = `${user?.uid}:${selected}:${cart?.checkoutQuote}:${quoteAttempt}`;
  const [deliveryState, setDeliveryState] = useState<{
    key: string;
    cart: Cart | null;
    error: string;
  } | null>(null);
  const quotedCart = isPreview
    ? cart
    : deliveryState?.key === quoteKey
      ? deliveryState.cart
      : null;
  const quoteError = deliveryState?.key === quoteKey ? deliveryState.error : "";
  const quoteLoading =
    !isPreview &&
    Boolean(user?.emailVerified && selected) &&
    deliveryState?.key !== quoteKey;
  const blockers = isPreview ? [] : (quotedCart?.checkoutBlockers ?? []);
  useEffect(() => {
    if (isPreview || !user?.emailVerified || !selected || !cart?.checkoutQuote)
      return;
    let active = true;
    userApi<Cart>(user, `/me/cart?addressId=${encodeURIComponent(selected)}`)
      .then((value) => {
        if (active) setDeliveryState({ key: quoteKey, cart: value, error: "" });
      })
      .catch((cause) => {
        if (active)
          setDeliveryState({
            key: quoteKey,
            cart: null,
            error: errorMessage(cause),
          });
      });
    return () => {
      active = false;
    };
  }, [user, isPreview, selected, cart?.checkoutQuote, quoteKey]);
  const [addressError, setAddressError] = useState("");
  const [addressAttempt, setAddressAttempt] = useState(0);
  const [addressesLoading, setAddressesLoading] = useState(
    !isPreview && Boolean(user?.emailVerified),
  );
  useEffect(() => {
    if (!user || isPreview) return;
    const frame = requestAnimationFrame(() => {
      const saved = readCheckoutIntent(user.uid);
      pendingRef.current = saved;
      setPending(saved);
    });
    return () => cancelAnimationFrame(frame);
  }, [user, isPreview]);
  useEffect(() => {
    if (isPreview || !user?.emailVerified) return;
    let active = true;
    userApi<Address[]>(user, "/me/addresses")
      .then((rows) => {
        if (active) {
          setAddresses(rows);
          setSelected((old) => preferredAddress(rows, old));
          setAddressesLoading(false);
          setAddressError("");
        }
      })
      .catch((error) => {
        if (active) {
          setAddressError(errorMessage(error));
          setAddressesLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [isPreview, user, addressAttempt]);
  function reloadAddresses() {
    setAddressAttempt((value) => value + 1);
    setQuoteAttempt((value) => value + 1);
  }
  async function createAddress(body: Partial<AddressInput>) {
    if (!user || pending) return;
    const saved = await userApi<Address>(user, "/me/addresses", {
      method: "POST",
      body,
    });
    setAddresses((old) => [saved, ...old]);
    setSelected(saved.id);
    setShowForm(false);
    setNotice(t("address.saved"));
  }
  async function updateAddress(address: Address, body: Partial<AddressInput>) {
    if (!user || pending) return;
    const saved = await userApi<Address>(user, `/me/addresses/${address.id}`, {
      method: "PATCH",
      body,
    });
    setAddresses((old) =>
      old.map((row) => (row.id === saved.id ? saved : row)),
    );
    setEditing(null);
    setNotice(t("address.updated"));
    setQuoteAttempt((value) => value + 1);
  }
  async function makeDefault(address: Address) {
    if (!user || isPreview || operation.current) return;
    operation.current = true;
    setMessage("");
    try {
      await userApi<Address>(user, `/me/addresses/${address.id}`, {
        method: "PATCH",
        body: { isDefault: true },
      });
      setAddresses((old) =>
        old.map((row) => ({ ...row, isDefault: row.id === address.id })),
      );
      setNotice(t("address.defaultSet"));
    } catch (cause) {
      setMessage(errorMessage(cause));
    } finally {
      operation.current = false;
    }
  }
  async function placeOrder() {
    if (!user || isPreview || operation.current || completedOrderId) return;
    const recovery = pendingRef.current || readCheckoutIntent(user.uid);
    if (
      !recovery &&
      (!selected ||
        !quotedCart?.canCheckout ||
        !quotedCart.checkoutQuote ||
        blockers.length > 0 ||
        cartLoading ||
        cartError)
    )
      return;
    operation.current = true;
    setLoading(true);
    setMessage("");
    try {
      if (!user.emailVerified) {
        // Only an unverified cached user is reloaded; after verification the
        // token is refreshed once so the API sees the verified email.
        await user.reload();
        if (!user.emailVerified) throw new Error(t("checkout.verifyFirst"));
        await user.getIdToken(true);
      }
      const intent = recovery || {
        userId: user.uid,
        checkoutKey: crypto.randomUUID(),
        addressId: selected,
        quote: quotedCart!.checkoutQuote!,
      };
      pendingRef.current = intent;
      setPending(intent);
      saveCheckoutIntent(intent);
      const order = await userApi<Order>(user, "/me/orders/checkout", {
        method: "POST",
        body: {
          addressId: intent.addressId,
          checkoutKey: intent.checkoutKey,
          quote: intent.quote,
        },
      });
      clearCheckoutIntent(user.uid);
      pendingRef.current = null;
      setPending(null);
      setCompletedOrderId(order.id);
      void refreshCart({ checkoutCompleted: true }).catch(() => undefined);
      router.push(`/order-success?orderId=${encodeURIComponent(order.id)}`);
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined;
      setMessage(
        code && (checkoutErrorCodes as readonly string[]).includes(code)
          ? t(checkoutErrorKey(code))
          : errorMessage(error),
      );
      if (code === "PHONE_NOT_VERIFIED") setVerifyingId(selected);
      if (error instanceof ApiError && [400, 404, 409].includes(error.status)) {
        clearCheckoutIntent(user.uid);
        pendingRef.current = null;
        setPending(null);
        await refreshCart().catch(() => undefined);
        setQuoteAttempt((v) => v + 1);
      }
    } finally {
      operation.current = false;
      setLoading(false);
    }
  }
  const rows = cart?.items ?? [];
  const selectedAddress = addresses.find(
    (row) => row.id === (pending?.addressId || selected),
  );
  // The OTP panel opens when checkout requires it, or on request.
  const needsPhone =
    !isPreview &&
    Boolean(selectedAddress) &&
    selectedAddress?.phoneVerified !== true &&
    (blockers.includes("PHONE_NOT_VERIFIED") ||
      verifyingId === selectedAddress?.id);
  return (
    <div className="container checkout-page">
      <Breadcrumbs
        items={[
          { label: t("cart.title"), href: "/cart" },
          { label: t("checkout.title") },
        ]}
      />
      <div className="page-title">
        <div>
          <span className="section-kicker">{t("checkout.kicker")}</span>
          <h1>{t("checkout.title")}</h1>
          <p>{t("checkout.subtitle")}</p>
        </div>
        <span className="cod-badge">
          <Banknote size={15} /> COD
        </span>
      </div>
      {isPreview && (
        <div className="message info">{t("checkout.previewNotice")}</div>
      )}
      {!isPreview && !user && (
        <div className="message info">
          {t("checkout.signInFirst")}{" "}
          <SignInLink next="/checkout">{t("auth.signIn")}</SignInLink>
        </div>
      )}
      {!isPreview && user && !user.emailVerified && (
        <div className="message info">
          {t("checkout.verifyFirst")}{" "}
          <SignInLink next="/checkout">
            {t("cart.checkVerification")}
          </SignInLink>
        </div>
      )}
      {message && (
        <div className="message error" role="alert">
          {message}
        </div>
      )}
      {notice && !message && (
        <div className="message success" role="status">
          {notice}
        </div>
      )}
      <CartFeedback />
      {blockers.length > 0 && (
        <div className="message error checkout-blockers" role="alert">
          {[...new Set(blockers)].map((code) => (
            <p key={code}>{t(checkoutErrorKey(code))}</p>
          ))}
        </div>
      )}
      {quoteError && (
        <div className="message error" role="alert">
          {quoteError}
          <button
            className="outline-btn"
            onClick={() => setQuoteAttempt((v) => v + 1)}
          >
            {t("checkout.recalculate")}
          </button>
        </div>
      )}
      {pending && !loading && (
        <div className="message info" role="status">
          {t("checkout.pendingNotice")}{" "}
          <Link href="/orders">{t("checkout.viewOrders")}</Link>
        </div>
      )}
      {completedOrderId && (
        <div className="message info" role="status">
          {t("checkout.placed")}{" "}
          <Link
            href={`/order-success?orderId=${encodeURIComponent(completedOrderId)}`}
          >
            {t("checkout.viewConfirmation")}
          </Link>
        </div>
      )}
      <div className="checkout-layout">
        <div className="checkout-sections">
          <section className="panel checkout-panel">
            <div className="checkout-panel-heading">
              <span className="number-dot">1</span>
              <div>
                <h2>{t("checkout.address.title")}</h2>
                <p>{t("checkout.address.subtitle")}</p>
              </div>
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  setEditing(null);
                  setShowForm(!showForm);
                }}
                disabled={
                  loading ||
                  Boolean(pending) ||
                  addresses.length >= 20 ||
                  (!isPreview && !user?.emailVerified)
                }
              >
                <Plus size={16} /> {t("checkout.address.add")}
              </button>
            </div>
            <div className="address-grid">
              {addresses.map((address) => (
                <label
                  className={`address-card ${(pending?.addressId || selected) === address.id ? "selected" : ""}`}
                  key={address.id}
                >
                  <input
                    type="radio"
                    name="address"
                    value={address.id}
                    disabled={loading || Boolean(pending)}
                    checked={(pending?.addressId || selected) === address.id}
                    onChange={() => setSelected(address.id)}
                  />
                  <span>
                    <strong>{address.recipient}</strong>
                    <small>{address.phone}</small>
                    <small>
                      {address.line1}
                      {address.line2 ? `, ${address.line2}` : ""}
                    </small>
                    <small>
                      {address.city}, {address.district} · {address.postalCode}
                    </small>
                    <span className="address-badges">
                      {address.isDefault && (
                        <span className="badge">{t("address.default")}</span>
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
                    {!isPreview && !pending && (
                      <span className="address-card-actions">
                        <button
                          type="button"
                          disabled={loading}
                          onClick={(event) => {
                            event.preventDefault();
                            setShowForm(false);
                            setEditing(address);
                          }}
                        >
                          {t("address.edit")}
                        </button>
                        {!address.isDefault && (
                          <button
                            type="button"
                            disabled={loading}
                            onClick={(event) => {
                              event.preventDefault();
                              void makeDefault(address);
                            }}
                          >
                            {t("address.makeDefault")}
                          </button>
                        )}
                        {address.phoneVerified === false && (
                          <button
                            type="button"
                            disabled={loading}
                            onClick={(event) => {
                              event.preventDefault();
                              setSelected(address.id);
                              setVerifyingId(address.id);
                            }}
                          >
                            {t("address.verifyPhone")}
                          </button>
                        )}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
            {addressesLoading && (
              <div className="message info" role="status">
                {t("checkout.address.loading")}
              </div>
            )}
            {addressError && (
              <div className="message error" role="alert">
                {addressError}{" "}
                <button
                  className="text-link"
                  onClick={() => {
                    setAddressesLoading(true);
                    setAddressError("");
                    setAddressAttempt((value) => value + 1);
                  }}
                >
                  {t("checkout.address.retry")}
                </button>
              </div>
            )}
            {!addresses.length && !addressesLoading && !addressError && (
              <div className="empty-panel">{t("checkout.address.empty")}</div>
            )}
            {needsPhone && selectedAddress && (
              <div className="address-verify">
                <PhoneVerification
                  key={`${selectedAddress.id}:${selectedAddress.phone}`}
                  phone={selectedAddress.phone}
                  onVerified={() => {
                    setVerifyingId("");
                    setNotice(t("phone.verified"));
                    reloadAddresses();
                  }}
                />
              </div>
            )}
            {editing && !isPreview && (
              <AddressForm
                key={editing.id}
                initial={editing}
                disabled={Boolean(pending)}
                onCancel={() => setEditing(null)}
                onSubmit={(body) => updateAddress(editing, body)}
              />
            )}
            {showForm &&
              !editing &&
              (isPreview ? (
                <div className="message info">
                  {t("checkout.address.previewNotice")}
                </div>
              ) : (
                <AddressForm
                  disabled={loading || Boolean(pending)}
                  onCancel={() => setShowForm(false)}
                  onSubmit={createAddress}
                />
              ))}
          </section>
          <section className="panel checkout-panel">
            <div className="checkout-panel-heading">
              <span className="number-dot">2</span>
              <div>
                <h2>{t("checkout.items.title")}</h2>
                <p>{t("checkout.items.subtitle")}</p>
              </div>
            </div>
            {rows.length ? (
              rows.map((item) => (
                <div className="checkout-item" key={item.variantId}>
                  <span className="checkout-item-icon">
                    <Package size={23} />
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      {Object.values(item.optionValues || {}).join(" / ") ||
                        item.sku}{" "}
                      · {t("checkout.qty", { count: item.quantity })}
                    </small>
                  </span>
                  <b>{money(item.priceLkrMinor * item.quantity)}</b>
                </div>
              ))
            ) : cartLoading ? (
              <div className="empty-panel" role="status">
                {t("checkout.items.loading")}
              </div>
            ) : cartError ? (
              <div className="empty-panel">{t("checkout.items.error")}</div>
            ) : (
              <div className="empty-panel">
                <p>{t("checkout.items.empty")}</p>
                <Link href="/products" className="outline-btn">
                  {t("cart.empty.action")}
                </Link>
              </div>
            )}
          </section>
          <section className="panel checkout-panel">
            <div className="checkout-panel-heading">
              <span className="number-dot">3</span>
              <div>
                <h2>{t("checkout.payment.title")}</h2>
                <p>{t("cart.codText")}</p>
              </div>
            </div>
            <div className="payment-choice">
              <Banknote size={23} />
              <span>
                <strong>{t("checkout.payment.cod")}</strong>
                <small>{t("checkout.payment.text")}</small>
              </span>
              <span className="payment-check">✓</span>
            </div>
          </section>
        </div>
        <aside className="panel checkout-summary">
          <h2>{pending ? t("checkout.previous") : t("cart.summary")}</h2>
          {pending ? (
            <p>{t("checkout.previousText")}</p>
          ) : (
            <>
              <div className="summary-row">
                <span>{t("cart.subtotal")}</span>
                <strong>
                  {money(
                    quotedCart?.subtotalLkrMinor ?? cart?.subtotalLkrMinor ?? 0,
                  )}
                </strong>
              </div>
              <div className="summary-row">
                <span>{t("checkout.delivery")}</span>
                <strong>
                  {isPreview
                    ? t("checkout.previewOnly")
                    : quoteLoading
                      ? t("checkout.calculating")
                      : quotedCart
                        ? money(quotedCart.shippingLkrMinor)
                        : t("checkout.selectAddress")}
                </strong>
              </div>
              <div className="summary-total">
                <span>{t("checkout.totalDue")}</span>
                <strong>
                  {quotedCart ? money(quotedCart.totalLkrMinor) : "—"}
                </strong>
              </div>
            </>
          )}
          {!pending &&
            quotedCart?.deliveryBySeller?.map((d) => (
              <div className={deliveryStyles.quote} key={d.sellerId}>
                <strong>{d.sellerName}</strong>
                {d.available ? (
                  <>
                    <span>
                      {d.freeDelivery
                        ? t("checkout.freeDelivery")
                        : money(d.feeMinor ?? 0)}
                      {d.district ? ` · ${d.district}` : ""}
                    </span>
                    {d.minDays && d.maxDays && (
                      <p className={deliveryStyles.muted}>
                        {t("checkout.estimateDays", {
                          min: d.minDays,
                          max: d.maxDays,
                        })}
                      </p>
                    )}
                  </>
                ) : (
                  <p role="alert">{d.reason}</p>
                )}
              </div>
            ))}
          <div className="cod-note">
            <ShieldCheck size={21} />
            <span>
              <strong>{t("checkout.confirmTitle")}</strong>
              <small>{t("checkout.confirmText")}</small>
            </span>
          </div>
          <button
            className="primary-btn full"
            disabled={
              isPreview ||
              loading ||
              Boolean(completedOrderId) ||
              !user?.emailVerified ||
              (!pending &&
                (cartLoading ||
                  Boolean(cartError) ||
                  quoteLoading ||
                  blockers.length > 0 ||
                  !quotedCart?.canCheckout ||
                  !quotedCart.checkoutQuote ||
                  !selected))
            }
            onClick={placeOrder}
          >
            {loading
              ? t("checkout.checking")
              : pending
                ? t("checkout.checkPrevious")
                : t("checkout.place")}{" "}
            <ArrowRight size={17} />
          </button>
          {isPreview && (
            <p className="small-warning">{t("checkout.previewDisabled")}</p>
          )}
          <Link href="/cart" className="outline-btn full">
            {t("checkout.backToCart")}
          </Link>
          <div className="summary-icons">
            <span>
              <Truck size={17} /> {t("checkout.delivery")}
            </span>
            <span>
              <Banknote size={17} /> COD
            </span>
            <span>
              <MapPin size={17} /> {t("checkout.yourAddress")}
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
