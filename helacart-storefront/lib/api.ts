export const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(
  /\/+$/,
  "",
);
export const hasApi = Boolean(apiBase);
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const money = (minor: number) =>
  `Rs. ${(minor / 100).toLocaleString("en-LK", { maximumFractionDigits: 2 })}`;

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.replace(/^Firebase: /, "");
  return "Something went wrong. Please try again.";
}

export async function api<T>(
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {},
): Promise<T> {
  if (!hasApi)
    throw new Error("Connect your HelaCart API to use this feature.");
  const isMultipart =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  const isBinary = typeof Blob !== "undefined" && options.body instanceof Blob;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    isMultipart ||
      isBinary ||
      (path === "/me/orders/checkout" && options.method === "POST")
      ? 60_000
      : 15_000,
  );
  try {
    const response = await fetch(`${apiBase}${path}`, {
      method: options.method ?? "GET",
      headers: {
        ...(options.body !== undefined && !isMultipart
          ? {
              "Content-Type": isBinary
                ? (options.body as Blob).type
                : "application/json",
            }
          : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body:
        options.body === undefined
          ? undefined
          : isMultipart
            ? (options.body as FormData)
            : isBinary
              ? (options.body as Blob)
              : JSON.stringify(options.body),
      cache: "no-store",
      signal: controller.signal,
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const detail =
        typeof payload === "object" && payload !== null && "message" in payload
          ? (payload as { message: unknown }).message
          : null;
      throw new ApiError(
        Array.isArray(detail)
          ? detail.join("; ")
          : typeof detail === "string"
            ? detail
            : `Request failed (${response.status}).`,
        response.status,
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
