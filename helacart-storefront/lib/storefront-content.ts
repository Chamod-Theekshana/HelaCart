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
  eyebrow: "A WORLD OF FINDS. A LOCAL FEEL.",
  title: "Good finds.",
  accent: "Closer to home.",
  description:
    "Little upgrades. Everyday favourites. Discover something you'll love from sellers across Sri Lanka, all in one place.",
  buttonLabel: "Shop the marketplace",
  buttonHref: "/products",
  imageAlt:
    "A woven bag, soft linen, headphones and ceramics arranged in warm sunlight",
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
