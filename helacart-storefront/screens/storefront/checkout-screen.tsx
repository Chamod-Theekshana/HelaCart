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
import { api, ApiError, errorMessage, money } from "@/lib/api";
import type { Address, Order } from "@/lib/types";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { useShop } from "@/components/shop-provider";
import { CartFeedback } from "@/components/cart-feedback";
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
  },
];
export default function CheckoutPage() {
  const { user, isPreview } = useShop();
  return (
    <CheckoutForm key={isPreview ? "preview" : user?.uid || "signed-out"} />
  );
}
function CheckoutForm() {
  const router = useRouter();
  const { user, cart, isPreview, refreshCart, cartLoading, cartError } =
    useShop();
  const [addresses, setAddresses] = useState<Address[]>(
    isPreview ? sampleAddresses : [],
  );
  const [selected, setSelected] = useState(isPreview ? "sample-address" : "");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<CheckoutIntent | null>(null);
  const pendingRef = useRef<CheckoutIntent | null>(null);
  const operation = useRef(false);
  const [completedOrderId, setCompletedOrderId] = useState("");
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
    user
      .getIdToken()
      .then((token) => api<Address[]>("/me/addresses", { token }))
      .then((rows) => {
        if (active) {
          setAddresses(rows);
          setSelected((old) =>
            rows.some((row) => row.id === old) ? old : rows[0]?.id || "",
          );
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
  async function saveAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || operation.current || pending) return;
    operation.current = true;
    setLoading(true);
    setMessage("");
    const values = new FormData(event.currentTarget);
    const body = Object.fromEntries(
      ["recipient", "phone", "line1", "city", "district", "postalCode"].map(
        (key) => [key, String(values.get(key) ?? "").trim()],
      ),
    );
    const line2 = String(values.get("line2") ?? "").trim();
    try {
      const saved = await api<Address>("/me/addresses", {
        method: "POST",
        token: await user.getIdToken(),
        body: { ...body, ...(line2 ? { line2 } : {}) },
      });
      setAddresses((old) => [saved, ...old]);
      setSelected(saved.id);
      setShowForm(false);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      operation.current = false;
      setLoading(false);
    }
  }
  async function placeOrder() {
    if (!user || isPreview || operation.current || completedOrderId) return;
    const recovery = pendingRef.current || readCheckoutIntent(user.uid);
    if (
      !recovery &&
      (!selected ||
        !cart?.canCheckout ||
        !cart.checkoutQuote ||
        cartLoading ||
        cartError)
    )
      return;
    operation.current = true;
    setLoading(true);
    setMessage("");
    try {
      await user.reload();
      if (!user.emailVerified)
        throw new Error("Verify your email before checkout.");
      const token = await user.getIdToken(true);
      const intent = recovery || {
        userId: user.uid,
        checkoutKey: crypto.randomUUID(),
        addressId: selected,
        quote: cart!.checkoutQuote!,
      };
      pendingRef.current = intent;
      setPending(intent);
      saveCheckoutIntent(intent);
      const order = await api<Order>("/me/orders/checkout", {
        method: "POST",
        token,
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
      setMessage(errorMessage(error));
      if (error instanceof ApiError && [400, 404, 409].includes(error.status)) {
        clearCheckoutIntent(user.uid);
        pendingRef.current = null;
        setPending(null);
        await refreshCart().catch(() => undefined);
      }
    } finally {
      operation.current = false;
      setLoading(false);
    }
  }
  const rows = cart?.items ?? [];
  return (
    <div className="container checkout-page">
      <Breadcrumbs
        items={[
          { label: "Shopping Cart", href: "/cart" },
          { label: "Cash on Delivery Checkout" },
        ]}
      />
      <div className="page-title">
        <div>
          <span className="section-kicker">SECURE CHECKOUT</span>
          <h1>Cash on Delivery Checkout</h1>
          <p>
            Confirm your delivery address and review the total before placing an
            order.
          </p>
        </div>
        <span className="cod-badge">
          <Banknote size={15} /> COD
        </span>
      </div>
      {isPreview && (
        <div className="message info">
          Design preview: this screen uses sample addresses and cannot submit an
          order.
        </div>
      )}
      {!isPreview && !user && (
        <div className="message info">
          Please <Link href="/auth">sign in</Link> before checkout.
        </div>
      )}
      {!isPreview && user && !user.emailVerified && (
        <div className="message info">
          Verify your email first. <Link href="/auth">Check verification</Link>
        </div>
      )}
      {message && (
        <div className="message error" role="alert">
          {message}
        </div>
      )}
      <CartFeedback />
      {pending && !loading && (
        <div className="message info" role="status">
          A previous checkout needs confirmation. Check it before starting a new
          order. Your original address and totals will be used.{" "}
          <Link href="/orders">View your orders</Link>
        </div>
      )}
      {completedOrderId && (
        <div className="message info" role="status">
          Your order was placed.{" "}
          <Link
            href={`/order-success?orderId=${encodeURIComponent(completedOrderId)}`}
          >
            View confirmation
          </Link>
        </div>
      )}
      <div className="checkout-layout">
        <div className="checkout-sections">
          <section className="panel checkout-panel">
            <div className="checkout-panel-heading">
              <span className="number-dot">1</span>
              <div>
                <h2>Delivery Address</h2>
                <p>Where should your order be delivered?</p>
              </div>
              <button
                type="button"
                className="text-link"
                onClick={() => setShowForm(!showForm)}
                disabled={
                  loading ||
                  Boolean(pending) ||
                  addresses.length >= 20 ||
                  (!isPreview && !user?.emailVerified)
                }
              >
                <Plus size={16} /> Add address
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
                  </span>
                </label>
              ))}
            </div>
            {addressesLoading && (
              <div className="message info" role="status">
                Loading saved addresses…
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
                  Retry addresses
                </button>
              </div>
            )}
            {!addresses.length && !addressesLoading && !addressError && (
              <div className="empty-panel">
                Add a delivery address to continue.
              </div>
            )}
            {showForm &&
              (isPreview ? (
                <div className="message info">
                  Connect Firebase and the API to save real addresses.
                </div>
              ) : (
                <form className="address-form" onSubmit={saveAddress}>
                  <label>
                    Recipient name
                    <input
                      name="recipient"
                      required
                      minLength={2}
                      maxLength={100}
                    />
                  </label>
                  <label>
                    Phone
                    <input
                      name="phone"
                      type="tel"
                      required
                      placeholder="+94 77 123 4567"
                    />
                  </label>
                  <label className="wide">
                    Street address
                    <input
                      name="line1"
                      required
                      minLength={5}
                      maxLength={200}
                    />
                  </label>
                  <label className="wide">
                    Address line 2 (optional)
                    <input name="line2" maxLength={200} />
                  </label>
                  <label>
                    City
                    <input name="city" required minLength={2} maxLength={80} />
                  </label>
                  <label>
                    District
                    <input
                      name="district"
                      required
                      minLength={2}
                      maxLength={80}
                    />
                  </label>
                  <label>
                    Postal code
                    <input
                      name="postalCode"
                      required
                      minLength={3}
                      maxLength={20}
                    />
                  </label>
                  <button
                    className="primary-btn"
                    disabled={loading}
                    type="submit"
                  >
                    {loading ? "Saving..." : "Save address"}
                  </button>
                </form>
              ))}
          </section>
          <section className="panel checkout-panel">
            <div className="checkout-panel-heading">
              <span className="number-dot">2</span>
              <div>
                <h2>Order items</h2>
                <p>Items may ship from different sellers.</p>
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
                      · Qty {item.quantity}
                    </small>
                  </span>
                  <b>{money(item.priceLkrMinor * item.quantity)}</b>
                </div>
              ))
            ) : cartLoading ? (
              <div className="empty-panel" role="status">
                Loading your order items…
              </div>
            ) : cartError ? (
              <div className="empty-panel">
                Refresh your cart to view your order items.
              </div>
            ) : (
              <div className="empty-panel">
                <p>No items in the cart yet.</p>
                <Link href="/products" className="outline-btn">
                  Browse products
                </Link>
              </div>
            )}
          </section>
          <section className="panel checkout-panel">
            <div className="checkout-panel-heading">
              <span className="number-dot">3</span>
              <div>
                <h2>Payment method</h2>
                <p>Pay when your order arrives.</p>
              </div>
            </div>
            <div className="payment-choice">
              <Banknote size={23} />
              <span>
                <strong>Cash on Delivery (COD)</strong>
                <small>
                  The payable amount is shown in your order summary.
                </small>
              </span>
              <span className="payment-check">✓</span>
            </div>
          </section>
        </div>
        <aside className="panel checkout-summary">
          <h2>{pending ? "Previous checkout" : "Order Summary"}</h2>
          {pending ? (
            <p>
              Confirm the result of your previous checkout using its original
              address and totals. The confirmed amount will appear with your
              order.
            </p>
          ) : (
            <>
              <div className="summary-row">
                <span>Items subtotal</span>
                <strong>{money(cart?.subtotalLkrMinor ?? 0)}</strong>
              </div>
              <div className="summary-row">
                <span>Delivery</span>
                <strong>
                  {isPreview
                    ? "Preview only"
                    : money(cart?.shippingLkrMinor ?? 0)}
                </strong>
              </div>
              <div className="summary-total">
                <span>Total due on delivery</span>
                <strong>{money(cart?.totalLkrMinor ?? 0)}</strong>
              </div>
            </>
          )}
          <div className="cod-note">
            <ShieldCheck size={21} />
            <span>
              <strong>Confirm your order</strong>
              <small>Check the address and total before placing it.</small>
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
                  !cart?.canCheckout ||
                  !cart.checkoutQuote ||
                  !selected))
            }
            onClick={placeOrder}
          >
            {loading
              ? "Checking your order..."
              : pending
                ? "Check previous checkout"
                : "Confirm & Place COD Order"}{" "}
            <ArrowRight size={17} />
          </button>
          {isPreview && (
            <p className="small-warning">
              Ordering is disabled in the design preview.
            </p>
          )}
          <Link href="/cart" className="outline-btn full">
            Back to cart
          </Link>
          <div className="summary-icons">
            <span>
              <Truck size={17} /> Delivery
            </span>
            <span>
              <Banknote size={17} /> COD
            </span>
            <span>
              <MapPin size={17} /> Your address
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
