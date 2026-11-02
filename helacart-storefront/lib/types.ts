export type Category = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
};
export type Variant = {
  originalPriceLkrMinor?: number;
  id: string;
  sku: string;
  optionValues: Record<string, string>;
  priceLkrMinor: number;
  availableQuantity: number;
};
export type Product = {
  originalPriceLkrMinor?: number;
  promotion?: { id: string; name: string; discountBps: number; endsAt: string };
  brand?: string | null;
  warranty?: string | null;
  specifications?: { name: string; value: string }[];
  id: string;
  title: string;
  slug?: string;
  description: string | null;
  imageUrls: string[];
  priceLkrMinor: number;
  listingPriceLkrMinor?: number;
  category: Category;
  seller: { id?: string; name: string; slug?: string };
  variants: Variant[];
};
export type ProductPage = { items: Product[]; nextCursor: string | null };
export type CartItem = {
  originalPriceLkrMinor?: number;
  variantId: string;
  productId: string;
  sellerId: string;
  title: string;
  sku: string;
  optionValues: Record<string, string>;
  priceLkrMinor: number;
  quantity: number;
  availableQuantity: number;
  available: boolean;
  shippingConfigured: boolean;
  sellerName?: string;
  sellerSlug?: string;
  imageUrl?: string | null;
  shippingFeeLkrMinor?: number | null;
};
export type Cart = {
  items: CartItem[];
  subtotalLkrMinor: number;
  shippingLkrMinor: number;
  totalLkrMinor: number;
  canCheckout: boolean;
  checkoutQuote?: string;
  addressId?: string | null;
  deliveryQuoted?: boolean;
  deliveryBySeller?: import("./delivery").DeliveryQuote[];
  /** Checkout error codes already known before checkout (API §3.2). */
  checkoutBlockers?: CheckoutBlocker[];
};
/** Machine-readable checkout failure codes (API contract §3.2). */
export type CheckoutBlocker =
  | "PHONE_NOT_VERIFIED"
  | "TOO_MANY_OPEN_ORDERS"
  | "COD_LIMIT_EXCEEDED"
  | "SELLER_SUSPENDED"
  | (string & {});
/** A guest cart line kept in localStorage before sign-in. */
export type GuestCartLine = {
  productId: string;
  variantId: string;
  quantity: number;
};
export type Address = {
  id: string;
  recipient: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  district: string;
  postalCode: string;
  /** The address phone has been verified by this user via SMS OTP (§3.1). */
  phoneVerified?: boolean;
  isDefault?: boolean;
};
export type AddressInput = Pick<
  Address,
  "recipient" | "phone" | "line1" | "city" | "district" | "postalCode"
> & { line2?: string | null };
/** Body for PATCH /me/addresses/:addressId (§4). */
export type AddressPatch = Partial<AddressInput> & { isDefault?: boolean };
export type PhoneVerification = {
  verificationId: string;
  phone: string;
  expiresAt: string;
  resendAfter: string;
};
export type VerifiedPhone = { phone: string; verifiedAt: string };
export type NotificationPreferences = {
  push: boolean;
  email: boolean;
  sms: boolean;
};
/** Seller-order statuses across buyer, seller and admin views (§1.1). */
export type SellerOrderStatus =
  | "PLACED"
  | "ACCEPTED"
  | "PACKED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "DELIVERY_FAILED"
  | "RETURNED_TO_SELLER";
export type OrderItem = {
  variant?: { productId: string };
  id: string;
  productTitle: string;
  sku: string;
  optionValues: Record<string, string>;
  unitLkrMinor: number;
  lineLkrMinor: number;
  quantity: number;
};
export type SellerOrder = import("./delivery").DeliveryTracking & {
  id: string;
  status: string;
  seller: { id?: string; name: string; slug?: string };
  totalLkrMinor: number;
  items: OrderItem[];
  returnRequest?: { id: string; status: string } | null;
  returnRequests?: { id: string; status: string }[];
  /** Reason recorded with the latest status change (§1.1). */
  statusReason?: string | null;
  statusChangedAt?: string;
  events?: {
    id: string;
    fromStatus: string;
    toStatus: string;
    createdAt: string;
    reason?: string | null;
    /** null for background transitions (e.g. auto-cancel): show "HelaCart". */
    actorUserId?: string | null;
  }[];
};
export type Order = {
  id: string;
  createdAt: string;
  recipient: string;
  line1: string;
  city: string;
  district: string;
  paymentMethod: string;
  subtotalLkrMinor: number;
  shippingLkrMinor: number;
  totalLkrMinor: number;
  sellerOrders: SellerOrder[];
};
export type Notification = {
  id: string;
  type?: string;
  message: string;
  href?: string | null;
  subjectId?: string;
  readAt?: string | null;
  createdAt: string;
};
