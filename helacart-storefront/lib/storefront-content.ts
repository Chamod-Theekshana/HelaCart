import type { Category } from "./types";
export type ManagedCategory = Category & {
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  revision: number;
  _count: { products: number };
};
export type HeroContent = {
  eyebrow: string;
  title: string;
  accent: string;
  description: string;
  buttonLabel: string;
  buttonHref: string;
  imageAlt: string;
  desktopImageUrl: string | null;
  mobileImageUrl: string | null;
};
export type HeroAdminState = {
  draft: HeroContent;
  published: HeroContent;
  revision: number;
  publishedAt: string | null;
  updatedAt: string | null;
};
export const defaultHero: HeroContent = {
  eyebrow: "SRI LANKA'S LOCAL MARKETPLACE",
  title: "Good finds.",
  accent: "Local roots.",
  description:
    "Discover everyday favourites from independent shops across Sri Lanka.",
  buttonLabel: "Shop now",
  buttonHref: "/products",
  imageAlt:
    "A rattan basket, Ceylon tea and batik cloth on a sunlit linen table",
  desktopImageUrl: null,
  mobileImageUrl: null,
};
export const previewHeroState: HeroAdminState = {
  draft: defaultHero,
  published: defaultHero,
  revision: 0,
  publishedAt: null,
  updatedAt: null,
};
