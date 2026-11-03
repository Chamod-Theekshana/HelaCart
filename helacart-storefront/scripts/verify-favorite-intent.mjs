import assert from "node:assert/strict";
import {
  rememberFavorite,
  readFavoriteIntent,
  clearFavoriteIntent,
  safeSignInDestination,
  signInHref,
} from "../lib/favorites.ts";
const values = new Map();
globalThis.sessionStorage = {
  getItem: (key) => values.get(key) || null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
};
let checks = 0;
const check = (value, name) => {
  assert.ok(value, name);
  checks++;
  console.log("PASS " + name);
};
const product = "d63c76f1-3fe0-4d78-bbad-48c37ad630ad",
  key = "helacart:favorite-intent";
rememberFavorite(product);
clearFavoriteIntent(product, "previous-user");
check(
  values.has(key),
  "A late previous-user action cannot clear a new guest intent",
);
check(
  readFavoriteIntent("buyer").productId === product,
  "The guest product intent survives sign-in",
);
check(
  readFavoriteIntent("other") === null,
  "An intent claimed by one user cannot move to another account",
);
clearFavoriteIntent(product, "other");
check(values.has(key), "Another user cannot clear the claimed intent");
clearFavoriteIntent(product, "buyer");
check(!values.has(key), "Successful save clears the matching intent");
values.set(
  key,
  JSON.stringify({ productId: product, createdAt: Date.now() - 3600001 }),
);
check(
  readFavoriteIntent("buyer") === null && !values.has(key),
  "Expired guest intents are discarded",
);
values.set(key, "not JSON");
check(readFavoriteIntent("buyer") === null, "Malformed storage is ignored");
values.set(
  key,
  JSON.stringify({
    productId: "------------------------------------",
    createdAt: Date.now(),
  }),
);
check(
  readFavoriteIntent("buyer") === null,
  "Malformed product IDs are discarded",
);
for (const path of [
  "/",
  "/favorites",
  "/products/" + product + "?color=navy",
  "/shops/island-store",
  "/shops/island-store#reviews",
  "/admin",
  "/admin/orders",
  "/cart",
  "/checkout",
  "/orders",
  "/orders?order=" + product,
  "/account",
  "/account/security",
  "/account/support?order=1",
  "/seller",
  "/seller/orders",
  "/products",
  "/products?q=tea&page=2",
  "/shops",
  "/legal/privacy",
  "/legal/returns",
])
  check(
    safeSignInDestination(path) === path,
    "Allowed local sign-in destination " + path,
  );
for (const path of [
  "https://example.com",
  "//example.com",
  "/\\example.com",
  "/products\nLocation: evil",
  "/auth?next=/auth",
  "/auth",
  "javascript:alert(1)",
  "http:/example.com",
  "/\texample.com",
  "/products/../auth",
  "/legal/./x/../../auth",
  "/%2F%2Fexample.com",
  "/products/%2e%2e/auth",
  "/%5Cexample.com",
  "/cartx",
  "/legal",
  "/legal/",
  "/accounts",
  "/sellers/x",
  "/order-success?orderId=1",
  "",
  null,
  "/" + "a".repeat(2050),
])
  check(
    safeSignInDestination(path) === "/account",
    "Unsafe or looping destination rejected: " +
      JSON.stringify(path).slice(0, 40),
  );
check(
  signInHref("/checkout") === "/auth?next=%2Fcheckout",
  "Sign-in links encode the return path",
);
check(
  signInHref("/products?q=tea&page=2") ===
    "/auth?next=%2Fproducts%3Fq%3Dtea%26page%3D2",
  "Sign-in links keep the query string",
);
check(
  signInHref("/auth?next=%2Fcart") === "/auth" && signInHref(null) === "/auth",
  "Sign-in links never point back to the auth page",
);
check(
  safeSignInDestination(
    decodeURIComponent(signInHref("/checkout").split("next=")[1]),
  ) === "/checkout",
  "A checkout sign-in returns to checkout",
);
globalThis.sessionStorage = {
  getItem() {
    throw Error("blocked");
  },
  setItem() {
    throw Error("blocked");
  },
  removeItem() {
    throw Error("blocked");
  },
};
rememberFavorite(product);
clearFavoriteIntent(product, "buyer");
check(
  readFavoriteIntent("buyer") === null,
  "Unavailable browser storage does not crash sign-in",
);
console.log(JSON.stringify({ checks }));
