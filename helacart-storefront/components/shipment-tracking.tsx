"use client";
import { Truck } from "lucide-react";
import { deliveryDate, type DeliveryTracking } from "@/lib/delivery";
import styles from "./delivery-workspace.module.css";
import { useLanguage } from "./language-provider";
import { orderStatusLabel } from "@/lib/order-status";
export function ShipmentTracking({ order }: { order: DeliveryTracking }) {
  const { t, dateLocale } = useLanguage();
  const shipment = order.shipment;
  const range =
    shipment && order.deliveryMinDays && order.deliveryMaxDays
      ? {
          from: new Date(
            new Date(shipment.shippedAt).getTime() +
              order.deliveryMinDays * 86400000,
          ).toISOString(),
          to: new Date(
            new Date(shipment.shippedAt).getTime() +
              order.deliveryMaxDays * 86400000,
          ).toISOString(),
        }
      : null;
  if (order.status === "CANCELLED")
    return <p className={styles.muted}>{t("tracking.cancelled")}</p>;
  if (order.status === "RETURNED_TO_SELLER")
    return <p className={styles.muted}>{t("tracking.returned")}</p>;
  return (
    <section className={styles.tracking} aria-label={t("tracking.title")}>
      <div className={styles.heading}>
        <Truck size={18} />
        <strong>{t("tracking.title")}</strong>
      </div>
      {shipment ? (
        <>
          <p>
            <strong>{shipment.courierName}</strong>
            <br />
            {shipment.trackingNumber ? (
              <span>
                {t("tracking.reference")}{" "}
                <b className={styles.reference}>{shipment.trackingNumber}</b>
              </span>
            ) : (
              <span>{t("tracking.byShop")}</span>
            )}
          </p>
          <p className={styles.muted}>
            {t("tracking.dispatched", {
              date: deliveryDate(shipment.shippedAt),
            })}
            {range && order.status === "SHIPPED" && (
              <>
                {" "}
                ·{" "}
                {t("tracking.estimated", {
                  from: deliveryDate(range.from),
                  to: deliveryDate(range.to),
                })}
              </>
            )}
            {order.status === "DELIVERED" && ` · ${t("status.DELIVERED")}`}
            {order.status === "DELIVERY_FAILED" &&
              ` · ${t("status.DELIVERY_FAILED")}`}
          </p>
        </>
      ) : (
        <p className={styles.muted}>
          {order.status === "SHIPPED"
            ? t("tracking.shippedNoRef")
            : order.status === "DELIVERED"
              ? t("tracking.delivered")
              : order.status === "DELIVERY_FAILED"
                ? t("orders.deliveryFailed")
                : t("tracking.pending")}
          {order.deliveryMinDays &&
            order.deliveryMaxDays &&
            !["DELIVERED", "DELIVERY_FAILED"].includes(order.status) && (
              <>
                {" "}
                {t("checkout.estimateDays", {
                  min: order.deliveryMinDays,
                  max: order.deliveryMaxDays,
                })}
              </>
            )}
        </p>
      )}
      {!!order.events?.length && (
        <details>
          <summary>{t("tracking.progress")}</summary>
          <ol className={styles.timeline}>
            {order.events.map((event) => (
              <li key={event.id}>
                <strong>{orderStatusLabel(t, event.toStatus)}</strong>
                <span>
                  {deliveryDate(event.createdAt)} ·{" "}
                  {new Intl.DateTimeFormat(dateLocale, {
                    timeZone: "Asia/Colombo",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(event.createdAt))}
                </span>
                {event.reason && <small>{event.reason}</small>}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
