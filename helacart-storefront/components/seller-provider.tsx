"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import { api, errorMessage } from "@/lib/api";
import { clientAuth } from "@/lib/firebase";
import { useShop } from "./shop-provider";
import { ListPagination, useDebounced } from "./list-controls";
import { pageOf, type Page } from "@/lib/shops";
import { queryString } from "@/lib/workspace";
import {
  previewOrders,
  previewProducts,
  previewSeller,
  type SellerAccount,
  type SellerApplication,
  type SellerOrderRecord,
  type SellerProduct,
  type SellerProfile,
} from "@/lib/seller";

type SellerContext = {
  seller: SellerAccount | null;
  sellers: SellerAccount[];
  applications: SellerApplication[];
  products: SellerProduct[];
  orders: SellerOrderRecord[];
  profile: SellerProfile | null;
  loading: boolean;
  dataLoading: boolean;
  error: string;
  isPreview: boolean;
  revision: number;
  selectSeller: (id: string) => void;
  request: <T>(path: string, method?: string, body?: unknown) => Promise<T>;
  refreshProducts: () => Promise<void>;
  refreshOrders: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};
const sellerContext = createContext<SellerContext | null>(null);

export function SellerProvider({ children }: { children: React.ReactNode }) {
  const { user, authReady, isPreview } = useShop();
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [applications, setApplications] = useState<SellerApplication[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const products = isPreview ? previewProducts : [];
  const orders = isPreview ? previewOrders : [];
  const [loading, setLoading] = useState(!isPreview);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");

  const visibleProfile = user && profile?.email === user.email ? profile : null;
  const visibleApplications = user ? applications : [];
  const sellers = useMemo(
    () =>
      isPreview
        ? [previewSeller]
        : (visibleProfile?.memberships
            .map((row) => row.seller)
            .filter((row) => row.status === "APPROVED") ?? []),
    [isPreview, visibleProfile],
  );
  const seller =
    sellers.find((row) => row.id === selectedId) ?? sellers[0] ?? null;
  const dataLoading = false;

  const request = useCallback(
    async <T,>(path: string, method = "GET", body?: unknown): Promise<T> => {
      if (isPreview)
        throw new Error("Connect the API to manage real seller data.");
      const current = clientAuth()?.currentUser;
      if (!current) throw new Error("Sign in with your seller account first.");
      return api<T>(path, { token: await current.getIdToken(), method, body });
    },
    [isPreview],
  );

  const refreshProfile = useCallback(async () => {
    if (isPreview) return;
    try {
      const current = clientAuth()?.currentUser;
      if (!current) {
        setLoading(false);
        return;
      }
      await current.reload();
      const token = await current.getIdToken(true);
      const [nextProfile, nextApplications] = await Promise.all([
        api<SellerProfile>("/auth/me", { token }),
        api<SellerApplication[]>("/seller-applications/me", { token }),
      ]);
      setProfile(nextProfile);
      setApplications(nextApplications);
      setError("");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [isPreview]);

  useEffect(() => {
    if (!authReady || isPreview) return;
    if (!user) return;
    const auth = clientAuth();
    if (!auth) return;
    return onAuthStateChanged(auth, (current) => {
      if (current?.uid === user.uid) void refreshProfile();
    });
  }, [authReady, user, isPreview, refreshProfile]);

  const refreshProducts = useCallback(async () => {
    setRevision((value) => value + 1);
  }, []);

  const refreshOrders = useCallback(async () => {
    setRevision((value) => value + 1);
  }, []);

  const value: SellerContext = {
    seller,
    sellers,
    applications: visibleApplications,
    profile: visibleProfile,
    products: dataLoading ? [] : products,
    orders: dataLoading ? [] : orders,
    loading,
    dataLoading,
    error,
    isPreview,
    revision,
    selectSeller: setSelectedId,
    request,
    refreshProducts,
    refreshOrders,
    refreshProfile,
  };
  return (
    <sellerContext.Provider value={value}>{children}</sellerContext.Provider>
  );
}

export function useSeller() {
  const value = useContext(sellerContext);
  if (!value) throw new Error("SellerProvider is required.");
  return value;
}

export function useSellerResource<T>(path: string, sample: T) {
  const { seller, request, isPreview, revision } = useSeller();
  const { user } = useShop();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    key: string;
    data: T | null;
    error: string;
  }>({ key: "", data: null, error: "" });
  const key = `${user?.uid}:${seller?.id}:${path}:${revision}:${attempt}`;
  useEffect(() => {
    if (!seller || isPreview) return;
    let active = true;
    request<T>(`/workspace/sellers/${seller.id}/${path}`)
      .then((data) => {
        if (active) setState({ key, data, error: "" });
      })
      .catch((error) => {
        if (active) setState({ key, data: null, error: errorMessage(error) });
      });
    return () => {
      active = false;
    };
  }, [seller, isPreview, request, path, key]);
  return {
    data: isPreview ? sample : seller && state.key === key ? state.data : null,
    error: !isPreview && state.key === key ? state.error : "",
    loading: !isPreview && Boolean(seller) && state.key !== key,
    reload: () => setAttempt((value) => value + 1),
  };
}

export function useSellerList<T>(
  kind: string,
  filters: Record<string, string>,
  sample: T[],
) {
  const q = useDebounced(filters.q ?? "");
  const filter = queryString({ ...filters, q });
  const [paging, setPaging] = useState({ filter: "", page: 1 });
  const page = paging.filter === filter ? paging.page : 1;
  const resource = useSellerResource<Page<T>>(
    `${kind}?${filter}&page=${page}`,
    pageOf(sample, page, 20),
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
