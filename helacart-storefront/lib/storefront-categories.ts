import type { Category } from "./types";

export type CategoryFamily =
  "home" | "tech" | "fashion" | "beauty" | "pantry" | "outdoor" | "other";
const presentations = {
  home: {
    title: "Make yourself at home.",
    description: "Thoughtful little additions for the spaces you love.",
    action: "Find your home favourites",
  },
  tech: {
    title: "A little more connected.",
    description: "Everyday tech for work, play and everything between.",
    action: "Explore everyday tech",
  },
  fashion: {
    title: "Find your everyday style.",
    description: "Pieces to make your own, wherever the day takes you.",
    action: "Find your next favourite",
  },
  beauty: {
    title: "A moment for yourself.",
    description: "Small additions to your everyday care routine.",
    action: "Explore daily essentials",
  },
  pantry: {
    title: "Good things for your pantry.",
    description: "Discover something for your next cup, meal or gathering.",
    action: "Browse the pantry",
  },
  outdoor: {
    title: "Make time for the outside.",
    description: "Find something for your next adventure, big or small.",
    action: "Explore the outdoors",
  },
  other: {
    title: "Your next good find.",
    description: "Take a look around. Something might catch your eye.",
    action: "Explore the collection",
  },
};
export function categoryPresentation(
  category: Pick<Category, "name" | "slug">,
) {
  const value = `${category.slug} ${category.name}`.toLowerCase();
  const family: CategoryFamily =
    /home|kitchen|living|furniture|garden|decor/.test(value)
      ? "home"
      : /electronic|tech|computer|phone|audio|gadget|laptop/.test(value)
        ? "tech"
        : /fashion|apparel|cloth|wear|shoe|jewel|accessor|textile/.test(value)
          ? "fashion"
          : /beauty|health|care|cosmetic|wellness/.test(value)
            ? "beauty"
            : /pantry|food|grocery|spice|tea|coffee|beverage/.test(value)
              ? "pantry"
              : /outdoor|sport|fitness|camp|travel/.test(value)
                ? "outdoor"
                : "other";
  return {
    family,
    ...presentations[family],
    ...(family === "other"
      ? { title: category.name, action: "Explore this collection" }
      : {}),
  };
}
export const categoryHref = (category: Pick<Category, "slug">) =>
  `/products?${new URLSearchParams({ category: category.slug })}`;

// Illustrative category photos; real product photos and admin artwork remain authoritative.
export function categoryFallbackImage(
  category: Pick<Category, "name" | "slug">,
) {
  const name = `${category.name} ${category.slug}`.toLowerCase();
  if (/shoe|footwear|sandal/.test(name))
    return "/marketplace/category-footwear.jpg";
  if (/kitchen|cook|pottery/.test(name))
    return "/marketplace/category-kitchen.jpg";
  const family = categoryPresentation(category).family;
  const photos = {
    home: "home",
    pantry: "pantry",
    fashion: "fashion",
    beauty: "wellness",
  } as const;
  return family in photos
    ? `/marketplace/category-${photos[family as keyof typeof photos]}.jpg`
    : null;
}
export function collectionFallbackImage(
  category: Pick<Category, "name" | "slug">,
) {
  const family = categoryPresentation(category).family;
  return family === "home" || family === "pantry"
    ? `/marketplace/collection-${family}.jpg`
    : categoryFallbackImage(category);
}
