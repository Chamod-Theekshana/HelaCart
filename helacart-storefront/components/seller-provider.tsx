"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { errorMessage, userApi } from "@/lib/api";
import { clientAuth, subscribeToAuth } from "@/lib/firebase";
import { useShop } from "./shop-provider";
import { ListPagination, useDebounced } from "./list-controls";
import { pageOf, type Page } from "@/lib/shops";
import { queryString } from "@/lib/workspace";
import {
  previewProducts,
  previewSeller,
  type SellerAccount,
  type SellerApplication,
  type SellerMembership,
  type SellerProduct,
  type SellerProfile,
  type SellerRole,
} from "@/lib/seller";

type SellerContext = {
  seller: SellerAccount | null;
  sellers: SellerAccount[];
  applications: SellerApplication[];
  /** Sample products in design preview (live screens load their own data). */
  products: SellerProduct[];
  profile: SellerProfile | null;
  /** The signed-in member's role in the selected shop (§6). */
  role: SellerRole | null;
  isOwner: boolean;
  /** Admin suspended the selected shop (§5): most writes return 403. */
  suspended: boolean;
  statusReason: string | null;
  loading: boolean;
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

const membershipStatus = (membership: SellerMembership) =>
  membership.sellerStatus ?? membership.seller.status;

export function SellerProvider({ children }: { children: React.ReactNode }) {
  const { user, authReady, isPreview } = useShop();
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [applications, setApplications] = useState<SellerApplication[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const products = isPreview ? previewProducts : [];
  const [loading, setLoading] = useState(!isPreview);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");

  const visibleProfile = user && profile?.email === user.email ? profile : null;
  const visibleApplications = user ? applications : [];
  // Suspended shops stay selectable: read routes, order fulfilment and
  // support keep working while the shop is suspended (API §5).
  const memberships = useMemo(
    () =>
      isPreview
        ? [{ role: "OWNER" as const, seller: previewSeller }]
        : (visibleProfile?.memberships.filter((row) =>
            ["APPROVED", "SUSPENDED"].includes(membershipStatus(row)),
          ) ?? []),
    [isPreview, visibleProfile],
  );
  const sellers = useMemo(
    () =>
      memberships.map((row) => ({
        ...row.seller,
        status: membershipStatus(row),
      })),
    [memberships],
  );
  const seller =
    sellers.find((row) => row.id === selectedId) ?? sellers[0] ?? null;
  const membership =
    memberships.find((row) => row.seller.id === seller?.id) ?? null;
  const role = membership?.role ?? null;

  const request = useCallback(
    async <T,>(path: string, method = "GET", body?: unknown): Promise<T> => {
      if (isPreview)
        throw new Error("Connect the API to manage real seller data.");
      const current = clientAuth()?.currentUser;
      if (!current) throw new Error("Sign in with your seller account first.");
      return userApi<T>(current, path, { method, body });
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
      if (!current.emailVerified) {
        // Only an unverified cached user is reloaded; refresh the token once
        // when that reload shows a fresh verification.
        await current.reload();
        if (current.emailVerified) await current.getIdToken(true);
      }
      const [nextProfile, nextApplications] = await Promise.all([
        userApi<SellerProfile>(current, "/auth/me"),
        userApi<SellerApplication[]>(current, "/seller-applications/me"),
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
    return subscribeToAuth((current) => {
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
    products,
    role,
    isOwner: role === "OWNER",
    suspended: seller?.status === "SUSPENDED",
    statusReason: membership?.statusReason ?? null,
    loading,
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
