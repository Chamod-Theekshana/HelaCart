"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { errorMessage, hasApi, userApi } from "@/lib/api";
import { clientAuth, hasFirebase } from "@/lib/firebase";
import { useShop } from "./shop-provider";
import { ListPagination, useDebounced } from "./list-controls";
import { pageOf, type Page } from "@/lib/shops";
import { queryString } from "@/lib/workspace";

type Access = "loading" | "allowed" | "denied" | "error";
type AdminContext = {
  isPreview: boolean;
  access: Access;
  accessError: string;
  email: string | null;
  retry: () => void;
  request: <T>(path: string, method?: string, body?: unknown) => Promise<T>;
};
const context = createContext<AdminContext | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { user, authReady, isPreview } = useShop();
  const [checked, setChecked] = useState<{
    uid: string;
    access: Access;
    error: string;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const request = useCallback(
    async <T,>(path: string, method = "GET", body?: unknown): Promise<T> => {
      if (!hasApi)
        throw new Error(
          "Design preview is read-only. Configure the API and sign in as an administrator.",
        );
      const current = clientAuth()?.currentUser;
      if (!current) throw new Error("Sign in again to continue.");
      // Cached ID token; refreshed once only if the API answers 401.
      return userApi<T>(current, path, { method, body });
    },
    [],
  );

  useEffect(() => {
    if (!authReady || isPreview || !user || !hasFirebase) return;
    let active = true;
    // Reload only an unverified cached user; refresh the token once if that
    // reload shows the email has just been verified.
    (user.emailVerified
      ? Promise.resolve()
      : user.reload().then(async () => {
          if (user.emailVerified) await user.getIdToken(true);
        })
    )
      .then(() => request("/admin/seller-applications?status=PENDING"))
      .then(() => {
        if (active) setChecked({ uid: user.uid, access: "allowed", error: "" });
      })
      .catch((cause) => {
        if (!active) return;
        const message = errorMessage(cause);
        setChecked({
          uid: user.uid,
          access: /admin access requires|forbidden|verify your email/i.test(
            message,
          )
            ? "denied"
            : "error",
          error: message,
        });
      });
    return () => {
      active = false;
    };
  }, [authReady, isPreview, user, request, attempt]);

  const access: Access = isPreview
    ? "allowed"
    : !authReady || !user || !hasFirebase
      ? "loading"
      : checked && checked.uid === user.uid
        ? checked.access
        : "loading";
  return (
    <context.Provider
      value={{
        isPreview,
        access,
        accessError: checked && checked.uid === user?.uid ? checked.error : "",
        email: user?.email ?? null,
        retry: () => setAttempt((value) => value + 1),
        request,
      }}
    >
      {children}
    </context.Provider>
  );
}

export function useAdmin() {
  const value = useContext(context);
  if (!value) throw new Error("AdminProvider is required.");
  return value;
}

export function useAdminResource<T>(path: string, sample: T) {
  const { isPreview, access, request } = useAdmin();
  const { user } = useShop();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    key: string;
    value: T | null;
    error: string;
  }>({ key: "", value: null, error: "" });
  const key = `${user?.uid}:${path}:${revision}`;
  useEffect(() => {
    if (isPreview || access !== "allowed") return;
    let active = true;
    request<T>(path)
      .then((value) => {
        if (active) setState({ key, value, error: "" });
      })
      .catch((cause) => {
        if (active) setState({ key, value: null, error: errorMessage(cause) });
      });
    return () => {
      active = false;
    };
  }, [path, key, access, request, isPreview]);
  return {
    data: isPreview
      ? sample
      : access === "allowed" && state.key === key
        ? state.value
        : null,
    loading: !isPreview && state.key !== key,
    error: !isPreview && state.key === key ? state.error : "",
    reload: () => setRevision((value) => value + 1),
  };
}

export function useAdminList<T>(
  kind: string,
  filters: Record<string, string>,
  sample: T[],
) {
  const q = useDebounced(filters.q ?? "");
  const filter = queryString({ ...filters, q });
  const [paging, setPaging] = useState({ filter: "", page: 1 });
  const page = paging.filter === filter ? paging.page : 1;
  const resource = useAdminResource<Page<T>>(
    `/workspace/admin/${kind}?${filter}&page=${page}`,
    pageOf(
      sample.filter(
        (row) =>
          !q || JSON.stringify(row).toLowerCase().includes(q.toLowerCase()),
      ),
      page,
      20,
    ),
  );
  return {
    ...resource,
    data: resource.data?.items ?? null,
    page: resource.data,
    pagination: (
      <ListPagination
        data={resource.data}
        onPage={(next) => setPaging({ filter, page: next })}
        loading={resource.loading}
        label={`${kind} pages`}
      />
    ),
  };
}

/**
 * Cursor-paged admin list (`{ items, nextCursor }`) with "Load more".
 * `path` carries the filters; `cursor` is appended for later pages.
 */
export function useAdminCursorList<T extends { id: string }>(
  path: string,
  sample: T[],
) {
  const { isPreview, access, request } = useAdmin();
  const { user } = useShop();
  const [revision, setRevision] = useState(0);
  const key = `${user?.uid}:${path}:${revision}`;
  const [state, setState] = useState<{
    key: string;
    items: T[];
    nextCursor: string | null;
    error: string;
    loadingMore: boolean;
  }>({ key: "", items: [], nextCursor: null, error: "", loadingMore: false });
  const page = useCallback(
    (cursor: string | null) =>
      request<{ items: T[]; nextCursor: string | null }>(
        cursor
          ? `${path}${path.includes("?") ? "&" : "?"}cursor=${encodeURIComponent(cursor)}`
          : path,
      ),
    [path, request],
  );
  useEffect(() => {
    if (isPreview || access !== "allowed") return;
    let active = true;
    page(null)
      .then((result) => {
        if (active)
          setState({
            key,
            items: result.items,
            nextCursor: result.nextCursor,
            error: "",
            loadingMore: false,
          });
      })
      .catch((cause) => {
        if (active)
          setState({
            key,
            items: [],
            nextCursor: null,
            error: errorMessage(cause),
            loadingMore: false,
          });
      });
    return () => {
      active = false;
    };
  }, [key, page, access, isPreview]);
  const current = state.key === key ? state : null;
  async function loadMore() {
    if (!current?.nextCursor || current.loadingMore) return;
    setState((before) => ({ ...before, loadingMore: true }));
    try {
      const result = await page(current.nextCursor);
      setState((before) =>
        before.key === key
          ? {
              ...before,
              items: [
                ...before.items,
                ...result.items.filter(
                  (row) => !before.items.some((old) => old.id === row.id),
                ),
              ],
              nextCursor: result.nextCursor,
              loadingMore: false,
            }
          : before,
      );
    } catch (cause) {
      setState((before) => ({
        ...before,
        loadingMore: false,
        error: errorMessage(cause),
      }));
    }
  }
  /** Replaces one row in place after an action (e.g. suspend). */
  function replace(row: T) {
    setState((before) => ({
      ...before,
      items: before.items.map((old) => (old.id === row.id ? row : old)),
    }));
  }
  return {
    items: isPreview ? sample : (current?.items ?? []),
    loading: !isPreview && !current,
    error: isPreview ? "" : (current?.error ?? ""),
    hasMore: !isPreview && Boolean(current?.nextCursor),
    loadingMore: Boolean(current?.loadingMore),
    loadMore,
    replace,
    reload: () => setRevision((value) => value + 1),
  };
}
