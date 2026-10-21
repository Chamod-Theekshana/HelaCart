"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { api, errorMessage, money } from "@/lib/api";
import type { Order } from "@/lib/types";
import { useShop } from "./shop-provider";

export function OrderConfirmation({ orderId }: { orderId: string }) {
  const { user } = useShop();
  const identityKey = `${user?.uid}:${orderId}`;
  const [state, setState] = useState<{
    key: string;
    order: Order | null;
    error: string;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const order = user && state?.key === identityKey ? state.order : null;
  const error = state?.key === identityKey ? state.error : "";
  useEffect(() => {
    if (!user || !orderId) return;
    let active = true;
    user
      .getIdToken()
      .then((token) =>
        api<Order>(`/me/orders/${encodeURIComponent(orderId)}`, { token }),
      )
      .then((data) => {
        if (active) setState({ key: identityKey, order: data, error: "" });
      })
      .catch((issue) => {
        if (active)
          setState({
            key: identityKey,
            order: null,
            error: errorMessage(issue),
          });
      });
    return () => {
      active = false;
    };
  }, [user, orderId, identityKey, attempt]);
  const due =
    order?.sellerOrders
      .filter((part) => !["CANCELLED", "DELIVERED"].includes(part.status))
      .reduce((sum, part) => sum + part.totalLkrMinor, 0) ?? 0;
  return (
    <div className="container success-page">
      <div className="panel success-card">
        {order ? (
          <>
            <CheckCircle2 size={57} />
            <span className="section-kicker">ORDER CONFIRMED</span>
            <h1>Thank you for shopping with HelaCart!</h1>
            <p>
              Your cash on delivery order has been placed. You can view its
              seller orders in your account.
            </p>
            <div className="success-meta">
              <div>
                <span>Order number</span>
                <strong>#{order.id.slice(0, 8).toUpperCase()}</strong>
              </div>
              <div>
                <span>Amount still due on delivery</span>
                <strong>{money(due)}</strong>
                {due !== order.totalLkrMinor && (
                  <small>Original total: {money(order.totalLkrMinor)}</small>
                )}
              </div>
              <div>
                <span>Delivery address</span>
                <strong>
                  {order.line1}, {order.city}
                </strong>
              </div>
            </div>
            <Link className="primary-btn" href="/orders">
              View your orders <ArrowRight size={17} />
            </Link>
          </>
        ) : (
          <>
            <h1>Order confirmation</h1>
            <p role={error ? "alert" : undefined}>
              {error ||
                (orderId && user
                  ? "Checking your order..."
                  : "Sign in to view a confirmed order.")}
            </p>
            {error && user && (
              <button
                className="outline-btn"
                onClick={() => setAttempt((value) => value + 1)}
              >
                Try again
              </button>
            )}
            <Link className="primary-btn" href={user ? "/orders" : "/auth"}>
              {user ? "Your orders" : "Sign in"}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
