import {
  previewOrders,
  previewProducts,
  type SellerProduct,
  type SellerVariant,
} from "./seller";
import {
  previewApplications,
  previewAdminProducts,
  previewAdminOrders,
  previewAdminReturns,
  previewAdminCod,
} from "./admin";
import type { Category, OrderItem } from "./types";
export type SellerSummary = {
  productCounts: Record<string, number>;
  orderCounts: Record<string, number>;
  totalProducts: number;
  totalOrders: number;
  activeOrders: number;
  variants: number;
  onHand: number;
  reserved: number;
  lowStock: number;
  outOfStock: number;
  lowStockProducts: number;
  categories: Category[];
};
export type BuyerSummary = {
  orders: number;
  activeSellerOrders: number;
  addresses: number;
  unreadNotifications: number;
  returns: number;
};
export type AdminSummary = {
  pendingApplications: number;
  pendingProducts: number;
  pendingReturns: number;
  unreconciledCollections: number;
  orders: number;
  openReviewReports: number;
  orderStatusCounts: Record<string, number>;
};
export type InventoryEntry = {
  product: Pick<SellerProduct, "id" | "title" | "status" | "imageUrls">;
  variant: SellerVariant;
};
export type BuyerReturn = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "RESOLVED";
  reason: string;
  reviewReason: string | null;
  resolutionNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  resolvedAt: string | null;
  sellerOrder: {
    id: string;
    orderId: string;
    sellerId: string;
    seller: { id: string; name: string; slug: string };
    items: OrderItem[];
  };
};
export const queryString = (
  values: Record<string, string | number | boolean | undefined>,
) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== "" && value !== "ALL")
      query.set(key, String(value));
  return query.toString();
};
export const previewInventory: InventoryEntry[] = previewProducts.flatMap(
  (product) => product.variants.map((variant) => ({ product, variant })),
);
export const previewSellerSummary: SellerSummary = {
  productCounts: Object.fromEntries(
    ["APPROVED", "PENDING", "DRAFT", "REJECTED", "HIDDEN"].map((status) => [
      status,
      previewProducts.filter((row) => row.status === status).length,
    ]),
  ),
  orderCounts: Object.fromEntries(
    ["PLACED", "ACCEPTED", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED"].map(
      (status) => [
        status,
        previewOrders.filter((row) => row.status === status).length,
      ],
    ),
  ),
  totalProducts: previewProducts.length,
  totalOrders: previewOrders.length,
  activeOrders: previewOrders.filter(
    (row) => !["DELIVERED", "CANCELLED"].includes(row.status),
  ).length,
  variants: previewInventory.length,
  onHand: previewInventory.reduce((sum, row) => sum + row.variant.onHand, 0),
  reserved: previewInventory.reduce(
    (sum, row) => sum + row.variant.reserved,
    0,
  ),
  lowStock: previewInventory.filter(
    (row) => row.variant.onHand - row.variant.reserved <= 5,
  ).length,
  outOfStock: previewInventory.filter(
    (row) => row.variant.onHand - row.variant.reserved <= 0,
  ).length,
  lowStockProducts: previewProducts.filter((row) =>
    row.variants.some((variant) => variant.onHand - variant.reserved <= 5),
  ).length,
  categories: [
    ...new Map(
      previewProducts.map((row) => [row.category.id, row.category]),
    ).values(),
  ],
};
export const previewAdminSummary: AdminSummary = {
  pendingApplications: previewApplications.length,
  pendingProducts: previewAdminProducts.length,
  pendingReturns: previewAdminReturns.length,
  unreconciledCollections: previewAdminCod.length,
  orders: previewAdminOrders.length,
  openReviewReports: 0,
  orderStatusCounts: Object.fromEntries(
    ["PLACED", "SHIPPED", "DELIVERED"].map((status) => [
      status,
      previewAdminOrders
        .flatMap((row) => row.sellerOrders)
        .filter((row) => row.status === status).length,
    ]),
  ),
};
