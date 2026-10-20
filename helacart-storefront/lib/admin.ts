import type { SellerProduct } from "@/lib/seller";

export type AdminSellerStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
export type AdminApplication = {
  id: string; name: string; slug: string; status: AdminSellerStatus;
  description: string | null; contactPhone: string | null; pickupAddress: string | null;
  createdAt: string; updatedAt: string;
  members: { user: { id: string; email: string; emailVerified: boolean } }[];
  reviews: { decision: string; reason: string | null; createdAt: string }[];
};
export type AdminProduct = SellerProduct & { seller: { id: string; name: string; slug: string } };
export type AdminCategory = { id: string; name: string; slug: string };
export type AdminOrder = {
  id: string; recipient: string; phone: string; line1: string; line2: string | null;
  city: string; district: string; postalCode: string; createdAt: string;
  totalLkrMinor: number; subtotalLkrMinor: number; buyerId: string;
  sellerOrders: {
    id: string; status: string; subtotalLkrMinor: number; shippingLkrMinor: number;
    totalLkrMinor: number; paymentCollectedAt: string | null;
    seller: { id: string; name: string; slug: string };
    items: { id: string; productTitle: string; sku: string; quantity: number; unitLkrMinor: number; lineLkrMinor: number }[];
    events: { id: string; fromStatus: string; toStatus: string; createdAt: string }[];
  }[];
};
export type AdminReturn = {
  id: string; status: "PENDING" | "APPROVED" | "REJECTED" | "RESOLVED";
  reason: string; reviewReason: string | null; resolutionNote: string | null;
  createdAt: string; reviewedAt: string | null; resolvedAt: string | null; buyerId: string;
  sellerOrder: { id: string; orderId: string; sellerId: string; items: AdminOrder["sellerOrders"][number]["items"] };
};
export type AdminCod = {
  id: string; sellerId: string; totalLkrMinor: number; paymentCollectedAt: string;
  codReconciliations: { id: string; decision: "RECONCILED" | "DISPUTED"; amountReceivedMinor: number; reference: string; note: string | null; createdAt: string }[];
};
export const dateTime = (value: string | null | undefined) => value ? new Date(value).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo" }) : "—";
export const shortId = (value: string) => value.length > 12 ? `#${value.slice(0, 8)}` : `#${value}`;

const seller: AdminApplication = {
  id: "sample-seller-1", name: "Ceylon Handcrafts & Spices", slug: "ceylon-handcrafts",
  status: "PENDING", description: "Handmade household goods and Ceylon spices from local makers.",
  contactPhone: "+94771234567", pickupAddress: "No. 18, Temple Road, Kandy, Sri Lanka",
  createdAt: "2026-10-18T08:30:00Z", updatedAt: "2026-10-18T08:30:00Z",
  members: [{ user: { id: "sample-user-1", email: "seller@example.com", emailVerified: true } }],
  reviews: [],
};
export const previewApplications: AdminApplication[] = [seller, {
  ...seller, id: "sample-seller-2", name: "Southern Crafts Studio", slug: "southern-crafts",
  createdAt: "2026-10-17T08:30:00Z", members: [{ user: { id: "sample-user-2", email: "crafts@example.com", emailVerified: true } }],
}];
export const previewCategories: AdminCategory[] = [
  { id: "sample-category-1", name: "Handicrafts", slug: "handicrafts" },
  { id: "sample-category-2", name: "Ceylon Spices", slug: "ceylon-spices" },
  { id: "sample-category-3", name: "Home & Living", slug: "home-living" },
];
export const previewAdminProducts: AdminProduct[] = [{
  id: "sample-product-1", sellerId: seller.id, seller: { id: seller.id, name: seller.name, slug: seller.slug },
  categoryId: previewCategories[0].id, category: previewCategories[0], title: "Handwoven Cotton Table Runner",
  slug: "handwoven-cotton-table-runner", description: "A handwoven cotton table runner made by artisans in Sri Lanka.",
  sku: "HC-TABLE-001", imageUrls: [], priceLkrMinor: 420000, status: "PENDING",
  variants: [{ id: "sample-variant-1", position: 0, sku: "HC-TABLE-001", optionValues: {}, priceLkrMinor: 420000, onHand: 18, reserved: 2 }],
  reviews: [], createdAt: "2026-10-18T10:20:00Z", updatedAt: "2026-10-18T10:20:00Z",
}];
export const previewAdminOrders: AdminOrder[] = [{
  id: "sample-order-1", recipient: "Nimal Perera", buyerId: "sample-buyer-1", phone: "0771234567",
  line1: "12 Galle Road", line2: null, city: "Colombo", district: "Colombo", postalCode: "00300",
  createdAt: "2026-10-19T06:00:00Z", subtotalLkrMinor: 420000, totalLkrMinor: 455000,
  sellerOrders: [{ id: "sample-seller-order-1", seller: { id: seller.id, name: seller.name, slug: seller.slug },
    status: "PLACED", subtotalLkrMinor: 420000, shippingLkrMinor: 35000, totalLkrMinor: 455000, paymentCollectedAt: null,
    items: [{ id: "sample-item-1", productTitle: "Handwoven Cotton Table Runner", sku: "HC-TABLE-001", quantity: 1, unitLkrMinor: 420000, lineLkrMinor: 420000 }],
    events: [] }],
}];
export const previewAdminReturns: AdminReturn[] = [{
  id: "sample-return-1", status: "PENDING", reason: "The delivered item was damaged on arrival and I would like a return reviewed.",
  reviewReason: null, resolutionNote: null, buyerId: "sample-buyer-1",
  createdAt: "2026-10-19T07:00:00Z", reviewedAt: null, resolvedAt: null,
  sellerOrder: { id: "sample-seller-order-1", orderId: "sample-order-1", sellerId: seller.id, items: previewAdminOrders[0].sellerOrders[0].items },
}];
export const previewAdminCod: AdminCod[] = [{
  id: "sample-seller-order-2", sellerId: seller.id, totalLkrMinor: 455000,
  paymentCollectedAt: "2026-10-19T09:00:00Z", codReconciliations: [],
}];
