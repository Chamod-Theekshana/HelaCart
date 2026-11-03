import type { Page } from "./shops";

export type FinanceRequest = <T>(
  path: string,
  method?: string,
  body?: unknown,
) => Promise<T>;
export type CommissionPolicy = {
  mode?: "PRODUCT";
  enabled?: boolean; // Legacy policy history only.
  rateBps?: number; // Legacy policy history only.
  paymentDays: number;
  returnDays: number;
  bankName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  instructions: string | null;
  version?: number;
  updatedAt?: string;
};
export type CommissionBalance = {
  id: string;
  name: string;
  slug: string;
  status: string;
  chargedMinor: number;
  creditedMinor: number;
  paidMinor: number;
  balanceMinor: number;
  outstandingMinor: number;
  payableMinor: number;
  availableToSubmitMinor: number;
  heldMinor: number;
  overdueMinor: number;
  pendingMinor: number;
  creditBalanceMinor: number;
};
export type CommissionPayment = {
  correction?: {
    id: string;
    amountMinor: number;
    reason: string;
    reference: string;
    createdAt: string;
  } | null;
  id: string;
  sellerId: string;
  amountMinor: number;
  reference: string;
  paidOn: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  note: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  seller?: { name: string; slug: string };
};
export type CommissionCharge = {
  supportOnHold?:boolean;
  orderItem?: { productTitle: string; sku: string } | null;
  manualOnHold?: boolean;
  holdVersion?: number;
  holds?: {
    id: string;
    version: number;
    held: boolean;
    reason: string;
    createdAt: string;
  }[];
  refunds?: {
    id: string;
    baseMinor: number;
    creditMinor: number;
    reference: string;
    reason: string;
    createdAt: string;
    correction?: {
      amountMinor: number;
      baseMinor: number;
      reason: string;
      createdAt: string;
    } | null;
  }[];
  id: string;
  sellerOrderId: string;
  baseMinor: number;
  rateBps: number;
  amountMinor: number;
  holdUntil: string;
  dueAt: string;
  createdAt: string;
  refundedBaseMinor: number;
  creditedMinor: number;
  returnOnHold: boolean;
};
export type CommissionStatement = Page<{
  id: string;
  kind: "CHARGE" | "REFUND_CREDIT" | "PAYMENT" | "ADJUSTMENT";
  reference: string;
  amountMinor: number;
  createdAt: string;
  dueAt: string | null;
  note: string | null;
}> & {
  month: string;
  openingMinor: number;
  closingMinor: number;
  generatedAt: string;
  currency: "LKR";
};
export type CommissionHistory = {
  id: string;
  version: number;
  reason: string;
  createdAt: string;
  actor: { email: string };
  after: CommissionPolicy;
};
export const currentMonth = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
export const localToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const rateLabel = (bps: number) =>
  `${(bps / 100).toFixed(2).replace(/\.?0+$/, "")}%`;
export function emptyPage<T>(items: T[] = []): Page<T> {
  return { items, total: items.length, page: 1, pageSize: 20, pages: 1 };
}
export const previewPolicy: CommissionPolicy = {
  mode: "PRODUCT",
  paymentDays: 14,
  returnDays: 14,
  bankName: "Example bank — design preview",
  accountName: "HelaCart — sample only",
  accountNumber: "Preview account",
  instructions: "Sample bank details. Do not send money using preview data.",
  version: 1,
};
export const previewBalance: CommissionBalance = {
  id: "preview-seller",
  name: "HelaCraft Studio",
  slug: "helacraft-studio",
  status: "APPROVED",
  chargedMinor: 125000,
  creditedMinor: 5000,
  paidMinor: 40000,
  balanceMinor: 80000,
  outstandingMinor: 80000,
  payableMinor: 60000,
  availableToSubmitMinor: 40000,
  heldMinor: 20000,
  overdueMinor: 20000,
  pendingMinor: 20000,
  creditBalanceMinor: 0,
};
export const previewPayments: CommissionPayment[] = [
  {
    id: "preview-payment",
    sellerId: "preview-seller",
    amountMinor: 20000,
    reference: "SAMPLE-TRANSFER",
    paidOn: "2026-10-24",
    status: "PENDING",
    note: "Example payment for review",
    reviewNote: null,
    reviewedAt: null,
    createdAt: "2026-10-24T08:00:00Z",
    seller: { name: "HelaCraft Studio", slug: "helacraft-studio" },
  },
];
export const previewCharges: CommissionCharge[] = [
  {
    id: "preview-charge",
    sellerOrderId: "sample-order",
    baseMinor: 1000000,
    rateBps: 500,
    amountMinor: 50000,
    holdUntil: "2026-10-20T08:00:00Z",
    dueAt: "2026-11-03T08:00:00Z",
    createdAt: "2026-10-06T08:00:00Z",
    refundedBaseMinor: 0,
    creditedMinor: 0,
    returnOnHold: false,
  },
];
export const previewStatement: CommissionStatement = {
  ...emptyPage([
    {
      id: "sample-entry",
      kind: "CHARGE" as const,
      reference: "sample-order",
      amountMinor: 50000,
      createdAt: "2026-10-06T08:00:00Z",
      dueAt: "2026-11-03T08:00:00Z",
      note: null,
    },
  ]),
  month: "2026-10",
  openingMinor: 30000,
  closingMinor: 80000,
  generatedAt: "2026-10-25T08:00:00Z",
  currency: "LKR",
};
