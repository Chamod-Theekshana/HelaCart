import type { Page } from "./shops";
export type ProductFeedback = {
  id: string;
  buyerName: string;
  rating: number;
  comment: string;
  variantLabel: string;
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version?: number;
  isHidden?: boolean;
  deletedAt?: string | null;
  product?: { id: string; title: string };
};
export type FeedbackPage = Page<ProductFeedback> & {
  summary: {
    total: number;
    average: number;
    breakdown: { rating: number; count: number }[];
  };
};
export type FeedbackAccess = {
  eligible: boolean;
  reason: string | null;
  review: (ProductFeedback & { version: number }) | null;
};
export type ProductFeedbackReport = {
  id: string;
  reason: string;
  ratingSnapshot: number;
  commentSnapshot: string;
  status: "OPEN" | "ACTIONED" | "DISMISSED";
  note: string | null;
  reviewedAt: string | null;
  createdAt: string;
  review: ProductFeedback & {
    product: { id: string; title: string; seller: { name: string } };
  };
};
export type ProductDetails = {
  brand: string;
  warranty: string;
  specifications: { name: string; value: string }[];
};
export const emptyProductDetails: ProductDetails = {
  brand: "",
  warranty: "",
  specifications: [],
};
