import {
  Box,
  Coffee,
  Headphones,
  House,
  Leaf,
  Shirt,
  Tent,
} from "lucide-react";
import type { CategoryFamily } from "@/lib/storefront-categories";
import s from "./storefront-home.module.css";
const icons = {
  home: House,
  tech: Headphones,
  fashion: Shirt,
  beauty: Leaf,
  pantry: Coffee,
  outdoor: Tent,
  other: Box,
};
export function CategoryArtwork({
  family,
  large = false,
}: {
  family: CategoryFamily;
  large?: boolean;
}) {
  const Icon = icons[family];
  return (
    <span
      className={`${s.categoryArt} ${s[`${family}Art`] ?? ""} ${large ? s.largeArt : ""}`}
      aria-hidden="true"
    >
      <span />
      <Icon strokeWidth={1.35} />
    </span>
  );
}
