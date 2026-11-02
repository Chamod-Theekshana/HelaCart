import type { MessageKey, Translate } from "./i18n";
import type { SellerOrderStatus } from "./types";

export const sellerOrderStatuses: SellerOrderStatus[] = [
  "PLACED",
  "ACCEPTED",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "DELIVERY_FAILED",
  "RETURNED_TO_SELLER",
];
/** The happy-path fulfilment steps shown as a progress bar. */
export const fulfilmentSteps: SellerOrderStatus[] = [
  "PLACED",
  "ACCEPTED",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
];
/** Statuses where the seller order is finished (no money is due any more). */
export const closedStatuses = ["DELIVERED", "CANCELLED", "RETURNED_TO_SELLER"];

/** Translated label for a seller-order status (falls back to readable text). */
export function orderStatusLabel(t: Translate, status: string) {
  return (sellerOrderStatuses as string[]).includes(status)
    ? t(`status.${status}` as MessageKey)
    : status.toLowerCase().replaceAll("_", " ");
}
/** Index on the progress bar; a failed delivery stays at the shipped step. */
export function progressIndex(status: string) {
  return fulfilmentSteps.indexOf(
    (status === "DELIVERY_FAILED" ? "SHIPPED" : status) as SellerOrderStatus,
  );
}
