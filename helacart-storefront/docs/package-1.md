# Package 1: complete lists and buyer order follow-up

Implemented 21 October 2026. No database migration or new credentials are required.

## Buyer

- Account order history has server pagination, status filters and search by recipient or order reference, including the short displayed UUID reference.
- A buyer can cancel only their own `PLACED` seller order. Confirmation explains that the other sellers in a multi-seller order stay unchanged. The existing transactional cancellation restores inventory, records a status event and sends existing in-app notifications. Accepted orders, repeated cancellation and a concurrent status change are rejected by the API.
- The original checkout total remains a historical snapshot. Buyer and admin order details separately show the value excluding cancelled deliveries.
- `/account/returns` and the account Returns tab show submitted requests, purchased items, shop information, approval/rejection dates, decision notes and recorded resolution. Creating a request opens this tracking view. Orders with an existing request link to its progress instead of offering another request.
- This package displays the existing manual return decisions. Item-wise refunds, exchanges, courier tracking and actual money transfers remain later packages.
- Notifications are paginated. Account counters use database-wide counts scoped to the signed-in buyer, independent of the current order/notification page. Saved addresses retain their existing maximum of 20.

## Seller

- Products, variant inventory and orders fetch pages from the server. Search and filters apply before pagination across all matching records, including records older than the former 50-row limit.
- Product status/category/stock filters and order status filters reset paging. Product CSV export is explicitly labelled as exporting the current page.
- Product, order and inventory counters use aggregate queries across the seller's entire store. Category choices come from all categories represented in the store, rather than only the current product page.
- The overview fetches aggregate counters, five recent orders and four low-stock variants. SellerProvider no longer downloads capped product/order arrays globally. Existing editor refresh actions invalidate the paginated resources and counters.

## Admin

- Seller applications, products, orders, returns and COD collections use server pagination and search. Seller application searches include the owner email. Order searches include recipient, district, seller and order references.
- Dashboard counters and order-status counters use platform-wide aggregates. Counts do not depend on loaded queue lengths. Order status counts count seller orders; the total-orders counter counts parent checkout orders.
- Existing moderation, return and reconciliation mutations remain guarded by the verified admin allowlist and revocation checks. Queue reads are also guarded.

## Public catalog

- Category, text, price, stock and sorting apply to the entire catalog before paging. Filter values live in the URL, so pages can be refreshed/shared without losing them. Invalid or inverted price ranges produce a validation message.
- Listing price is the first available variant by position, falling back to the first variant or product price when unavailable. The same value is used for database filtering/sorting and the displayed product-card price. Stock requires `onHand > reserved`.
- Only approved products from approved sellers in active categories are visible. User input stays parameterized; sort clauses come from a fixed allowlist. Count, page and hydration queries share a repeatable-read snapshot.

## API

- `GET /api/v1/catalog/products`
- `GET /api/v1/workspace/me/{orders,returns,notifications,summary}`
- `GET /api/v1/workspace/sellers/:sellerId/{products,inventory,orders,summary}`
- `GET /api/v1/workspace/admin/{seller-applications,products,orders,returns,cod,summary}`

Lists return `{ items, total, page, pageSize, pages }`. Default page size is 20 and the maximum is 50. Seller queries check membership before reads, buyer queries derive identity from the verified token, and admin queries require administrator access. New read routes send `Cache-Control: no-store`. Legacy array/cursor endpoints remain for compatibility; the updated application screens use the new read routes.

Read snapshots allow 15 seconds, matching the existing commerce transaction budget. This avoids the default five-second transaction expiry observed during the live database check.

## Validation

- 55 unit and 97 HTTP tests pass, including the new list boundaries, full counts, query validation, public visibility, parameterized catalog filters and cancellation ownership/state/race handling.
- `helacart-api/scripts/verify-package1.mjs` runs after an API build. It creates over 60 products/orders/returns/applications in one temporary development-database transaction and always rolls it back. Fifteen checks passed for older pages, variant-price filtering, stock, counters, return history and restoring cancelled inventory exactly once. Cleanup was verified; customer records were not changed.
- Thirteen screens were checked at seven viewport widths (91 checks), with no document overflow. Existing table and tab regions intentionally scroll internally. Twenty preview/navigation assertions passed.
- Twenty-seven authenticated browser assertions passed against isolated mocked accounts and requests. These cover cancellation confirmation/conflicts, return submission/history, older buyer/seller/admin/COD pages, search resets and counters independent of visible rows. No browser runtime exceptions remained.
- TypeScript, API lint and production builds pass. The modified storefront screens retain their pre-existing raw-image lint warnings; targeted logic/hooks lint has no errors.
- Live API checks returned 200 for readiness, paginated catalog and stock/price sorting; unauthenticated account reads returned 401. The running storefront returned 200 for `/products` and `/account/returns`.

Ignored browser artifacts are in `.next/package1-review`. Temporary browser fixtures are removed from the isolated source copy after verification.
