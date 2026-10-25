"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { Heart, X } from "lucide-react";
import { api, ApiError, errorMessage } from "@/lib/api";
import { clientAuth } from "@/lib/firebase";
import {
  clearFavoriteIntent,
  readFavoriteIntent,
  type FavoriteRef,
  type FavoriteSummary,
} from "@/lib/favorites";
import { useShop } from "./shop-provider";
import s from "./favorites.module.css";

type FavoritesContext = {
  items: FavoriteRef[];
  count: number;
  loading: boolean;
  error: string;
  revision: number;
  refresh: () => Promise<void>;
  save: (productId: string) => Promise<void>;
  remove: (favoriteId: string) => Promise<void>;
  isPending: (key: string) => boolean;
};
const context = createContext<FavoritesContext | null>(null);
export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user, authReady, isPreview } = useShop(),
    scope = isPreview ? "preview" : user?.uid || "";
  const [state, setState] = useState<{
    uid: string;
    items: FavoriteRef[];
    loading: boolean;
    error: string;
  } | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState<{
    uid: string;
    text: string;
    error: boolean;
  } | null>(null);
  const saved = useRef<{ uid: string; items: FavoriteRef[] } | null>(null),
    sequence = useRef(0),
    queue = useRef<Promise<unknown>>(Promise.resolve()),
    pending = useRef(new Set<string>()),
    resumed = useRef(new Set<string>());
  const currentScope = () =>
    isPreview ? "preview" : clientAuth()?.currentUser?.uid || "";
  const refresh = useCallback(async () => {
    if (isPreview || !scope || clientAuth()?.currentUser?.uid !== scope) return;
    const request = ++sequence.current;
    setState((old) => ({
      uid: scope,
      items: old?.uid === scope ? old.items : [],
      loading: true,
      error: "",
    }));
    try {
      const current = clientAuth()!.currentUser!;
      const next = await api<FavoriteSummary>("/me/favorites/summary", {
        token: await current.getIdToken(),
      });
      if (
        clientAuth()?.currentUser?.uid === scope &&
        sequence.current === request
      ) {
        saved.current = { uid: scope, items: next.items };
        setState({ uid: scope, items: next.items, loading: false, error: "" });
      }
    } catch (error) {
      if (
        clientAuth()?.currentUser?.uid === scope &&
        sequence.current === request
      )
        setState((old) => ({
          uid: scope,
          items: old?.uid === scope ? old.items : [],
          loading: false,
          error: errorMessage(error),
        }));
      throw error;
    }
  }, [scope, isPreview]);
  useEffect(() => {
    if (!scope || isPreview) return;
    void refresh().catch(() => undefined);
    const focus = () => {
      if (document.visibilityState === "visible")
        void refresh().catch(() => undefined);
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [scope, isPreview, refresh]);
  const change = async (kind: "save" | "remove", id: string) => {
    const uid = currentScope();
    if (!uid) throw new Error("Sign in to save your favorites.");
    const tracked = saved.current?.uid === uid ? saved.current.items : [];
    const productKey =
      kind === "save"
        ? id
        : tracked.find((item) => item.id === id)?.productId || id;
    const key = `${uid}:${productKey}`;
    if (pending.current.has(key)) return;
    pending.current.add(key);
    setBusy((old) => ({ ...old, [key]: true }));
    const task = queue.current
      .catch(() => undefined)
      .then(async () => {
        if (currentScope() !== uid)
          throw new Error("Your account changed. Try again.");
        if (!isPreview && saved.current?.uid !== uid) await refresh();
        if (currentScope() !== uid)
          throw new Error("Your account changed. Try again.");
        if (!isPreview && saved.current?.uid !== uid)
          throw new Error(
            "Your favorites are still loading. Please try again.",
          );
        const token = isPreview
          ? undefined
          : await clientAuth()!.currentUser!.getIdToken();
        if (currentScope() !== uid)
          throw new Error("Your account changed. Try again.");
        sequence.current++;
        const before = saved.current?.uid === uid ? saved.current.items : [];
        let next: FavoriteRef[];
        if (kind === "save") {
          if (before.some((item) => item.productId === id)) {
            clearFavoriteIntent(id, uid);
            setState({ uid, items: before, loading: false, error: "" });
            return;
          }
          const item = isPreview
            ? { id: `favorite-${id}`, productId: id }
            : await api<FavoriteRef>(
                `/me/favorites/products/${encodeURIComponent(id)}`,
                { method: "PUT", token },
              );
          next = [item, ...before.filter((row) => row.productId !== id)];
          clearFavoriteIntent(id, uid);
        } else {
          if (!isPreview)
            await api(`/me/favorites/${encodeURIComponent(id)}`, {
              method: "DELETE",
              token,
            });
          next = before.filter((row) => row.id !== id);
          const removedProduct = before.find((row) => row.id === id)?.productId;
          if (removedProduct) clearFavoriteIntent(removedProduct, uid);
        }
        if (currentScope() !== uid) return;
        sequence.current++;
        saved.current = { uid, items: next };
        setState({ uid, items: next, loading: false, error: "" });
        setRevision((old) => old + 1);
        setNotice({
          uid,
          text:
            kind === "save"
              ? "Saved to your favorites."
              : "Removed from your favorites.",
          error: false,
        });
      });
    queue.current = task;
    try {
      await task;
    } catch (error) {
      if (currentScope() === uid) {
        if (
          kind === "save" &&
          error instanceof ApiError &&
          [400, 404, 409].includes(error.status)
        )
          clearFavoriteIntent(id, uid);
        setNotice({ uid, text: errorMessage(error), error: true });
        void refresh().catch(() => undefined);
      }
      throw error;
    } finally {
      pending.current.delete(key);
      setBusy((old) => {
        const next = { ...old };
        delete next[key];
        return next;
      });
    }
  };
  const save = (productId: string) => change("save", productId),
    remove = (id: string) => change("remove", id);
  useEffect(() => {
    if (!scope || isPreview || !authReady) return;
    const intent = readFavoriteIntent(scope);
    if (!intent) return;
    const key = `${scope}:${intent.createdAt}:${intent.productId}`;
    if (resumed.current.has(key)) return;
    resumed.current.add(key);
    void save(intent.productId).catch(() => undefined);
    // Saving is an event resumed once for this identity, not an effect to replay on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, isPreview, authReady]);
  useEffect(() => {
    if (!notice || notice.error) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const active = state?.uid === scope ? state : null;
  const loading =
    !isPreview && (!authReady || Boolean(scope && (!active || active.loading)));
  return (
    <context.Provider
      value={{
        items: active?.items || [],
        count: active?.items.length || 0,
        loading,
        error: active?.error || "",
        revision,
        refresh,
        save,
        remove,
        isPending: (key) => Boolean(busy[`${scope}:${key}`]),
      }}
    >
      {children}
      {notice?.uid === scope && (
        <div
          className={`${s.toast} ${notice.error ? s.toastError : ""}`}
          role={notice.error ? "alert" : "status"}
        >
          <Heart size={18} />
          <div>
            {notice.text}
            <Link href="/favorites">View favorites</Link>
          </div>
          <button
            type="button"
            aria-label="Dismiss favorites message"
            onClick={() => setNotice(null)}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </context.Provider>
  );
}
export function useFavorites() {
  const value = useContext(context);
  if (!value) throw new Error("FavoritesProvider is required");
  return value;
}
