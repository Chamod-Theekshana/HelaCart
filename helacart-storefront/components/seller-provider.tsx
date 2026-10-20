"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { api, errorMessage } from "@/lib/api";
import { clientAuth } from "@/lib/firebase";
import { useShop } from "./shop-provider";
import {
  previewOrders, previewProducts, previewSeller,
  type SellerAccount, type SellerApplication, type SellerOrderRecord,
  type SellerProduct, type SellerProfile,
} from "@/lib/seller";

type SellerContext = {
  seller: SellerAccount | null; sellers: SellerAccount[]; applications: SellerApplication[];
  products: SellerProduct[]; orders: SellerOrderRecord[]; profile: SellerProfile | null;
  loading: boolean; dataLoading: boolean; error: string; isPreview: boolean;
  selectSeller: (id: string) => void;
  request: <T>(path: string, method?: string, body?: unknown) => Promise<T>;
  refreshProducts: () => Promise<void>; refreshOrders: () => Promise<void>; refreshProfile: () => Promise<void>;
};
const sellerContext = createContext<SellerContext | null>(null);

export function SellerProvider({ children }: { children: React.ReactNode }) {
  const { user, authReady, isPreview } = useShop();
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [applications, setApplications] = useState<SellerApplication[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [products, setProducts] = useState<SellerProduct[]>(isPreview ? previewProducts : []);
  const [orders, setOrders] = useState<SellerOrderRecord[]>(isPreview ? previewOrders : []);
  const [loading, setLoading] = useState(!isPreview);
  const [loadedSellerId, setLoadedSellerId] = useState("");
  const [error, setError] = useState("");

  const visibleProfile = user && profile?.email === user.email ? profile : null;
  const visibleApplications = user ? applications : [];
  const sellers = useMemo(() => isPreview ? [previewSeller] :
    visibleProfile?.memberships.map((row) => row.seller).filter((row) => row.status === "APPROVED") ?? [],
  [isPreview, visibleProfile]);
  const seller = sellers.find((row) => row.id === selectedId) ?? sellers[0] ?? null;
  const sellerId = seller?.id;
  const dataLoading = !isPreview && Boolean(sellerId) && loadedSellerId !== sellerId;

  const request = useCallback(async <T,>(path: string, method = "GET", body?: unknown): Promise<T> => {
    if (isPreview) throw new Error("Connect the API to manage real seller data.");
    const current = clientAuth()?.currentUser;
    if (!current) throw new Error("Sign in with your seller account first.");
    return api<T>(path, { token: await current.getIdToken(), method, body });
  }, [isPreview]);

  const refreshProfile = useCallback(async () => {
    if (isPreview) return;
    try {
      const current = clientAuth()?.currentUser;
      if (!current) { setLoading(false); return; }
      await current.reload();
      const token = await current.getIdToken(true);
      const [nextProfile, nextApplications] = await Promise.all([
        api<SellerProfile>("/auth/me", { token }),
        api<SellerApplication[]>("/seller-applications/me", { token }),
      ]);
      setProfile(nextProfile);
      setApplications(nextApplications);
      setError("");
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setLoading(false); }
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
    if (!sellerId || isPreview) return;
    setProducts(await request<SellerProduct[]>(`/sellers/${sellerId}/products`));
  }, [sellerId, isPreview, request]);

  const refreshOrders = useCallback(async () => {
    if (!sellerId || isPreview) return;
    setOrders(await request<SellerOrderRecord[]>(`/sellers/${sellerId}/orders`));
  }, [sellerId, isPreview, request]);

  useEffect(() => {
    if (!sellerId || isPreview) return;
    let active = true;
    Promise.all([
      request<SellerProduct[]>(`/sellers/${sellerId}/products`),
      request<SellerOrderRecord[]>(`/sellers/${sellerId}/orders`),
    ]).then(([nextProducts, nextOrders]) => {
      if (active) { setProducts(nextProducts); setOrders(nextOrders); setLoadedSellerId(sellerId); setError(""); }
    }).catch((cause) => { if (active) { setError(errorMessage(cause)); setLoadedSellerId(sellerId); } });
    return () => { active = false; };
  }, [sellerId, isPreview, request]);

  const value: SellerContext = { seller, sellers, applications: visibleApplications, profile: visibleProfile,
    products: dataLoading ? [] : products, orders: dataLoading ? [] : orders,
    loading, dataLoading, error, isPreview, selectSeller: setSelectedId,
    request, refreshProducts, refreshOrders, refreshProfile };
  return <sellerContext.Provider value={value}>{children}</sellerContext.Provider>;
}

export function useSeller() {
  const value = useContext(sellerContext);
  if (!value) throw new Error("SellerProvider is required.");
  return value;
}
