"use client";
import { Truck } from "lucide-react";
import { deliveryDate, type DeliveryTracking } from "@/lib/delivery";
import styles from "./delivery-workspace.module.css";
export function ShipmentTracking({ order }: { order: DeliveryTracking }) {
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
    return <p className={styles.muted}>Delivery cancelled.</p>;
  return (
    <section className={styles.tracking} aria-label="Delivery tracking">
      <div className={styles.heading}>
        <Truck size={18} />
        <strong>Delivery tracking</strong>
      </div>
      {shipment ? (
        <>
          <p>
            <strong>{shipment.courierName}</strong>
            <br />
            {shipment.trackingNumber ? (
              <span>
                Tracking reference:{" "}
                <b className={styles.reference}>{shipment.trackingNumber}</b>
              </span>
            ) : (
              <span>Delivery status is updated by your shop.</span>
            )}
          </p>
          <p className={styles.muted}>
            Dispatched {deliveryDate(shipment.shippedAt)}
            {range && order.status !== "DELIVERED" && (
              <>
                {" "}
                · Estimated arrival {deliveryDate(range.from)}–
                {deliveryDate(range.to)}
              </>
            )}
            {order.status === "DELIVERED" && " · Delivered"}
          </p>
        </>
      ) : (
        <p className={styles.muted}>
          {order.status === "SHIPPED"
            ? "Your order has shipped. The shop has not added a tracking reference yet."
            : order.status === "DELIVERED"
              ? "The shop marked this delivery complete."
              : "Tracking details appear when your shop dispatches the order."}
          {order.deliveryMinDays &&
            order.deliveryMaxDays &&
            order.status !== "DELIVERED" && (
              <>
                {" "}
                Estimated {order.deliveryMinDays}–{order.deliveryMaxDays}{" "}
                calendar days after dispatch.
              </>
            )}
        </p>
      )}
      {!!order.events?.length && (
        <details>
          <summary>View delivery progress</summary>
          <ol className={styles.timeline}>
            {order.events.map((event) => (
              <li key={event.id}>
                <strong>
                  {event.toStatus.toLowerCase().replaceAll("_", " ")}
                </strong>
                <span>
                  {deliveryDate(event.createdAt)} ·{" "}
                  {new Intl.DateTimeFormat("en-LK", {
                    timeZone: "Asia/Colombo",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(event.createdAt))}
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
