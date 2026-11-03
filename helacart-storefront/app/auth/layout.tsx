import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";

// Private area: keep it out of search results (see also app/robots.ts).
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: t("auth.metaTitle"),
    robots: { index: false, follow: false },
  };
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
