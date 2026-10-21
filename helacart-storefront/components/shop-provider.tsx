"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { api, apiBase, errorMessage, hasApi } from "@/lib/api";
import type { AccountProfile } from "@/lib/profile";
import { demoCart } from "@/lib/demo";
import { clientAuth, hasFirebase } from "@/lib/firebase";
import type { Cart, Product } from "@/lib/types";

type DemoItem = { productId: string; quantity: number };
type ShopContext = {
  user: User | null; authReady: boolean; cart: Cart | null; isPreview: boolean;
  accountProfile: AccountProfile | null; profileLoading: boolean; profileError: string; profilePhotoUrl: string;
  refreshAccountProfile: () => Promise<void>;
  setAccountProfile: (profile: AccountProfile) => void;
  refreshCart: () => Promise<void>;
  addToCart: (product: Product, variantId: string, quantity?: number) => Promise<void>;
  setQuantity: (variantId: string, quantity: number) => Promise<void>;
  signOutBuyer: () => Promise<void>;
};
const context = createContext<ShopContext | null>(null);
const initialDemo: DemoItem[] = [
  { productId: "preview-1", quantity: 1 },
  { productId: "preview-2", quantity: 1 },
  { productId: "preview-3", quantity: 1 },
];

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const isPreview = !hasApi;
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!hasFirebase);
  const [liveCart, setLiveCart] = useState<Cart | null>(null);
  const [demoItems, setDemoItems] = useState<DemoItem[]>(initialDemo);
  const [profileState, setProfileState] = useState<{ uid: string; profile: AccountProfile | null; error: string } | null>(null);
  const [photoState, setPhotoState] = useState<{ key: string; url: string } | null>(null);
  const accountProfile = user && profileState?.uid === user.uid ? profileState.profile : null;
  const profileError = user && profileState?.uid === user.uid ? profileState.error : "";
  const photoKey = `${user?.uid}:${accountProfile?.photoVersion}`;
  const profilePhotoUrl = accountProfile?.hasPhoto && photoState?.key === photoKey ? photoState.url : "";
  const profileLoading = !isPreview && Boolean(user) && profileState?.uid !== user?.uid;
  const setAccountProfile = useCallback((profile: AccountProfile) => {
    setProfileState({ uid: profile.firebaseUid, profile, error: "" });
  }, []);
  const refreshAccountProfile = useCallback(async () => {
    const current = clientAuth()?.currentUser;
    if (!current || isPreview) return;
    try {
      const profile = await api<AccountProfile>("/auth/me", { token: await current.getIdToken() });
      setProfileState({ uid: current.uid, profile, error: "" });
    } catch (cause) {
      setProfileState({ uid: current.uid, profile: null, error: errorMessage(cause) });
    }
  }, [isPreview]);
  const cart = useMemo(() => isPreview ? demoCart(demoItems) : liveCart, [isPreview, demoItems, liveCart]);

  const refreshCart = useCallback(async () => {
    if (isPreview) return;
    const auth = clientAuth();
    if (!auth?.currentUser?.emailVerified) { setLiveCart(null); return; }
    setLiveCart(await api<Cart>("/me/cart", { token: await auth.currentUser.getIdToken() }));
  }, [isPreview]);

  useEffect(() => {
    const auth = clientAuth();
    if (!auth) return;
    return onAuthStateChanged(auth, (current) => {
      setUser(current);
      setAuthReady(true);
      if (current && !isPreview) void refreshAccountProfile();
      else setProfileState(null);
      if (current?.emailVerified && !isPreview) {
        current.getIdToken().then((token) => api<Cart>("/me/cart", { token }))
          .then(setLiveCart).catch(() => setLiveCart(null));
      } else setLiveCart(null);
    });
  }, [isPreview, refreshAccountProfile]);

  useEffect(() => {
    if (!user || !accountProfile?.hasPhoto || isPreview) return;
    let active = true;
    let objectUrl = "";
    user.getIdToken().then((token) => fetch(`${apiBase}/auth/me/photo?v=${accountProfile.photoVersion}`, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(15000),
    })).then(async (response) => {
      if (!response.ok) throw new Error("Photo unavailable");
      const blob = await response.blob();
      if (active) {
        objectUrl = URL.createObjectURL(blob);
        setPhotoState({ key: photoKey, url: objectUrl });
      }
    }).catch(() => undefined);
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [user, accountProfile?.hasPhoto, accountProfile?.photoVersion, isPreview, photoKey]);

  async function addToCart(product: Product, variantId: string, quantity = 1) {
    if (isPreview) {
      setDemoItems((rows) => {
        const found = rows.find((row) => row.productId === product.id);
        return found
          ? rows.map((row) => row.productId === product.id ? { ...row, quantity: Math.min(100, row.quantity + quantity) } : row)
          : [...rows, { productId: product.id, quantity }];
      });
      return;
    }
    const auth = clientAuth();
    if (!auth?.currentUser) throw new Error("Sign in to add items to your cart.");
    await auth.currentUser.reload();
    if (!auth.currentUser.emailVerified) throw new Error("Verify your email before shopping.");
    const existing = liveCart?.items.find((item) => item.variantId === variantId);
    await api(`/me/cart/items/${variantId}`, {
      method: "PUT", token: await auth.currentUser.getIdToken(true),
      body: { quantity: Math.min(100, (existing?.quantity ?? 0) + quantity) },
    });
    await refreshCart();
  }
  async function setQuantity(variantId: string, quantity: number) {
    if (isPreview) {
      setDemoItems((rows) => rows.flatMap((row) => {
        if (`preview-variant-${row.productId.replace("preview-", "")}` !== variantId) return [row];
        return quantity > 0 ? [{ ...row, quantity: Math.min(quantity, 100) }] : [];
      }));
      return;
    }
    const auth = clientAuth();
    if (!auth?.currentUser) throw new Error("Please sign in again.");
    const token = await auth.currentUser.getIdToken();
    await api(`/me/cart/items/${variantId}`,
      quantity > 0 ? { method: "PUT", token, body: { quantity } } : { method: "DELETE", token });
    await refreshCart();
  }
  async function signOutBuyer() {
    const auth = clientAuth();
    if (auth) await signOut(auth);
    setLiveCart(null);
    setProfileState(null);
  }

  return <context.Provider value={{ user, authReady, cart, isPreview,
    accountProfile, profileLoading, profileError, profilePhotoUrl, refreshAccountProfile, setAccountProfile,
    refreshCart, addToCart, setQuantity, signOutBuyer }}>{children}</context.Provider>;
}
export function useShop() {
  const value = useContext(context);
  if (!value) throw new Error("ShopProvider is required.");
  return value;
}
