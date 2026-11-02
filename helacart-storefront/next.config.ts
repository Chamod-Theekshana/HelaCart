import type { NextConfig } from "next";

// `next build` runs this file in the "phase-production-build" phase.
const PRODUCTION_BUILD = "phase-production-build";

const env = (name: string) => (process.env[name] ?? "").trim();

function origin(value: string, name: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:")
      throw new Error();
    return url.origin;
  } catch {
    throw new Error(
      `${name} must be an absolute http(s) URL (got "${value}").`,
    );
  }
}

const firebaseVariables = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

/**
 * A production build without the API (or with the API but without Firebase)
 * silently ships the design preview or a storefront nobody can sign in to.
 * Fail instead, unless a preview build is explicitly requested (CI, demos).
 */
function assertProductionEnvironment() {
  if (env("NEXT_PUBLIC_ALLOW_PREVIEW_BUILD") === "1") {
    console.warn(
      "[helacart] NEXT_PUBLIC_ALLOW_PREVIEW_BUILD=1: building without the production environment checks.",
    );
    return;
  }
  const problems: string[] = [];
  if (!env("NEXT_PUBLIC_API_URL"))
    problems.push(
      "NEXT_PUBLIC_API_URL is not set, so the build would only contain the design preview.",
    );
  else {
    const missing = firebaseVariables.filter((name) => !env(name));
    if (missing.length)
      problems.push(
        `NEXT_PUBLIC_API_URL is set but Firebase sign-in is not configured: ${missing.join(", ")}.`,
      );
  }
  if (problems.length)
    throw new Error(
      [
        "HelaCart production build stopped:",
        ...problems.map((problem) => `  - ${problem}`),
        "Set the variables (see .env.example) or set NEXT_PUBLIC_ALLOW_PREVIEW_BUILD=1 for an intentional preview build.",
      ].join("\n"),
    );
  if (!env("NEXT_PUBLIC_SITE_URL"))
    console.warn(
      "[helacart] NEXT_PUBLIC_SITE_URL is not set: canonical URLs and the sitemap will use http://localhost:3000.",
    );
  if (!env("HELACART_IMAGE_ORIGINS"))
    console.warn(
      "[helacart] HELACART_IMAGE_ORIGINS is not set: product images on the R2 public domain will be blocked by the Content-Security-Policy.",
    );
}

function contentSecurityPolicy(dev: boolean, httpsSite: boolean) {
  const apiOrigin = origin(env("NEXT_PUBLIC_API_URL"), "NEXT_PUBLIC_API_URL");
  const authDomain = env("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
  const imageOrigins = imageHosts().map((host) => host.origin);
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'"],
    // Next.js App Router streams inline bootstrap scripts; without a per-request
    // nonce (proxy) they need 'unsafe-inline'. Firebase may load apis.google.com.
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      ...(dev ? ["'unsafe-eval'"] : []),
      "https://apis.google.com",
    ],
    // React style attributes and the Google Fonts stylesheet.
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      ...(apiOrigin ? [apiOrigin] : []),
      ...imageOrigins,
      // Design-preview sample photos (Stitch export) only exist without an API.
      ...(apiOrigin ? [] : ["https://lh3.googleusercontent.com"]),
    ],
    "connect-src": [
      "'self'",
      ...(apiOrigin ? [apiOrigin] : []),
      "https://identitytoolkit.googleapis.com",
      "https://securetoken.googleapis.com",
      "https://www.googleapis.com",
      ...(dev ? ["ws:", "wss:"] : []),
    ],
    "frame-src": [
      "'self'",
      ...(authDomain
        ? [`https://${authDomain.replace(/^https?:\/\//, "")}`]
        : []),
    ],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
  };
  return [
    ...Object.entries(directives).map(
      ([name, values]) => `${name} ${[...new Set(values)].join(" ")}`,
    ),
    ...(httpsSite ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/** Image hosts: the API origin plus R2/CDN origins in HELACART_IMAGE_ORIGINS. */
function imageHosts(): URL[] {
  const values = [
    env("NEXT_PUBLIC_API_URL"),
    ...env("HELACART_IMAGE_ORIGINS")
      .split(",")
      .map((value) => value.trim()),
  ].filter(Boolean);
  return values.map((value) => {
    origin(value, "HELACART_IMAGE_ORIGINS");
    return new URL(value);
  });
}

export default function config(phase: string): NextConfig {
  const production = process.env.NODE_ENV === "production";
  if (phase === PRODUCTION_BUILD && production) assertProductionEnvironment();
  // HSTS and request upgrades only for a deployed HTTPS site, never localhost.
  const httpsSite =
    production && env("NEXT_PUBLIC_SITE_URL").startsWith("https://");
  const securityHeaders = [
    {
      key: "Content-Security-Policy",
      value: contentSecurityPolicy(!production, httpsSite),
    },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value:
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
    ...(httpsSite
      ? [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ]
      : []),
  ];
  return {
    turbopack: { root: process.cwd() },
    poweredByHeader: false,
    images: {
      remotePatterns: imageHosts().map((url) => ({
        protocol:
          url.protocol === "http:" ? ("http" as const) : ("https" as const),
        hostname: url.hostname,
        ...(url.port ? { port: url.port } : {}),
        pathname: "/**",
      })),
    },
    async headers() {
      return [
        { source: "/:path*", headers: securityHeaders },
        {
          // iOS requires JSON without a file extension for universal links.
          source: "/.well-known/apple-app-site-association",
          headers: [
            { key: "Content-Type", value: "application/json" },
            { key: "Cache-Control", value: "public, max-age=3600" },
          ],
        },
        {
          source: "/.well-known/assetlinks.json",
          headers: [{ key: "Cache-Control", value: "public, max-age=3600" }],
        },
      ];
    },
  };
}
