import type { MetadataRoute } from "next";
import { absoluteUrl, siteUrl } from "@/lib/site";

/** Private and transactional areas stay out of search engines. */
const privatePaths = [
  "/admin",
  "/seller",
  "/account",
  "/checkout",
  "/cart",
  "/auth",
  "/orders",
  "/favorites",
  "/order-success",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: privatePaths,
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: siteUrl,
  };
}
