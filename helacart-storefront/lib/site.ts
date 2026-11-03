/** Public origin of the storefront (canonical URLs, sitemap, OpenGraph). */
function resolveSiteUrl() {
  const value = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  try {
    if (value) return new URL(value).origin;
  } catch {
    /* Fall through to the local development origin. */
  }
  return "http://localhost:3000";
}
export const siteUrl = resolveSiteUrl();
export const absoluteUrl = (path: string) =>
  `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
