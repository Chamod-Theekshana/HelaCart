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
import {
  api,
  ApiError,
  apiBase,
  errorMessage,
  hasApi,
  userApi,
} from "@/lib/api";
import type { AccountProfile } from "@/lib/profile";
import { demoCart } from "@/lib/demo";
import {
  clientAuth,
  hasFirebase,
  signOutClient,
  subscribeToAuth,
} from "@/lib/firebase";
import {
  guestCartView,
  maxGuestLines,
  maxLineQuantity,
  readGuestCart,
  subscribeToGuestCart,
  writeGuestCart,
  type GuestProductState,
} from "@/lib/guest-cart";
import type { Cart, GuestCartLine, Product } from "@/lib/types";
import { useT } from "./language-provider";

type DemoItem = { productId: string; quantity: number };
/** Result of moving guest cart lines into the signed-in buyer's cart. */
export type CartMergeNotice = {
  uid: string;
  merged: number;
  unavailable: number;
  capped: number;
};
type ShopContext = {
  user: User | null;
  authReady: boolean;
  cart: Cart | null;
  /** Total units in the cart shown in the header. */
  cartCount: number;
  /** True when `cart` is the browser-only cart of a signed-out or unverified shopper. */
  isGuestCart: boolean;
  isPreview: boolean;
  cartLoading: boolean;
  cartError: string;
  cartNotice: CartMergeNotice | null;
  dismissCartNotice: () => void;
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

/** Public product lookup for a guest cart line. */
function fetchGuestProduct(productId: string): Promise<GuestProductState> {
  return api<Product>(`/products/${encodeURIComponent(productId)}`)
    .then((product): GuestProductState => product)
    .catch(
      (cause): GuestProductState =>
        cause instanceof ApiError && [400, 404, 410].includes(cause.status)
          ? null
          : "error",
    );
}

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const t = useT();
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
  const merging = useRef<Promise<void> | null>(null);
  const [demoItems, setDemoItems] = useState<DemoItem[]>(initialDemo);
  const [guestLines, setGuestLines] = useState<GuestCartLine[]>([]);
  const [guestReady, setGuestReady] = useState(false);
  const [guestProducts, setGuestProducts] = useState<
    Record<string, GuestProductState | undefined>
  >({});
  const [cartNotice, setCartNotice] = useState<CartMergeNotice | null>(null);
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
  // Signed-out and not-yet-verified shoppers keep a browser cart until a
  // verified sign-in merges it into their account.
  const isGuestCart = !isPreview && authReady && !user?.emailVerified;
  const setAccountProfile = useCallback((profile: AccountProfile) => {
    setProfileState({ uid: profile.firebaseUid, profile, error: "" });
  }, []);
  const refreshAccountProfile = useCallback(async () => {
    const current = clientAuth()?.currentUser;
    if (!current || isPreview) return;
    try {
      const profile = await userApi<AccountProfile>(current, "/auth/me");
      setProfileState({ uid: current.uid, profile, error: "" });
    } catch (cause) {
      setProfileState({
        uid: current.uid,
        profile: null,
        error: errorMessage(cause),
      });
    }
  }, [isPreview]);

  useEffect(() => {
    if (isPreview) return;
    const load = () => {
      setGuestLines(readGuestCart());
      setGuestReady(true);
    };
    const frame = requestAnimationFrame(load);
    const unsubscribe = subscribeToGuestCart(load);
    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
    };
  }, [isPreview]);

  // Live public product data for guest lines (price, stock, availability).
  const missingProducts = useMemo(
    () =>
      isGuestCart
        ? [
            ...new Set(
              guestLines
                .map((line) => line.productId)
                .filter((id) => guestProducts[id] === undefined),
            ),
          ]
        : [],
    [isGuestCart, guestLines, guestProducts],
  );
  const requestedProducts = useRef(new Set<string>());
  useEffect(() => {
    for (const productId of missingProducts) {
      if (requestedProducts.current.has(productId)) continue;
      requestedProducts.current.add(productId);
      void fetchGuestProduct(productId).then((value) => {
        requestedProducts.current.delete(productId);
        setGuestProducts((before) =>
          before[productId] === undefined
            ? { ...before, [productId]: value }
            : before,
        );
      });
    }
  }, [missingProducts]);
  // refreshCart() for a guest re-reads live data without blanking the cart.
  const [guestRefresh, setGuestRefresh] = useState(0);
  useEffect(() => {
    if (!guestRefresh) return;
    let active = true;
    for (const productId of new Set(
      readGuestCart().map((line) => line.productId),
    ))
      void fetchGuestProduct(productId).then((value) => {
        if (active)
          setGuestProducts((before) => ({ ...before, [productId]: value }));
      });
    return () => {
      active = false;
    };
  }, [guestRefresh]);

  const liveCart = user && cartState?.uid === user.uid ? cartState.value : null;
  const guestCart = useMemo(
    () => (isGuestCart ? guestCartView(guestLines, guestProducts) : null),
    [isGuestCart, guestLines, guestProducts],
  );
  const cart = useMemo(
    () => (isPreview ? demoCart(demoItems) : (guestCart ?? liveCart)),
    [isPreview, demoItems, guestCart, liveCart],
  );
  const cartCount = isGuestCart
    ? guestLines.reduce((sum, line) => sum + line.quantity, 0)
    : (cart?.items.reduce((sum, row) => sum + row.quantity, 0) ?? 0);
  const cartLoading =
    !isPreview &&
    (!authReady ||
      (isGuestCart
        ? !guestReady || missingProducts.length > 0
        : Boolean(
            user?.emailVerified &&
            (cartState?.uid !== user.uid || cartState?.loading),
          )));
  const cartError = isPreview
    ? ""
    : isGuestCart
      ? guestLines.some((line) => guestProducts[line.productId] === "error")
        ? t("cart.guestLoadError")
        : ""
      : user && cartState?.uid === user.uid
        ? cartState.error
        : "";

  /** Moves browser-cart lines into the verified buyer's server cart, once. */
  const mergeGuestCart = useCallback(async (current: User) => {
    if (merging.current) return merging.current;
    const lines = readGuestCart();
    if (!lines.length) return;
    merging.current = (async () => {
      const server = await userApi<Cart>(current, "/me/cart");
      let merged = 0,
        unavailable = 0,
        capped = 0;
      const retry: GuestCartLine[] = [];
      for (const line of lines) {
        const existing =
          server.items.find((item) => item.variantId === line.variantId)
            ?.quantity ?? 0;
        const target = Math.min(maxLineQuantity, existing + line.quantity);
        if (target < existing + line.quantity) capped++;
        if (target <= existing) continue;
        try {
          await userApi(current, `/me/cart/items/${line.variantId}`, {
            method: "PUT",
            body: { quantity: target },
          });
          merged++;
        } catch (cause) {
          // 4xx: sold out, hidden, suspended shop or invalid line. Auth,
          // rate-limit and network problems keep the line for the next refresh.
          if (
            cause instanceof ApiError &&
            cause.status < 500 &&
            ![401, 403, 429].includes(cause.status)
          )
            unavailable++;
          else retry.push(line);
        }
      }
      // Lines added in another tab while merging are kept for the next pass.
      const added = readGuestCart().filter(
        (row) => !lines.some((line) => line.variantId === row.variantId),
      );
      writeGuestCart([...retry, ...added]);
      if (merged || unavailable || capped)
        setCartNotice({ uid: current.uid, merged, unavailable, capped });
    })().finally(() => {
      merging.current = null;
    });
    return merging.current;
  }, []);

  const refreshCart = useCallback(
    async (options?: { checkoutCompleted?: boolean }) => {
      if (isPreview) return;
      const auth = clientAuth();
      const current = auth?.currentUser;
      const sequence = ++cartRequest.current;
      if (!current?.emailVerified) {
        setCartState(null);
        // Reload live product data for the browser cart.
        setGuestRefresh((value) => value + 1);
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
        await mergeGuestCart(current).catch(() => undefined);
        const next = await userApi<Cart>(current, "/me/cart");
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
    [isPreview, mergeGuestCart],
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

  function addToGuestCart(
    product: Product,
    variantId: string,
    quantity: number,
  ) {
    const variant = product.variants.find((row) => row.id === variantId);
    if (!variant) throw new Error(t("cart.error.unavailable"));
    const lines = readGuestCart();
    const existing = lines.find((line) => line.variantId === variantId);
    const nextQuantity = (existing?.quantity ?? 0) + quantity;
    if (nextQuantity > maxLineQuantity)
      throw new Error(t("cart.error.max", { max: maxLineQuantity }));
    if (nextQuantity > variant.availableQuantity)
      throw new Error(
        t("cart.error.onlyAvailable", { count: variant.availableQuantity }),
      );
    if (!existing && lines.length >= maxGuestLines)
      throw new Error(t("cart.error.tooManyLines", { max: maxGuestLines }));
    setGuestProducts((before) => ({ ...before, [product.id]: product }));
    writeGuestCart(
      existing
        ? lines.map((line) =>
            line.variantId === variantId
              ? { ...line, quantity: nextQuantity }
              : line,
          )
        : [...lines, { productId: product.id, variantId, quantity }],
    );
  }

  async function addToCart(product: Product, variantId: string, quantity = 1) {
    if (!Number.isInteger(quantity) || quantity < 1)
      throw new Error(t("cart.error.max", { max: maxLineQuantity }));
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
    const signedIn = clientAuth()?.currentUser;
    if (!signedIn) return addToGuestCart(product, variantId, quantity);
    const uid = signedIn.uid;
    return queueCart(async () => {
      const current = clientAuth()?.currentUser;
      if (!current || current.uid !== uid)
        throw new Error(t("cart.error.accountChanged"));
      if (!current.emailVerified) {
        // Only an unverified cached user is reloaded; a fresh verification
        // needs one forced token refresh so the API sees email_verified.
        await current.reload();
        if (!current.emailVerified)
          return addToGuestCart(product, variantId, quantity);
        await current.getIdToken(true);
        await refreshCart().catch(() => undefined);
      }
      const latest = await userApi<Cart>(current, "/me/cart");
      const nextQuantity =
        (latest.items.find((item) => item.variantId === variantId)?.quantity ??
          0) + quantity;
      if (nextQuantity > maxLineQuantity)
        throw new Error(t("cart.error.max", { max: maxLineQuantity }));
      await userApi(current, `/me/cart/items/${variantId}`, {
        method: "PUT",
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
    if (isGuestCart) {
      const capped = Math.min(
        Math.max(0, Math.floor(quantity)),
        maxLineQuantity,
      );
      writeGuestCart(
        readGuestCart().flatMap((line) =>
          line.variantId !== variantId
            ? [line]
            : capped > 0
              ? [{ ...line, quantity: capped }]
              : [],
        ),
      );
      return;
    }
    const uid = clientAuth()?.currentUser?.uid;
    if (!uid) throw new Error(t("cart.error.signInAgain"));
    return queueCart(async () => {
      const current = clientAuth()?.currentUser;
      if (!current || current.uid !== uid)
        throw new Error(t("cart.error.accountChanged"));
      await userApi(
        current,
        `/me/cart/items/${variantId}`,
        quantity > 0
          ? { method: "PUT", body: { quantity } }
          : { method: "DELETE" },
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
    setCartNotice(null);
  }

  return (
    <context.Provider
      value={{
        user,
        authReady,
        cart,
        cartCount,
        isGuestCart,
        isPreview,
        cartLoading,
        cartError,
        cartNotice:
          cartNotice && cartNotice.uid === user?.uid ? cartNotice : null,
        dismissCartNotice: () => setCartNotice(null),
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
