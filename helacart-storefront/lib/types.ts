export type Category = { id: string; name: string; slug: string };
export type Variant = {
  id: string; sku: string; optionValues: Record<string, string>;
  priceLkrMinor: number; availableQuantity: number;
};
export type Product = {
  id: string; title: string; slug?: string; description: string | null;
  imageUrls: string[]; priceLkrMinor: number;
  category: Category; seller: { id?: string; name: string; slug?: string };
  variants: Variant[];
};
export type ProductPage = { items: Product[]; nextCursor: string | null };
export type CartItem = {
  variantId: string; productId: string; sellerId: string; title: string;
  sku: string; optionValues: Record<string, string>; priceLkrMinor: number;
  quantity: number; availableQuantity: number; available: boolean;
  shippingConfigured: boolean;
};
export type Cart = {
  items: CartItem[]; subtotalLkrMinor: number; shippingLkrMinor: number;
  totalLkrMinor: number; canCheckout: boolean;
};
export type Address = {
  id: string; recipient: string; phone: string; line1: string;
  line2?: string | null; city: string; district: string; postalCode: string;
};
export type OrderItem = {
  id: string; productTitle: string; sku: string; optionValues: Record<string,string>;
  unitLkrMinor: number; lineLkrMinor: number; quantity: number;
};
export type SellerOrder = {
  id: string; status: string; seller: { id?: string; name: string; slug?: string };
  totalLkrMinor: number; items: OrderItem[];
};
export type Order = {
  id: string; createdAt: string; recipient: string; line1: string;
  city: string; district: string; paymentMethod: string;
  subtotalLkrMinor: number; shippingLkrMinor: number; totalLkrMinor: number;
  sellerOrders: SellerOrder[];
};
export type Notification = { id: string; type?: string; message: string; readAt?: string | null; createdAt: string };
