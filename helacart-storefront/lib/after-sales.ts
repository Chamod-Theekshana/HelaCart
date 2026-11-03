export type SupportCase = {
  id: string;
  title: string;
  category: string;
  status: string;
  version: number;
  financeHold: boolean;
  resolution: string | null;
  sellerOrderId: string | null;
  createdAt: string;
  updatedAt: string;
  seller: { name: string } | null;
  opener: { name: string | null };
  sellerOrder: { orderId: string; status: string } | null;
  events?: {
    id: string;
    fromStatus: string;
    toStatus: string;
    financeHold: boolean;
    reason: string;
    createdAt: string;
  }[];
};
export type CaseMessage = {
  id: string;
  body: string;
  authorRole: string;
  createdAt: string;
  author: { name: string | null };
};
export type RefundRecord = {
  id: string;
  sellerId: string;
  returnItemId: string;
  merchandiseMinor: number;
  shippingMinor: number;
  amountMinor: number;
  method: string;
  reference: string;
  paidOn: string;
  note: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  reversal?: {
    id: string;
    reason: string;
    reference: string;
    createdAt: string;
  } | null;
  returnItem: {
    quantity: number;
    baseMinor: number;
    orderItem: { productTitle: string; sku: string };
    returnRequest: {
      id: string;
      sellerOrder: { id: string; orderId: string; seller: { name: string } };
    };
  };
};
export type ReturnCase = {
  remainingShippingMinor?: number;
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "RESOLVED";
  reason: string;
  reviewReason: string | null;
  resolutionNote: string | null;
  outcome: string | null;
  createdAt: string;
  reviewedAt: string | null;
  resolvedAt: string | null;
  sellerOrder: {
    id: string;
    orderId: string;
    status: string;
    shippingLkrMinor: number;
    seller: { name: string };
  };
  items: {
    id: string;
    orderItemId: string;
    quantity: number;
    baseMinor: number;
    orderItem: { productTitle: string; sku: string };
    refunds: RefundRecord[];
  }[];
};
export type ReturnOptions = {
  sellerOrderId: string;
  eligible: boolean;
  closesAt: string | null;
  items: {
    orderItemId: string;
    productTitle: string;
    sku: string;
    quantity: number;
    unitMinor: number;
    remainingQuantity: number;
  }[];
};
export const supportStatuses = [
  "OPEN",
  "UNDER_REVIEW",
  "WAITING_BUYER",
  "WAITING_SELLER",
  "RESOLVED",
  "CLOSED",
];
export const supportCategories = [
  "ORDER_ISSUE",
  "DELIVERY",
  "RETURN",
  "REFUND",
  "ACCOUNT",
  "OTHER",
];
export const effectiveRefunds = (records: RefundRecord[]) =>
  records.filter((r) => r.status !== "REJECTED" && !r.reversal);
