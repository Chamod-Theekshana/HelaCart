import type {
  IdentityDocumentType,
  SellerDocument,
  SellerProduct,
} from "@/lib/seller";

export type AdminSellerStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "SUSPENDED";
export type AdminApplication = {
  isVerified: boolean;
  verifiedAt: string | null;
  verificationVersion: number;
  verificationHistory: {
    id: string;
    isVerified: boolean;
    version: number;
    reason: string;
    createdAt: string;
    reviewer: { id: string; email: string };
  }[];
  id: string;
  name: string;
  slug: string;
  status: AdminSellerStatus;
  description: string | null;
  contactPhone: string | null;
  pickupAddress: string | null;
  createdAt: string;
  updatedAt: string;
  identityDocumentType: IdentityDocumentType | null;
  documents: SellerDocument[];
  members: { user: { id: string; email: string; emailVerified: boolean } }[];
  reviews: { decision: string; reason: string | null; createdAt: string }[];
};
export type AdminProduct = SellerProduct & {
  seller: { id: string; name: string; slug: string };
  commissionRateBps?: number | null;
};
export type AdminCategory = { id: string; name: string; slug: string };
export type AdminOrder = {
  id: string;
  recipient: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  district: string;
  postalCode: string;
  createdAt: string;
  totalLkrMinor: number;
  subtotalLkrMinor: number;
  buyerId: string;
  sellerOrders: (import("./delivery").DeliveryTracking & {
    id: string;
    status: string;
    subtotalLkrMinor: number;
    shippingLkrMinor: number;
    totalLkrMinor: number;
    paymentCollectedAt: string | null;
    seller: { id: string; name: string; slug: string };
    items: {
      id: string;
      productTitle: string;
      sku: string;
      quantity: number;
      unitLkrMinor: number;
      lineLkrMinor: number;
    }[];
    events: {
      id: string;
      fromStatus: string;
      toStatus: string;
      createdAt: string;
      reason?: string | null;
      actorUserId?: string | null;
    }[];
    statusReason?: string | null;
    statusChangedAt?: string;
  })[];
};
/** Cursor-paged admin lists (§1.5, §5, §10). */
export type CursorPage<T> = { items: T[]; nextCursor: string | null };
/** Seller-order row from /admin/orders/attention and order actions (§1.5). */
export type AdminSellerOrder = {
  id: string;
  orderId?: string;
  status: string;
  statusReason?: string | null;
  statusChangedAt?: string;
  createdAt?: string;
  totalLkrMinor?: number;
  paymentCollectedAt?: string | null;
  seller?: { id: string; name: string; slug?: string };
  order?: {
    id: string;
    recipient?: string;
    phone?: string;
    city?: string;
    district?: string;
    createdAt?: string;
  };
};
export type AdminOrderAction =
  | "CANCEL"
  | "MARK_DELIVERY_FAILED"
  | "MARK_RETURNED"
  | "MARK_DELIVERED";
/** Which admin actions each seller-order status allows (§1.5). */
export const adminOrderActions: {
  action: AdminOrderAction;
  label: string;
  from: string[];
  danger?: boolean;
}[] = [
  {
    action: "MARK_DELIVERED",
    label: "Mark delivered",
    from: ["SHIPPED", "DELIVERY_FAILED"],
  },
  {
    action: "MARK_DELIVERY_FAILED",
    label: "Mark delivery failed",
    from: ["SHIPPED"],
  },
  {
    action: "MARK_RETURNED",
    label: "Mark returned to seller",
    from: ["SHIPPED", "DELIVERY_FAILED"],
  },
  {
    action: "CANCEL",
    label: "Cancel seller order",
    from: ["PLACED", "ACCEPTED", "PACKED", "SHIPPED", "DELIVERY_FAILED"],
    danger: true,
  },
];
/** Row from GET /admin/sellers (§5). */
export type AdminSellerRow = {
  id: string;
  name: string;
  slug: string;
  status: AdminSellerStatus;
  isVerified: boolean;
  createdAt: string;
  statusReason: string | null;
  productCount: number;
  openOrderCount: number;
};
/** Row from GET /admin/audit-log (§10). */
export type AuditLogEntry = {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  subjectType: string;
  subjectId: string;
  reason: string | null;
  details: unknown;
  createdAt: string;
};
export const auditActions = [
  "ORDER_CANCEL",
  "ORDER_MARK_DELIVERY_FAILED",
  "ORDER_MARK_RETURNED",
  "ORDER_MARK_DELIVERED",
  "SELLER_SUSPEND",
  "SELLER_REINSTATE",
  "PRODUCT_APPROVE",
  "PRODUCT_REJECT",
  "CATEGORY_CREATE",
  "CATEGORY_UPDATE",
  "HERO_UPDATE",
  "ACCOUNT_ACCESS_CHANGE",
  "COMMISSION_RATE_CHANGE",
];
export type AdminReturn = {
  outcome?: string | null;
  items?: import("./after-sales").ReturnCase["items"];
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "RESOLVED";
  reason: string;
  reviewReason: string | null;
  resolutionNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  resolvedAt: string | null;
  buyerId: string;
  sellerOrder: {
    id: string;
    orderId: string;
    sellerId: string;
    items: AdminOrder["sellerOrders"][number]["items"];
  };
};
export type AdminCod = {
  id: string;
  sellerId: string;
  totalLkrMinor: number;
  paymentCollectedAt: string;
  codReconciliations: {
    id: string;
    decision: "RECONCILED" | "DISPUTED";
    amountReceivedMinor: number;
    reference: string;
    note: string | null;
    createdAt: string;
  }[];
};
export const dateTime = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString("en-LK", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Colombo",
      })
    : "—";
export const shortId = (value: string) =>
  value.length > 12 ? `#${value.slice(0, 8)}` : `#${value}`;

const seller: AdminApplication = {
  isVerified: false,
  verifiedAt: null,
  verificationVersion: 0,
  verificationHistory: [],
  id: "sample-seller-1",
  name: "Ceylon Handcrafts & Spices",
  slug: "ceylon-handcrafts",
  status: "PENDING",
  description: "Handmade household goods and Ceylon spices from local makers.",
  contactPhone: "+94771234567",
  pickupAddress: "No. 18, Temple Road, Kandy, Sri Lanka",
  createdAt: "2026-10-18T08:30:00Z",
  updatedAt: "2026-10-18T08:30:00Z",
  members: [
    {
      user: {
        id: "sample-user-1",
        email: "seller@example.com",
        emailVerified: true,
      },
    },
  ],
  reviews: [],
  identityDocumentType: null,
  documents: [],
};
export const previewApplications: AdminApplication[] = [
  seller,
  {
    ...seller,
    id: "sample-seller-2",
    name: "Southern Crafts Studio",
    slug: "southern-crafts",
    createdAt: "2026-10-17T08:30:00Z",
    members: [
      {
        user: {
          id: "sample-user-2",
          email: "crafts@example.com",
          emailVerified: true,
        },
      },
    ],
  },
];
export const previewCategories: AdminCategory[] = [
  { id: "sample-category-1", name: "Handicrafts", slug: "handicrafts" },
  { id: "sample-category-2", name: "Ceylon Spices", slug: "ceylon-spices" },
  { id: "sample-category-3", name: "Home & Living", slug: "home-living" },
];
export const previewAdminProducts: AdminProduct[] = [
  {
    id: "sample-product-1",
    sellerId: seller.id,
    seller: { id: seller.id, name: seller.name, slug: seller.slug },
    categoryId: previewCategories[0].id,
    category: previewCategories[0],
    title: "Handwoven Cotton Table Runner",
    slug: "handwoven-cotton-table-runner",
    description:
      "A handwoven cotton table runner made by artisans in Sri Lanka.",
    sku: "HC-TABLE-001",
    imageUrls: [],
    priceLkrMinor: 420000,
    status: "PENDING",
    variants: [
      {
        id: "sample-variant-1",
        position: 0,
        sku: "HC-TABLE-001",
        optionValues: {},
        priceLkrMinor: 420000,
        onHand: 18,
        reserved: 2,
      },
    ],
    reviews: [],
    createdAt: "2026-10-18T10:20:00Z",
    updatedAt: "2026-10-18T10:20:00Z",
  },
];
export const previewAdminOrders: AdminOrder[] = [
  {
    id: "sample-order-1",
    recipient: "Nimal Perera",
    buyerId: "sample-buyer-1",
    phone: "0771234567",
    line1: "12 Galle Road",
    line2: null,
    city: "Colombo",
    district: "Colombo",
    postalCode: "00300",
    createdAt: "2026-10-19T06:00:00Z",
    subtotalLkrMinor: 420000,
    totalLkrMinor: 455000,
    sellerOrders: [
      {
        id: "sample-seller-order-1",
        seller: { id: seller.id, name: seller.name, slug: seller.slug },
        status: "PLACED",
        subtotalLkrMinor: 420000,
        shippingLkrMinor: 35000,
        totalLkrMinor: 455000,
        paymentCollectedAt: null,
        statusReason: null,
        statusChangedAt: "2026-10-19T06:00:00Z",
        items: [
          {
            id: "sample-item-1",
            productTitle: "Handwoven Cotton Table Runner",
            sku: "HC-TABLE-001",
            quantity: 1,
            unitLkrMinor: 420000,
            lineLkrMinor: 420000,
          },
        ],
        events: [],
      },
    ],
  },
  {
    id: "sample-order-2",
    recipient: "Ishara Fernando",
    buyerId: "sample-buyer-2",
    phone: "0712345678",
    line1: "5 Peradeniya Road",
    line2: null,
    city: "Kandy",
    district: "Kandy",
    postalCode: "20000",
    createdAt: "2026-10-15T04:00:00Z",
    subtotalLkrMinor: 290000,
    totalLkrMinor: 325000,
    sellerOrders: [
      {
        id: "sample-seller-order-3",
        seller: { id: seller.id, name: seller.name, slug: seller.slug },
        status: "DELIVERY_FAILED",
        subtotalLkrMinor: 290000,
        shippingLkrMinor: 35000,
        totalLkrMinor: 325000,
        paymentCollectedAt: null,
        statusReason: "Customer unreachable by phone",
        statusChangedAt: "2026-10-18T09:30:00Z",
        items: [
          {
            id: "sample-item-3",
            productTitle: "Ceylon Cinnamon Gift Box",
            sku: "HC-SPICE-004",
            quantity: 1,
            unitLkrMinor: 290000,
            lineLkrMinor: 290000,
          },
        ],
        events: [
          {
            id: "sample-event-1",
            fromStatus: "PACKED",
            toStatus: "SHIPPED",
            createdAt: "2026-10-16T08:00:00Z",
            reason: null,
          },
          {
            id: "sample-event-2",
            fromStatus: "SHIPPED",
            toStatus: "DELIVERY_FAILED",
            createdAt: "2026-10-18T09:30:00Z",
            reason: "Customer unreachable by phone",
          },
        ],
      },
    ],
  },
];
export const previewAttention: AdminSellerOrder[] = [
  {
    id: "sample-seller-order-3",
    orderId: "sample-order-2",
    status: "DELIVERY_FAILED",
    statusReason: "Customer unreachable by phone",
    statusChangedAt: "2026-10-18T09:30:00Z",
    createdAt: "2026-10-15T04:00:00Z",
    totalLkrMinor: 325000,
    paymentCollectedAt: null,
    seller: { id: seller.id, name: seller.name, slug: seller.slug },
    order: {
      id: "sample-order-2",
      recipient: "Ishara Fernando",
      city: "Kandy",
      district: "Kandy",
      createdAt: "2026-10-15T04:00:00Z",
    },
  },
];
export const previewAdminSellers: AdminSellerRow[] = [
  {
    id: "sample-seller-3",
    name: "Colombo Tech Hub",
    slug: "colombo-tech-hub",
    status: "APPROVED",
    isVerified: true,
    createdAt: "2026-07-01T00:00:00Z",
    statusReason: null,
    productCount: 18,
    openOrderCount: 3,
  },
  {
    id: "sample-seller-4",
    name: "Island Audio",
    slug: "island-audio",
    status: "SUSPENDED",
    isVerified: false,
    createdAt: "2026-08-12T00:00:00Z",
    statusReason: "Repeated cancellations of accepted COD orders",
    productCount: 6,
    openOrderCount: 1,
  },
];
export const previewAuditLog: AuditLogEntry[] = [
  {
    id: "sample-audit-1",
    actorId: "sample-admin",
    actorEmail: "admin@example.com",
    action: "SELLER_SUSPEND",
    subjectType: "Seller",
    subjectId: "sample-seller-4",
    reason: "Repeated cancellations of accepted COD orders",
    details: { from: "APPROVED", to: "SUSPENDED" },
    createdAt: "2026-10-20T05:30:00Z",
  },
  {
    id: "sample-audit-2",
    actorId: "sample-admin",
    actorEmail: "admin@example.com",
    action: "PRODUCT_APPROVE",
    subjectType: "Product",
    subjectId: "sample-product-1",
    reason: null,
    details: { commissionRateBps: 1000 },
    createdAt: "2026-10-19T11:00:00Z",
  },
];
export const previewAdminReturns: AdminReturn[] = [
  {
    id: "sample-return-1",
    status: "PENDING",
    reason:
      "The delivered item was damaged on arrival and I would like a return reviewed.",
    reviewReason: null,
    resolutionNote: null,
    buyerId: "sample-buyer-1",
    createdAt: "2026-10-19T07:00:00Z",
    reviewedAt: null,
    resolvedAt: null,
    sellerOrder: {
      id: "sample-seller-order-1",
      orderId: "sample-order-1",
      sellerId: seller.id,
      items: previewAdminOrders[0].sellerOrders[0].items,
    },
  },
];
export const previewAdminCod: AdminCod[] = [
  {
    id: "sample-seller-order-2",
    sellerId: seller.id,
    totalLkrMinor: 455000,
    paymentCollectedAt: "2026-10-19T09:00:00Z",
    codReconciliations: [],
  },
];
