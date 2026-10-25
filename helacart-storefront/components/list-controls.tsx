"use client";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import type { Page } from "@/lib/shops";
import { useShop } from "./shop-provider";
import s from "./list-controls.module.css";
export function ListPagination({
  data,
  onPage,
  loading = false,
  label = "List pages",
}: {
  data: Pick<Page<unknown>, "page" | "pages" | "total" | "pageSize"> | null;
  onPage: (page: number) => void;
  loading?: boolean;
  label?: string;
}) {
  if (!data) return null;
  const empty = data.page > data.pages || !data.total;
  const start = empty ? 0 : (data.page - 1) * data.pageSize + 1,
    end = empty ? 0 : Math.min(data.page * data.pageSize, data.total);
  return (
    <nav className={s.pagination} aria-label={label}>
      <span>
        {start}–{end} of {data.total}
      </span>
      <div>
        <button
          type="button"
          disabled={loading || data.page <= 1}
          onClick={() => onPage(data.page - 1)}
        >
          Previous
        </button>
        <span>
          Page {data.page} of {data.pages}
        </span>
        <button
          type="button"
          disabled={loading || data.page >= data.pages}
          onClick={() => onPage(data.page + 1)}
        >
          Next
        </button>
        {data.page > data.pages && (
          <button type="button" onClick={() => onPage(data.pages)}>
            Last page
          </button>
        )}
      </div>
    </nav>
  );
}
export function useDebounced(value: string) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(
      () => setDebounced(value.trim().slice(0, 80)),
      250,
    );
    return () => clearTimeout(timer);
  }, [value]);
  return debounced;
}
export function useBuyerResource<T>(
  path: string,
  sample: T,
  revision = 0,
  enabled = true,
) {
  const { user, isPreview } = useShop();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    key: string;
    data: T | null;
    error: string;
  }>({ key: "", data: null, error: "" });
  const key = `${user?.uid}:${path}:${revision}:${attempt}`;
  useEffect(() => {
    if (isPreview || !user?.emailVerified || !enabled) return;
    let active = true;
    user
      .getIdToken()
      .then((token) => api<T>(path, { token }))
      .then((data) => {
        if (active) setState({ key, data, error: "" });
      })
      .catch((error) => {
        if (active) setState({ key, data: null, error: errorMessage(error) });
      });
    return () => {
      active = false;
    };
  }, [user, isPreview, path, key, enabled]);
  return {
    data: isPreview
      ? sample
      : enabled && user?.emailVerified && state.key === key
        ? state.data
        : null,
    error: !isPreview && state.key === key ? state.error : "",
    loading:
      !isPreview &&
      enabled &&
      Boolean(user?.emailVerified) &&
      state.key !== key,
    reload: () => setAttempt((value) => value + 1),
  };
}
