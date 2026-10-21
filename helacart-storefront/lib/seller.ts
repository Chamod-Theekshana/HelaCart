import { demoCategories, demoProducts } from "./demo";
import type { Category } from "./types";

export type SellerStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
export type ProductStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN";
export type OrderStatus = "PLACED" | "ACCEPTED" | "PACKED" | "SHIPPED" | "DELIVERED" | "CANCELLED";
export type SellerAccount = {
  id: string; name: string; slug: string; status: SellerStatus;
  shippingFeeLkrMinor: number | null;
};
export type SellerMembership = { role: "OWNER" | "MANAGER"; seller: SellerAccount };
export type SellerProfile = {
  id: string; email: string; emailVerified: boolean; name: string | null;
  memberships: SellerMembership[];
};
export type SellerApplication = SellerAccount & {
  description: string | null; contactPhone: string | null; pickupAddress: string | null;
  reviews: { decision: string; reason: string | null }[];
};
export type SellerVariant = {
  id: string; position: number; sku: string; optionValues: Record<string, string>;
  priceLkrMinor: number; onHand: number; reserved: number;
};
export type SellerProduct = {
  id: string; sellerId: string; categoryId: string; title: string; slug: string;
  description: string; sku: string; imageUrls: string[]; priceLkrMinor: number;
  status: ProductStatus; category: Category; variants: SellerVariant[];
  createdAt: string; updatedAt: string;
  reviews: { decision: string; reason: string | null; createdAt: string }[];
};
export type SellerOrderRecord = {
  id: string; orderId: string; status: OrderStatus; createdAt: string;
  subtotalLkrMinor: number; shippingLkrMinor: number; totalLkrMinor: number;
  paymentCollectedAt: string | null;
  order: { id: string; recipient: string; phone: string; line1: string; line2?: string | null;
    city: string; district: string; postalCode: string; createdAt: string };
  items: { id: string; productTitle: string; sku: string; optionValues: Record<string, string>;
    quantity: number; unitLkrMinor: number; lineLkrMinor: number }[];
  events: { id: string; fromStatus: OrderStatus; toStatus: OrderStatus; createdAt: string }[];
};
export type StockMovement = { id: string; delta: number; reason: string; createdAt: string };

export function rupeesToMinor(value: string): number | null {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(minor) ? minor : null;
}

export function formatSellerDate(value: string, includeTime = false): string {
  return new Intl.DateTimeFormat("en-LK", {
    timeZone: "Asia/Colombo", year: "numeric", month: "short", day: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } as const : {}),
  }).format(new Date(value));
}

// Fixed sample timestamps keep server and browser previews identical.
const previewUpdatedAt = "2026-10-20T06:30:00.000Z";
const previewCreatedAt = (index: number) => new Date(Date.parse(previewUpdatedAt) - (index + 1) * 86400000).toISOString();

export const previewSeller: SellerAccount = {
  id: "preview-seller", name: "HelaCraft Studio", slug: "helacraft-studio",
  status: "APPROVED", shippingFeeLkrMinor: 35000,
};
export const previewProducts: SellerProduct[] = demoProducts.slice(0, 6).map((item, index) => ({
  id: item.id, sellerId: previewSeller.id, categoryId: demoCategories[index % demoCategories.length].id,
  title: item.title, slug: item.slug ?? item.id, description: item.description ?? "",
  sku: `HC-${100 + index}`, imageUrls: item.imageUrls, priceLkrMinor: item.priceLkrMinor,
  status: (["APPROVED", "APPROVED", "PENDING", "DRAFT", "APPROVED", "REJECTED"] as const)[index],
  category: demoCategories[index % demoCategories.length],
  variants: [{ id: `preview-stock-${index}`, position: 0, sku: `HC-${100 + index}`,
    optionValues: {}, priceLkrMinor: item.priceLkrMinor, onHand: [21, 4, 12, 0, 8, 2][index], reserved: 0 }],
  createdAt: previewCreatedAt(index), updatedAt: previewUpdatedAt, reviews: [],
}));
export const previewOrders: SellerOrderRecord[] = ["PLACED", "ACCEPTED", "PACKED", "DELIVERED"].map((status, index) => ({
  id: `preview-order-${index}`, orderId: `preview-order-${index}`, status: status as OrderStatus,
  createdAt: previewCreatedAt(index),
  subtotalLkrMinor: previewProducts[index].priceLkrMinor, shippingLkrMinor: 35000,
  totalLkrMinor: previewProducts[index].priceLkrMinor + 35000,
  paymentCollectedAt: status === "DELIVERED" ? previewUpdatedAt : null,
  order: { id: `preview-order-${index}`, recipient: ["Nimal Perera", "Kavindi Silva", "Ashan Fernando", "Dinithi Jayasinghe"][index],
    phone: "077 000 0000", line1: "Sample delivery address", city: "Colombo", district: "Colombo", postalCode: "00100",
    createdAt: previewCreatedAt(index) },
  items: [{ id: `preview-item-${index}`, productTitle: previewProducts[index].title,
    sku: previewProducts[index].sku, optionValues: {}, quantity: 1,
    unitLkrMinor: previewProducts[index].priceLkrMinor, lineLkrMinor: previewProducts[index].priceLkrMinor }],
  events: [],
}));
