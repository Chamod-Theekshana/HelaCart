import { useCallback } from "react";
import { api } from "./api";
import { useShop } from "@/components/shop-provider";
export type ToolRequest = <T>(
  path: string,
  method?: string,
  body?: unknown,
) => Promise<T>;
export type BulkKind =
  | "STOCK_SET"
  | "PRODUCT_SUBMIT"
  | "PRODUCT_HIDE"
  | "PRODUCT_APPROVE"
  | "PRODUCT_REJECT";
export type BulkRow = {
  id: string;
  title: string;
  sku: string;
  before: number | string;
  after: number | string;
  reserved?: number;
  delta?: number;
  row?: number;
  error?: string;
};
export type BulkJob = {
  id: string;
  kind: BulkKind;
  reason: string;
  status: "PREVIEW" | "APPLIED";
  expiresAt: string;
  createdAt: string;
  appliedAt: string | null;
  preview: { valid: boolean; rows: BulkRow[] };
};
export type BulkHistory = Omit<BulkJob, "preview">;
export type StockAlert = {
  id: string;
  productId: string;
  title: string;
  sku: string;
  status: string;
  onHand: number;
  reserved: number;
  available: number;
  threshold: number;
  enabled: boolean;
  version: number;
};
export type DailyBusiness = {
  day: string;
  deliveredOrders: number;
  units: number;
  grossMerchandiseMinor: number;
  shippingMinor: number;
  codMinor: number;
  refundMerchandiseMinor: number;
  refundShippingMinor: number;
  netMerchandiseMinor: number;
  commissionAccruedMinor: number;
  commissionCollectedMinor: number;
};
export type BusinessReport = {
  from: string;
  to: string;
  generatedAt: string;
  timeZone: string;
  sellerId: string | null;
  totals: Omit<DailyBusiness, "day">;
  daily: DailyBusiness[];
  orderStatuses: { status: string; count: number }[];
  customerCare: { returnsOpened: number; supportOpened: number };
  inventory: {
    variants: number;
    onHand: number;
    reserved: number;
    available: number;
    low: number;
    out: number;
  };
  products: {
    id: string;
    title: string;
    sku: string;
    units: number;
    orders: number;
    merchandiseMinor: number;
  }[];
  shops: {
    id: string;
    name: string;
    orders: number;
    merchandiseMinor: number;
    shippingMinor: number;
  }[];
};
export function useBusinessDownload() {
  const { user, isPreview } = useShop();
  return useCallback(
    async (path: string, filename: string) => {
      if (isPreview || !user)
        throw Error("Connect the API and sign in to download business data");
      const csv = await api<string>(path, {
        token: await user.getIdToken(),
        responseType: "text",
      });
      const url = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    [user, isPreview],
  );
}
export function colomboDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function defaultReportDates() {
  const to = colomboDay();
  return {
    to,
    from: new Date(Date.parse(to + "T00:00:00Z") - 29 * 86400000)
      .toISOString()
      .slice(0, 10),
  };
}
