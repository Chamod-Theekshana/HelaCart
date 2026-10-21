import { demoProducts } from "./demo";
import type { Category, Product } from "./types";
import type { SellerDocument, SellerStatus, IdentityDocumentType } from "./seller";

export type PrivateShop = Pick<PublicShop, "id" | "name" | "slug" | "description" | "publicLocation" | "logoUrl" | "coverUrl" | "createdAt" | "shippingFeeLkrMinor"> & {
  status: SellerStatus;
  contactPhone: string | null;
  pickupAddress: string | null;
  identityDocumentType: IdentityDocumentType | null;
  documents: SellerDocument[];
};

export type RatingSummary = {
  total: number;
  average: number;
  breakdown: { rating: number; count: number }[];
};
export type PublicShop = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  publicLocation: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  createdAt: string;
  shippingFeeLkrMinor: number | null;
  productCount: number;
  rating: RatingSummary;
  categories: Category[];
};
export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};
export type ShopReview = {
  id: string;
  buyerName: string;
  rating: number;
  comment: string;
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
  updatedAt: string;
  verifiedPurchase: boolean;
  photos?: {id: string}[];
};
export type ReviewsPage = Page<ShopReview> & { summary: RatingSummary };
export type ReviewAccess = {
  canReply: boolean;
  orders: {
    id: string;
    createdAt: string;
    shopReview: {
      id: string;
      rating: number;
      comment: string;
      isHidden: boolean;
      deletedAt: string | null;
      photos?: {id: string}[];
    } | null;
  }[];
  myReviews: (ShopReview & { sellerOrderId: string; isHidden: boolean })[];
};
export const emptyRating: RatingSummary = {
  total: 0,
  average: 0,
  breakdown: [5, 4, 3, 2, 1].map((rating) => ({ rating, count: 0 })),
};
export const shopPath = (seller: { slug?: string }) =>
  seller.slug ? `/shops/${encodeURIComponent(seller.slug)}` : "/shops";
export const shopDate = (value: string) =>
  new Date(value).toLocaleDateString("en-LK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Colombo",
  });
export function pageOf<T>(items: T[], page = 1, pageSize = 12): Page<T> {
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    total: items.length,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(items.length / pageSize)),
  };
}
export const previewReviews: ShopReview[] = [
  {
    id: "sample-review-1",
    buyerName: "Nimali P.",
    rating: 5,
    comment:
      "Carefully packed and exactly as described. A lovely experience shopping from a local seller.",
    reply: "Thank you, Nimali! We are happy you enjoyed your order.",
    repliedAt: "2026-10-19T06:00:00Z",
    createdAt: "2026-10-18T08:00:00Z",
    updatedAt: "2026-10-19T06:00:00Z",
    verifiedPurchase: true,
  },
  {
    id: "sample-review-2",
    buyerName: "Kasun D.",
    rating: 4,
    comment:
      "Good quality and helpful communication. I would happily shop here again.",
    reply: null,
    repliedAt: null,
    createdAt: "2026-10-16T06:00:00Z",
    updatedAt: "2026-10-16T06:00:00Z",
    verifiedPurchase: true,
  },
  {
    id: "sample-review-3",
    buyerName: "Amaya S.",
    rating: 5,
    comment:
      "The product arrived in great condition. Very pleased with my purchase!",
    reply: null,
    repliedAt: null,
    createdAt: "2026-10-14T06:00:00Z",
    updatedAt: "2026-10-14T06:00:00Z",
    verifiedPurchase: true,
  },
];
const sampleRating: RatingSummary = {
  total: 3,
  average: 4.7,
  breakdown: [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: previewReviews.filter((row) => row.rating === rating).length,
  })),
};
export const previewShops: PublicShop[] = [
  ...new Map(
    demoProducts.map((product) => [product.seller.slug, product.seller]),
  ).values(),
].map((seller, index) => {
  const products = demoProducts.filter(
    (product) => product.seller.slug === seller.slug,
  );
  return {
    id: `sample-shop-${index}`,
    name: seller.name,
    slug: seller.slug!,
    description: `Welcome to ${seller.name}. Explore our collection, find something for your everyday life, and discover what our customers think.`,
    publicLocation: index % 2 ? "Kandy, Sri Lanka" : "Colombo, Sri Lanka",
    logoUrl: null,
    coverUrl: null,
    createdAt: "2026-07-01T00:00:00Z",
    shippingFeeLkrMinor: 35000,
    productCount: products.length,
    rating: sampleRating,
    categories: [
      ...new Map(
        products.map((product) => [product.category.id, product.category]),
      ).values(),
    ],
  };
});
export function previewShopProducts(
  slug: string,
  query: URLSearchParams,
): Page<Product> {
  let products =
    slug === "helacraft-studio"
      ? demoProducts
          .slice(0, 6)
          .map((product) => ({
            ...product,
            seller: { id: "preview-seller", name: "HelaCraft Studio", slug },
          }))
      : demoProducts.filter((product) => product.seller.slug === slug);
  const q = query.get("q")?.toLowerCase();
  const category = query.get("category");
  if (q)
    products = products.filter((product) =>
      product.title.toLowerCase().includes(q),
    );
  if (category)
    products = products.filter((product) => product.category.slug === category);
  if (query.has("minPrice"))
    products = products.filter(
      (product) => product.priceLkrMinor >= Number(query.get("minPrice")),
    );
  if (query.has("maxPrice"))
    products = products.filter(
      (product) => product.priceLkrMinor <= Number(query.get("maxPrice")),
    );
  const sort = query.get("sort");
  products.sort((a, b) =>
    sort === "price-asc"
      ? a.priceLkrMinor - b.priceLkrMinor
      : sort === "price-desc"
        ? b.priceLkrMinor - a.priceLkrMinor
        : sort === "name"
          ? a.title.localeCompare(b.title)
          : 0,
  );
  return pageOf(products, Number(query.get("page") ?? 1));
}
previewShops.push({
  ...previewShops[0],
  id: "preview-seller",
  name: "HelaCraft Studio",
  slug: "helacraft-studio",
  description:
    "Welcome to HelaCraft Studio. Discover everyday finds, thoughtful gifts and goods selected with care.",
  productCount: 6,
  categories: [
    ...new Map(
      demoProducts
        .slice(0, 6)
        .map((product) => [product.category.id, product.category]),
    ).values(),
  ],
});
