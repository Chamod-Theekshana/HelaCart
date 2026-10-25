"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { User } from "firebase/auth";
import { api, apiBase, errorMessage, hasApi } from "@/lib/api";
import type { AccountProfile } from "@/lib/profile";
import { demoCart } from "@/lib/demo";
import {
  clientAuth,
  hasFirebase,
  signOutClient,
  subscribeToAuth,
} from "@/lib/firebase";
import type { Cart, Product } from "@/lib/types";

type DemoItem = { productId: string; quantity: number };
type ShopContext = {
  user: User | null;
  authReady: boolean;
  cart: Cart | null;
  isPreview: boolean;
  cartLoading: boolean;
  cartError: string;
  accountProfile: AccountProfile | null;
  profileLoading: boolean;
  profileError: string;
  profilePhotoUrl: string;
  refreshAccountProfile: () => Promise<void>;
  setAccountProfile: (profile: AccountProfile) => void;
  refreshCart: (options?: { checkoutCompleted?: boolean }) => Promise<void>;
  addToCart: (
    product: Product,
    variantId: string,
    quantity?: number,
  ) => Promise<void>;
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
  const [cartState, setCartState] = useState<{
    uid: string;
    value: Cart | null;
    loading: boolean;
    error: string;
  } | null>(null);
  const cartRequest = useRef(0);
  const cartQueue = useRef<Promise<unknown>>(Promise.resolve());
  const [demoItems, setDemoItems] = useState<DemoItem[]>(initialDemo);
  const [profileState, setProfileState] = useState<{
    uid: string;
    profile: AccountProfile | null;
    error: string;
  } | null>(null);
  const [photoState, setPhotoState] = useState<{
    key: string;
    url: string;
  } | null>(null);
  const accountProfile =
    user && profileState?.uid === user.uid ? profileState.profile : null;
  const profileError =
    user && profileState?.uid === user.uid ? profileState.error : "";
  const photoKey = `${user?.uid}:${accountProfile?.photoVersion}`;
  const profilePhotoUrl =
    accountProfile?.hasPhoto && photoState?.key === photoKey
      ? photoState.url
      : "";
  const profileLoading =
    !isPreview && Boolean(user) && profileState?.uid !== user?.uid;
  const setAccountProfile = useCallback((profile: AccountProfile) => {
    setProfileState({ uid: profile.firebaseUid, profile, error: "" });
  }, []);
  const refreshAccountProfile = useCallback(async () => {
    const current = clientAuth()?.currentUser;
    if (!current || isPreview) return;
    try {
      const profile = await api<AccountProfile>("/auth/me", {
        token: await current.getIdToken(),
      });
      setProfileState({ uid: current.uid, profile, error: "" });
    } catch (cause) {
      setProfileState({
        uid: current.uid,
        profile: null,
        error: errorMessage(cause),
      });
    }
  }, [isPreview]);
  const liveCart = user && cartState?.uid === user.uid ? cartState.value : null;
  const cart = useMemo(
    () => (isPreview ? demoCart(demoItems) : liveCart),
    [isPreview, demoItems, liveCart],
  );
  const cartLoading =
    !isPreview &&
    (!authReady ||
      Boolean(
        user?.emailVerified &&
        (cartState?.uid !== user.uid || cartState?.loading),
      ));
  const cartError =
    !isPreview && user && cartState?.uid === user.uid ? cartState.error : "";

  const refreshCart = useCallback(
    async (options?: { checkoutCompleted?: boolean }) => {
      if (isPreview) return;
      const auth = clientAuth();
      const current = auth?.currentUser;
      const sequence = ++cartRequest.current;
      if (!current?.emailVerified) {
        setCartState(null);
        return;
      }
      const uid = current.uid;
      setCartState((previous) => ({
        uid,
        value: options?.checkoutCompleted
          ? null
          : previous?.uid === uid
            ? previous.value
            : null,
        loading: true,
        error: "",
      }));
      try {
        const next = await api<Cart>("/me/cart", {
          token: await current.getIdToken(),
        });
        if (auth?.currentUser?.uid === uid && cartRequest.current === sequence)
          setCartState({ uid, value: next, loading: false, error: "" });
      } catch (cause) {
        if (auth?.currentUser?.uid === uid && cartRequest.current === sequence)
          setCartState((previous) => ({
            uid,
            value: previous?.uid === uid ? previous.value : null,
            loading: false,
            error: errorMessage(cause),
          }));
        throw cause;
      }
    },
    [isPreview],
  );

  useEffect(() => {
    const auth = clientAuth();
    if (!auth) return;
    return subscribeToAuth((current) => {
      setUser(current);
      setAuthReady(true);
      if (current && !isPreview) void refreshAccountProfile();
      else setProfileState(null);
      if (!isPreview) void refreshCart().catch(() => undefined);
    });
  }, [isPreview, refreshAccountProfile, refreshCart]);

  useEffect(() => {
    if (!user || !accountProfile?.hasPhoto || isPreview) return;
    let active = true;
    let objectUrl = "";
    user
      .getIdToken()
      .then((token) =>
        fetch(`${apiBase}/auth/me/photo?v=${accountProfile.photoVersion}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: AbortSignal.timeout(15000),
        }),
      )
      .then(async (response) => {
        if (!response.ok) throw new Error("Photo unavailable");
        const blob = await response.blob();
        if (active) {
          objectUrl = URL.createObjectURL(blob);
          setPhotoState({ key: photoKey, url: objectUrl });
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [
    user,
    accountProfile?.hasPhoto,
    accountProfile?.photoVersion,
    isPreview,
    photoKey,
  ]);

  async function addToCart(product: Product, variantId: string, quantity = 1) {
    if (isPreview) {
      setDemoItems((rows) => {
        const found = rows.find((row) => row.productId === product.id);
        return found
          ? rows.map((row) =>
              row.productId === product.id
                ? { ...row, quantity: Math.min(100, row.quantity + quantity) }
                : row,
            )
          : [...rows, { productId: product.id, quantity }];
      });
      return;
    }
    const uid = clientAuth()?.currentUser?.uid;
    if (!uid) throw new Error("Sign in to add items to your cart.");
    return queueCart(async () => {
      const current = clientAuth()?.currentUser;
      if (!current || current.uid !== uid)
        throw new Error("Your account changed. Try again.");
      await current.reload();
      if (!current.emailVerified)
        throw new Error("Verify your email before shopping.");
      const token = await current.getIdToken(true);
      const latest = await api<Cart>("/me/cart", { token });
      const nextQuantity =
        (latest.items.find((item) => item.variantId === variantId)?.quantity ??
          0) + quantity;
      if (!Number.isInteger(quantity) || quantity < 1 || nextQuantity > 100)
        throw new Error("You can add up to 100 of each item to your cart.");
      await api(`/me/cart/items/${variantId}`, {
        method: "PUT",
        token,
        body: { quantity: nextQuantity },
      });
      await refreshCart().catch(() => undefined);
    });
  }
  async function setQuantity(variantId: string, quantity: number) {
    if (isPreview) {
      setDemoItems((rows) =>
        rows.flatMap((row) => {
          if (
            `preview-variant-${row.productId.replace("preview-", "")}` !==
            variantId
          )
            return [row];
          return quantity > 0
            ? [{ ...row, quantity: Math.min(quantity, 100) }]
            : [];
        }),
      );
      return;
    }
    const uid = clientAuth()?.currentUser?.uid;
    if (!uid) throw new Error("Please sign in again.");
    return queueCart(async () => {
      const current = clientAuth()?.currentUser;
      if (!current || current.uid !== uid)
        throw new Error("Your account changed. Try again.");
      const token = await current.getIdToken();
      await api(
        `/me/cart/items/${variantId}`,
        quantity > 0
          ? { method: "PUT", token, body: { quantity } }
          : { method: "DELETE", token },
      );
      await refreshCart().catch(() => undefined);
    });
  }
  function queueCart(task: () => Promise<void>) {
    const next = cartQueue.current.catch(() => undefined).then(task);
    cartQueue.current = next;
    return next;
  }
  async function signOutBuyer() {
    await signOutClient();
    cartRequest.current++;
    setCartState(null);
    setProfileState(null);
  }

  return (
    <context.Provider
      value={{
        user,
        authReady,
        cart,
        isPreview,
        cartLoading,
        cartError,
        accountProfile,
        profileLoading,
        profileError,
        profilePhotoUrl,
        refreshAccountProfile,
        setAccountProfile,
        refreshCart,
        addToCart,
        setQuantity,
        signOutBuyer,
      }}
    >
      {children}
    </context.Provider>
  );
}
export function useShop() {
  const value = useContext(context);
  if (!value) throw new Error("ShopProvider is required.");
  return value;
}
