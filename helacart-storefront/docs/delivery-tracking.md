# Delivery rates, tracking and order notifications

Seller Center → Delivery Settings (`/seller/settings`) supports a standard fee, per-district overrides and unavailable districts, an optional merchandise threshold for free delivery, and an optional delivery estimate of 1–60 calendar days after dispatch. Unlisted districts use the standard fee. Free delivery never overrides an unavailable destination. Existing shop fees are preserved during migration; no new offer or estimate is enabled automatically.

Checkout requests `GET /api/v1/me/cart?addressId=…` for an address belonging to the signed-in buyer. It shows each shop's destination fee and estimate. The quote includes the address and delivery configuration; a changed cart, rate or address requires a refreshed quote. Delivery is charged once per shop. Orders retain immutable delivery fees and estimates after settings change. Cart and shop pages describe standard/estimated fees, with final destination pricing at checkout.

Seller order dispatch records a courier/delivery-service name and optional tracking reference. A shop using its own delivery can leave the reference blank. Tracking corrections require a reason and version; the original dispatch date is preserved and changes remain in an append-only audit. Buyer and admin order screens show these details and delivery progress. Status updates are entered by the seller; estimated dates use the saved range, and no external courier integration is configured by this feature.

The buyer, seller and admin headers have an account-scoped notification inbox, unread count, read-all and refresh controls. It refreshes every 60 seconds while visible and when the window gains focus. New order/status/tracking/cancellation notifications link to their orders. Existing commission and return notifications link to their relevant workspace. Notifications are in-app database records.

Key API additions:

- `GET /me/cart?addressId=…` — authenticated destination quote.
- `GET /sellers/:sellerId/delivery-settings` and `PUT` to the same route — own shop settings and version-checked updates. The previous flat-fee `PATCH` remains supported and also advances the revision.
- `PATCH /sellers/:sellerId/orders/:sellerOrderId/shipment` — version-checked tracking correction while shipped.
- `PATCH …/status` accepts courier details when marking an order shipped. Older shipped orders can add tracking later.
- `GET /me/notifications/inbox`, `PATCH /me/notifications/read-all` — private, account-scoped inbox controls.

Migration `20261026040000_delivery_tracking_notifications` is additive and was applied to the development database. Validation included 127 unit tests, 242 HTTP tests, 11 isolated PostgreSQL checks and 56 browser form checks. The database audit removes its disposable schema and sends no external messages. Browser mock accounts and routes are confined to the ignored audit source copy and removed after testing.
