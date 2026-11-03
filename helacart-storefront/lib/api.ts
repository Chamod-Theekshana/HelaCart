export const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(
  /\/+$/,
  "",
);
export const hasApi = Boolean(apiBase);
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    /** Stable machine-readable code from the API body (`code`), when sent. */
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** The API's stable error `code`, if the error carries one. */
export function apiErrorCode(error: unknown): string | undefined {
  return error instanceof ApiError ? error.code : undefined;
}

export const money = (minor: number) =>
  `Rs. ${(minor / 100).toLocaleString("en-LK", { maximumFractionDigits: 2 })}`;

export function errorMessage(error: unknown): string {
  // Seller Center / Admin (English): a clearer text for a stale order view.
  if (
    error instanceof ApiError &&
    error.code === "ORDER_TRANSITION_NOT_ALLOWED"
  )
    return "This order has already moved to another status. Refresh to see its current status, then try again.";
  if (error instanceof Error) return error.message.replace(/^Firebase: /, "");
  return "Something went wrong. Please try again.";
}

export type ApiOptions = {
  method?: string;
  token?: string;
  body?: unknown;
  responseType?: "json" | "text";
  /**
   * Server-side Next.js data-cache lifetime in seconds for public GETs.
   * Defaults to 300 s for categories and 60 s for other public GETs.
   * `false` (or any authenticated/browser request) uses `no-store`.
   */
  revalidate?: number | false;
};

const isServer = () => typeof window === "undefined";

function defaultRevalidate(path: string) {
  return /^\/categories(?:[/?]|$)/.test(path) ? 300 : 60;
}

/** Headers added only to server-to-server calls (never in the browser bundle). */
function internalHeaders(): Record<string, string> {
  if (!isServer()) return {};
  // Server-only variable: not NEXT_PUBLIC, so Next.js never inlines it into client code.
  const token = process.env.HELACART_INTERNAL_API_TOKEN;
  return token ? { "x-helacart-internal": token } : {};
}

export async function api<T>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  if (!hasApi)
    throw new Error("Connect your HelaCart API to use this feature.");
  const method = options.method ?? "GET";
  const isMultipart =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  const isBinary = typeof Blob !== "undefined" && options.body instanceof Blob;
  const revalidate =
    isServer() && method === "GET" && !options.token
      ? (options.revalidate ?? defaultRevalidate(path))
      : false;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    isMultipart ||
      isBinary ||
      /^\/(?:sellers\/[^/]+|admin)\/(?:bulk-tools|reports)(?:[/?]|$)/.test(
        path,
      ) ||
      (path === "/me/orders/checkout" && method === "POST")
      ? 60_000
      : 15_000,
  );
  try {
    const response = await fetch(`${apiBase}${path}`, {
      method,
      headers: {
        ...(options.body !== undefined && !isMultipart
          ? {
              "Content-Type": isBinary
                ? (options.body as Blob).type
                : "application/json",
            }
          : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...internalHeaders(),
      },
      body:
        options.body === undefined
          ? undefined
          : isMultipart
            ? (options.body as FormData)
            : isBinary
              ? (options.body as Blob)
              : JSON.stringify(options.body),
      ...(revalidate === false
        ? { cache: "no-store" as const }
        : { next: { revalidate } }),
      signal: controller.signal,
    });
    if (response.ok && options.responseType === "text")
      return (await response.text()) as T;
    if (response.status === 204) return undefined as T;
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const body =
        typeof payload === "object" && payload !== null
          ? (payload as { message?: unknown; code?: unknown })
          : {};
      const detail = body.message;
      throw new ApiError(
        Array.isArray(detail)
          ? detail.join("; ")
          : typeof detail === "string"
            ? detail
            : `Request failed (${response.status}).`,
        response.status,
        typeof body.code === "string" ? body.code : undefined,
      );
    }
    return payload as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      throw new Error("The API did not respond in time.");
    if (error instanceof TypeError)
      throw new Error(
        "Could not reach the API. Check that it is running and allows this website in CORS.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Anything that can mint a Firebase ID token (a Firebase `User`). */
export type TokenSource = {
  getIdToken(forceRefresh?: boolean): Promise<string>;
};

/**
 * Authenticated request with the cached Firebase ID token. The token is only
 * force-refreshed (once) when the API rejects it with 401.
 */
export async function userApi<T>(
  user: TokenSource,
  path: string,
  options: Omit<ApiOptions, "token" | "revalidate"> = {},
): Promise<T> {
  try {
    return await api<T>(path, { ...options, token: await user.getIdToken() });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    return api<T>(path, { ...options, token: await user.getIdToken(true) });
  }
}
