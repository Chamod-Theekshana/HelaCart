import type { Metadata } from "next";

// Private area: keep it out of search results (see also app/robots.ts).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function FavoritesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
