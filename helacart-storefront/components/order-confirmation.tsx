"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { errorMessage, money, userApi } from "@/lib/api";
import type { Order } from "@/lib/types";
import { useShop } from "./shop-provider";
import { useT } from "./language-provider";
import { SignInLink } from "./sign-in-link";

export function OrderConfirmation({ orderId }: { orderId: string }) {
  const { user } = useShop();
  const t = useT();
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
    userApi<Order>(user, `/me/orders/${encodeURIComponent(orderId)}`)
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
      .filter(
        (part) =>
          !["CANCELLED", "DELIVERED", "RETURNED_TO_SELLER"].includes(
            part.status,
          ),
      )
      .reduce((sum, part) => sum + part.totalLkrMinor, 0) ?? 0;
  return (
    <div className="container success-page">
      <div className="panel success-card">
        {order ? (
          <>
            <CheckCircle2 size={57} />
            <span className="section-kicker">{t("success.kicker")}</span>
            <h1>{t("success.title")}</h1>
            <p>{t("success.text")}</p>
            <div className="success-meta">
              <div>
                <span>{t("success.orderNumber")}</span>
                <strong>#{order.id.slice(0, 8).toUpperCase()}</strong>
              </div>
              <div>
                <span>{t("success.due")}</span>
                <strong>{money(due)}</strong>
                {due !== order.totalLkrMinor && (
                  <small>
                    {t("success.originalTotal", {
                      total: money(order.totalLkrMinor),
                    })}
                  </small>
                )}
              </div>
              <div>
                <span>{t("success.address")}</span>
                <strong>
                  {order.line1}, {order.city}
                </strong>
              </div>
            </div>
            <Link className="primary-btn" href="/orders">
              {t("success.viewOrders")} <ArrowRight size={17} />
            </Link>
          </>
        ) : (
          <>
            <h1>{t("success.confirmation")}</h1>
            <p role={error ? "alert" : undefined}>
              {error ||
                (orderId && user ? t("success.checking") : t("success.signIn"))}
            </p>
            {error && user && (
              <button
                className="outline-btn"
                onClick={() => setAttempt((value) => value + 1)}
              >
                {t("common.tryAgain")}
              </button>
            )}
            {user ? (
              <Link className="primary-btn" href="/orders">
                {t("success.yourOrders")}
              </Link>
            ) : (
              <SignInLink className="primary-btn">
                {t("auth.signIn")}
              </SignInLink>
            )}
          </>
        )}
      </div>
    </div>
  );
}
