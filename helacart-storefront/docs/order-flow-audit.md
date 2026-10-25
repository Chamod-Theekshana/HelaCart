# Order flow audit

The audit covers cart → COD checkout → per-shop fulfilment → COD reconciliation → returns and in-app notifications. The existing storefront theme is retained.

## Changes

- Cart rows include the real shop name, shop link, product image and delivery fee. Delivery is charged once per shop. Loading failures have a retry action and are not displayed as an empty cart.
- Cart state and order confirmations are scoped to the signed-in Firebase user. Stale requests cannot display another account's cart or order details.
- Cart mutations are serialized in the client. Adding an item reads the current server quantity first. Product actions wait for authentication restoration.
- `GET /me/cart` returns `checkoutQuote`. Checkout requires this quote together with `addressId` and `checkoutKey`. The quote covers sorted cart contents, quantities, prices, product details and shop delivery fees. A changed quote returns 409 before stock or order writes, so the buyer can review the new totals.
- The checkout intent is saved in per-user session storage before submission. An uncertain response can be retried after reload using the same key, address and quote, even if checkout already cleared the cart. Reusing the key with different checkout details returns 409. If browser storage is unavailable, recovery is limited to the current page.
- Confirmation navigation does not depend on a successful background cart refresh. Stock deduction, order creation, inventory movements, notifications and cart clearing remain one database transaction.
- Serializable checkout retries handle Prisma transaction conflicts and PostgreSQL serialization/deadlock errors from raw stock updates. Exhausted contention returns 409.
- Order and operations transactions allow 15 seconds for remote database round trips. Cancellation restores only the cancelled shop's stock, once.
- The seller's COD-collected checkbox is tied to one seller order, including when search/filter changes select another order automatically.
- COD reconciliation cannot reopen a settled collection when audit timestamps tie. Return resolution notifies both the buyer and the shop owner.

## Verification

Backend unit and HTTP tests run with Vitest. `helacart-api/scripts/verify-order-flow.mjs` exercises the actual services and PostgreSQL records, including concurrent last-item checkout, cancellation and same-key retries. `verify-order-races.mjs` runs those three races separately.

Database audit scripts create a unique `helacart_order_audit_<hex>` schema, replay the project migrations, verify the active schema before seeding, and remove that schema in `finally`. They do not seed or change customer records in the public schema. A local browser audit uses real application providers, API validation and isolated database records; only Firebase token verification is replaced with fixture identities.

The completed run passed 77 unit tests, 151 HTTP tests, 18 real database checks and the three focused concurrency checks. The browser audit passed 96 checks with zero runtime exceptions, including checkout recovery after reload, account switching, seller COD confirmation after search selection changes, reconciliation, return approval/resolution and seller notifications. Cart, checkout, confirmation, seller order details and admin COD/return screens fit 1440, 768, 390 and 320 pixel viewports. TypeScript, lint checks and both production builds passed. Audit servers were stopped, temporary schemas were removed and normal Firebase authentication was restored in the audit source copy.

## Scope

Payments in this flow are cash on delivery. Return resolution records the reviewed outcome; it does not automatically issue a monetary refund or restock returned goods. Notifications are in-app. No payment gateway, courier integration, email/SMS delivery or seller payout processing is added by this audit.

Deploy the API and storefront changes together because the checkout request now requires the cart quote. Orders remain readable; retrying a checkout created by an older API contract may require viewing that order in the account instead.
