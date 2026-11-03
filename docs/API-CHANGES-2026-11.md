# HelaCart API changes — November 2026 hardening release

This is the shared contract between `helacart-api`, `helacart-storefront` and
`helacart_buyer_mobile_app` for the November 2026 release. Everything is under
the global prefix `/api/v1`. Money is always integer LKR minor units (cents).
Out of scope for this release: online payments, seller payouts and courier
API integration.

Error bodies keep the Nest shape `{ statusCode, message, error }`. Where a
client must branch on a specific failure, the body also carries a stable
machine-readable `code` string (listed below). Clients must not parse
`message`.

Every response carries an `x-request-id` header. Clients may send their own
`x-request-id` (≤ 64 chars `[A-Za-z0-9-_]`), which the API echoes back.

---

## 1. Order lifecycle

### 1.1 New seller-order statuses

`SellerOrderStatus` gains two values:

| Status | Meaning |
| --- | --- |
| `DELIVERY_FAILED` | Courier could not deliver (refused, unreachable, wrong address). Parcel is still out. |
| `RETURNED_TO_SELLER` | Parcel came back to the seller. Terminal. Stock is restored. No commission. |

Full state machine (actor in brackets):

```
PLACED ──accept[S]──▶ ACCEPTED ──pack[S]──▶ PACKED ──ship[S]──▶ SHIPPED
  │                      │                     │                  │
  └──cancel[S,B,A,auto]──┴──────cancel[S,A]────┘                  ├─deliver[S: paymentCollected=true | B: confirm-receipt | A]──▶ DELIVERED
                                                                  ├─delivery failed[S,A]──▶ DELIVERY_FAILED
                                                                  └─cancel[A only]──▶ CANCELLED
DELIVERY_FAILED ──reattempt (ship again)[S]──▶ SHIPPED
DELIVERY_FAILED ──returned[S,A]──▶ RETURNED_TO_SELLER   (stock restored)
DELIVERY_FAILED ──deliver[A]──▶ DELIVERED
DELIVERY_FAILED ──cancel[A]──▶ CANCELLED                (stock restored)
```

S = seller member, B = buyer, A = admin, auto = background job.
Stock is restored on every transition into `CANCELLED` or `RETURNED_TO_SELLER`.
Commission accrues only on transition into `DELIVERED`.

`SellerOrder` gains `statusReason: string | null` and `statusChangedAt: string`
(ISO). Every seller-order object returned anywhere (buyer orders, seller
orders, admin orders, workspace lists) includes these two fields.
`SellerOrderEvent` gains `reason: string | null`.

### 1.2 Seller status change (existing route, extended)

`PATCH /sellers/:sellerId/orders/:sellerOrderId/status`

Body `SellerOrderStatusDto`:

```json
{
  "status": "ACCEPTED|PACKED|SHIPPED|DELIVERED|CANCELLED|DELIVERY_FAILED|RETURNED_TO_SELLER",
  "paymentCollected": true,          // only with DELIVERED (required true)
  "courierName": "Domex",            // with SHIPPED (unchanged)
  "trackingNumber": "AB123",         // with SHIPPED (unchanged)
  "reason": "Customer refused parcel" // 5..500 chars; REQUIRED for CANCELLED, DELIVERY_FAILED, RETURNED_TO_SELLER
}
```

`SHIPPED` is allowed from `PACKED` and from `DELIVERY_FAILED` (re-attempt).

### 1.3 Buyer cancel (existing route, optional body)

`PATCH /me/orders/:orderId/seller-orders/:sellerOrderId/cancel`
Body (optional): `{ "reason": "Ordered by mistake" }` (5..500 chars).

### 1.4 Buyer confirms receipt (new)

`POST /me/orders/:orderId/seller-orders/:sellerOrderId/confirm-receipt`
Body: `{}`. Allowed only from `SHIPPED`. Moves to `DELIVERED`, sets
`paymentCollectedAt`, accrues commission, notifies the seller.
Returns the updated buyer order (same shape as `GET /me/orders/:orderId`).

### 1.5 Admin order actions (new)

`POST /admin/orders/:sellerOrderId/actions` (AdminGuard)

```json
{ "action": "CANCEL|MARK_DELIVERY_FAILED|MARK_RETURNED|MARK_DELIVERED", "reason": "5..500 chars" }
```

| action | allowed from |
| --- | --- |
| `CANCEL` | PLACED, ACCEPTED, PACKED, SHIPPED, DELIVERY_FAILED |
| `MARK_DELIVERY_FAILED` | SHIPPED |
| `MARK_RETURNED` | DELIVERY_FAILED, SHIPPED |
| `MARK_DELIVERED` | SHIPPED, DELIVERY_FAILED |

Returns the updated admin seller-order row. Writes an admin audit-log entry.
409 when the transition is not allowed.

`GET /admin/orders/attention?days=7&cursor=<id>&limit=20` (AdminGuard) —
seller orders that need intervention: `SHIPPED` or `DELIVERY_FAILED` with
`statusChangedAt` older than `days` (1..60, default 7), plus `PLACED` older than
the auto-cancel window minus 6 hours. Response `{ items: AdminSellerOrder[], nextCursor: string | null }`.

### 1.6 Auto-cancel

`PLACED` seller orders not accepted within `SELLER_ACCEPT_HOURS` (env, default
48) are cancelled by a worker with reason `"Seller did not accept the order in
time"`. Buyer and seller are notified.

---

## 2. Commission integrity

`PATCH /admin/products/:productId/approve` accepts an optional body
`{ "commissionRateBps": 0..10000 }`.

When the platform commission policy is enabled and the product has no
commission rate, approval without `commissionRateBps` fails with
409 `code: "COMMISSION_RATE_REQUIRED"`. When supplied, the rate is saved with a
`ProductCommissionChange` history record in the same transaction.

---

## 3. COD fraud controls

### 3.1 Phone verification (SMS OTP via Notify.lk)

`POST /me/phone-verifications` body `{ "phone": "+94771234567" }`
→ `201 { "verificationId": uuid, "phone": "+94771234567", "expiresAt": iso, "resendAfter": iso }`
Rate: 1 per phone per 60 s, 5 per user per hour. 429 `code: "OTP_RATE_LIMITED"`.
Phone is normalised to E.164 `+947XXXXXXXX` (Sri Lankan mobile numbers only:
`07XXXXXXXX`, `7XXXXXXXX`, `947XXXXXXXX`, `+947XXXXXXXX`). Invalid → 400 `code: "PHONE_INVALID"`.

`POST /me/phone-verifications/:verificationId/confirm` body `{ "code": "123456" }`
→ `200 { "phone": "+94771234567", "verifiedAt": iso }`.
6 digits, valid 10 min, max 5 attempts. Wrong → 400 `code: "OTP_INVALID"`;
expired/used up → 410 `code: "OTP_EXPIRED"`.

`GET /me/verified-phones` → `[{ "phone": "+94771234567", "verifiedAt": iso }]`

Every address object (`GET /me/addresses`, etc.) gains
`phoneVerified: boolean` and `isDefault: boolean`.

When SMS is not configured and `NODE_ENV !== 'production'`, the code is written
to the API log instead of being sent (dev only).

### 3.2 Checkout checks

`POST /me/orders/checkout` can now also fail with:

| HTTP | code | when |
| --- | --- | --- |
| 409 | `PHONE_NOT_VERIFIED` | `REQUIRE_PHONE_VERIFICATION=true` and the address phone is not verified by this user |
| 409 | `TOO_MANY_OPEN_ORDERS` | buyer already has `MAX_OPEN_COD_ORDERS` (default 5) seller orders in PLACED..SHIPPED/DELIVERY_FAILED |
| 400 | `COD_LIMIT_EXCEEDED` | order total above `MAX_COD_ORDER_LKR_MINOR` (default 50,000,000 = LKR 500,000) |
| 409 | `SELLER_SUSPENDED` | a cart item belongs to a suspended shop |

`GET /me/cart` quote response gains `checkoutBlockers: string[]` holding any of
the codes above that are already known before checkout (so the UI can show
them early).

---

## 4. Addresses

`PATCH /me/addresses/:addressId` body: any subset of the `AddressDto` fields
plus `isDefault?: boolean` → updated address. Setting `isDefault: true` clears
the flag on the user's other addresses. Changing `phone` recomputes
`phoneVerified`. Past orders keep their own snapshot and are not changed.

---

## 5. Seller suspension

`GET /admin/sellers?status=APPROVED|SUSPENDED|PENDING|REJECTED&q=text&cursor=<id>&limit=20`
→ `{ items: [{ id, name, slug, status, isVerified, createdAt, statusReason, productCount, openOrderCount }], nextCursor }`

`PATCH /admin/sellers/:sellerId/status` body
`{ "status": "SUSPENDED" | "APPROVED", "reason": "5..500 chars" }` → the seller row.
Only APPROVED ↔ SUSPENDED transitions. Writes an audit-log entry and notifies
the seller's members.

Effects of `SUSPENDED`: products disappear from public catalog/search/shop
pages, cart lines become unavailable, checkout fails with `SELLER_SUSPENDED`,
all seller write routes return 403 `code: "SELLER_SUSPENDED"`; read routes keep
working so the seller can still fulfil/cancel existing orders — **exception:**
order status changes, shipment updates and support replies stay allowed for
existing orders.

`GET /auth/me` membership entries gain `sellerStatus` and `statusReason`.

---

## 6. Seller team roles

`OWNER`-only (MANAGER gets 403 `code: "OWNER_ONLY"`):
delivery settings (`PUT`/`PATCH /sellers/:id/delivery-settings`), refund
submissions, commission payment submissions/receipts, team management, shop
profile/business details edits.
`GET /auth/me` memberships already contain `role`; clients hide owner-only
actions for managers.

---

## 7. Notifications: email, SMS, push

Every in-app notification may now also be delivered by email (Resend), SMS
(Notify.lk) and push (FCM via firebase-admin), through a database outbox
(`NotificationDelivery`) processed by a worker with retries.

Default channel matrix (user preferences can switch channels off):

| Type | Push | Email | SMS |
| --- | --- | --- | --- |
| ORDER_PLACED (to seller) | ✓ | ✓ | ✓ |
| ORDER_UPDATED / ORDER_TRACKING_UPDATED (to buyer) | ✓ | ✓ | ✓ for SHIPPED, DELIVERY_FAILED, CANCELLED only |
| RETURN_*, REFUND_UPDATED, SUPPORT_UPDATED | ✓ | ✓ | – |
| SELLER_STATUS_CHANGED (new type) | ✓ | ✓ | – |
| others | ✓ | – | – |

New `NotificationType` value: `SELLER_STATUS_CHANGED`.

`POST /me/devices` body `{ "token": "<fcm token>", "platform": "android|ios|web", "appVersion": "1.1.0" }` → `{ "id": uuid }` (upsert by token).
`POST /me/devices/unregister` body `{ "token": "<fcm token>" }` → `204`.

Push payload `data`: `{ "notificationId", "type", "href" }` (`href` is the
same relative path as in-app, e.g. `/orders?order=<id>`).

`GET /me/notification-preferences` → `{ "push": true, "email": true, "sms": true }`
`PUT /me/notification-preferences` same body → same.

---

## 8. Account deletion and data export (PDPA No. 9 of 2022)

`GET /me/data-export` → `application/json` attachment
(`Content-Disposition: attachment; filename="helacart-data-<date>.json"`)
with profile, addresses, orders, returns, reviews, favorites, support cases
and notifications of the caller.

`DELETE /me/account` body `{ "confirm": "DELETE" }` → `204`.
Fails 409 with `code`:
- `ACCOUNT_HAS_OPEN_ORDERS` — any of the user's seller orders is PLACED..SHIPPED or DELIVERY_FAILED, or a return is PENDING/APPROVED.
- `ACCOUNT_OWNS_SHOP` — user is OWNER of a non-rejected shop.

Effect: personal data is anonymised (name, phone, email → `deleted-<id>@deleted.helacart.invalid`, avatar removed, addresses deactivated and blanked, devices removed, cart/favorites removed), order and ledger rows are kept for accounting, the Firebase user is deleted, access status set to `DELETED`.

---

## 9. App configuration (force update + legal links)

`GET /app-config` (public, cacheable 5 min) →

```json
{
  "android": { "minimumVersion": "1.0.0", "latestVersion": "1.1.0", "storeUrl": "https://play.google.com/store/apps/details?id=com.helacart.buyer" },
  "ios": { "minimumVersion": "1.0.0", "latestVersion": "1.1.0", "storeUrl": "https://apps.apple.com/app/id0000000000" },
  "legal": { "privacyUrl": "https://helacart.lk/legal/privacy", "termsUrl": "https://helacart.lk/legal/terms", "returnsUrl": "https://helacart.lk/legal/returns" },
  "support": { "email": "support@helacart.lk", "phone": "+94..." }
}
```

Values come from env (`APP_*`, `LEGAL_*`, `SUPPORT_*`). Web hosts the legal
pages at `/legal/privacy`, `/legal/terms`, `/legal/returns`.

---

## 10. Admin audit log

`GET /admin/audit-log?cursor=<id>&limit=50&action=<string>` →
`{ items: [{ id, actorId, actorEmail, action, subjectType, subjectId, reason, details, createdAt }], nextCursor }`

Actions written: `ORDER_CANCEL`, `ORDER_MARK_DELIVERY_FAILED`,
`ORDER_MARK_RETURNED`, `ORDER_MARK_DELIVERED`, `SELLER_SUSPEND`,
`SELLER_REINSTATE`, `PRODUCT_APPROVE`, `PRODUCT_REJECT`, `CATEGORY_CREATE`,
`CATEGORY_UPDATE`, `HERO_UPDATE`, `ACCOUNT_ACCESS_CHANGE`,
`COMMISSION_RATE_CHANGE`.

---

## 11. Rate limiting

- Server-to-server calls from the Next.js storefront send
  `x-helacart-internal: <INTERNAL_API_TOKEN>`. Matching requests skip the
  per-IP general bucket (they still go through auth).
- Requests with a bearer token are bucketed by `ip + hash(token subject)` for
  write limits, with a 5× higher per-IP ceiling, so many buyers behind one
  carrier NAT do not block each other.
- All limits are configurable through env (`RATE_LIMIT_*`).

---

## 12. Product images

`imageUrls` on product create/update must be URLs on `R2_PUBLIC_BASE_URL`
(the upload endpoint's domain). Others → 400 `code: "IMAGE_URL_NOT_ALLOWED"`.
Uploaded JPEG/PNG/WebP files have EXIF/GPS and text metadata stripped before
storage (product, shop, review photos, profile photos, seller documents).

---

## Backend implementation notes

Recorded by the API implementation (helacart-api, 2026-11-01). Everything above
is implemented as written except where noted here; items marked *clarification*
pick one reading of an unspecified detail.

1. **Event actor (§1.1).** `SellerOrderEvent.actorUserId` is now nullable: it is
   `null` for background transitions (auto-cancel). Clients that display the
   actor must handle `null` ("HelaCart").
2. **Buyer cancel (§1.1, §1.3).** Buyers may cancel only while the seller order
   is PLACED (unchanged rule; sellers and admins cover later states). Without a body the
   stored `statusReason` is `"Cancelled by the buyer"`.
3. **Status codes (§1.4, §1.5).** `confirm-receipt` and
   `POST /admin/orders/:id/actions` return `200` (not `201`). A disallowed
   transition returns 409 with the extra code `ORDER_TRANSITION_NOT_ALLOWED`.
   Buyer receipt confirmation stores `statusReason: "Buyer confirmed receipt"`.
4. **Reasons (§1.2).** `reason` is optional for statuses that do not require it;
   when given it is stored as `statusReason`. `statusReason` is cleared (null)
   on a later transition without a reason.
5. **Existing rows.** `statusChangedAt` was backfilled from each order's latest
   event (or `createdAt`). On first deploy, PLACED orders older than
   `SELLER_ACCEPT_HOURS` are auto-cancelled within ~5 minutes.
6. **Addresses (§4, clarification).** `POST /me/addresses` also accepts
   `isDefault`; a user's first address becomes the default automatically, and
   deleting the default promotes the most recent remaining address. In PATCH,
   `line2: null` clears the second line; `null` for other fields is rejected.
7. **Phone verification (§3.1).** In production without Notify.lk configured,
   `POST /me/phone-verifications` returns 503. A malformed code (not 6 digits)
   counts as an attempt and returns `OTP_INVALID`. SMS for other notifications
   uses the user's most recently verified phone, then the profile phone, then
   (for shop owners) the shop contact phone.
8. **Suspension (§5).** Besides support replies, a suspended shop may also open
   new support cases. Commission payment submissions and refund submissions are
   blocked (`SELLER_SUSPENDED`), as written. `/auth/me` memberships carry
   `sellerStatus`/`statusReason` at the membership level and `seller.statusReason`.
9. **Owner-only (§6).** Shop logo/cover image upload/removal are treated as shop
   profile edits (owner-only). Commission receipt *viewing* is owner-only too.
10. **Notifications (§7, clarification).** "Others" in the matrix includes
    `ORDER_UPDATED`/`ORDER_TRACKING_UPDATED` sent to sellers and admins (push
    only) and the buyer's own `ORDER_PLACED` confirmation (push only).
    Preferences are applied when a message is sent, so turning a channel off
    also suppresses queued messages. FCM tokens reported as unregistered or
    invalid are deleted. A device token registered by another account moves to
    the caller; at most 20 devices are kept per user.
11. **Data export (§8).** Notifications are limited to the latest 5,000;
    support-case messages include only those written by the caller.
12. **Account deletion (§8).** Review rows keep their `buyerName` snapshot (the
    product-review integrity trigger forbids changing it). Shop manager
    memberships are removed with a team-history entry. The body must be exactly
    `{ "confirm": "DELETE" }` (400 otherwise).
13. **App config (§9).** `support.phone` is `""` when `SUPPORT_PHONE` is unset.
14. **Rate limiting (§11).** Bearer requests are also bucketed by
    ip + subject (with the 5x per-IP ceiling) for the general bucket, not only
    write buckets, so shared carrier NATs are not throttled by read traffic. The
    subject is read from the unverified JWT payload only for bucketing.
15. **Product images (§12).** When `R2_PUBLIC_BASE_URL` is not configured,
    development/test accept any https `imageUrls`; production rejects them all
    with `IMAGE_URL_NOT_ALLOWED`. Commission receipts and storefront content
    images are also metadata-stripped.
16. **Extra error code.** A second pending seller application returns 409
    `APPLICATION_ALREADY_PENDING`.
17. **Return restock (backend item).** `PATCH /admin/returns/:id/resolve`
    accepts optional `restock: boolean`; it is rejected (400) with outcome
    `REPLACED`. There is no seller-side resolve route.

### Lead review adjustments

- `TOO_MANY_OPEN_ORDERS` counts the seller orders this checkout would open:
  it is raised when `open + shopsInCart > MAX_OPEN_COD_ORDERS`.
- The verified-token cache is never used on admin paths (`/admin/**`,
  `/workspace/admin/**`); those requests always re-check revocation.
- Buyers may cancel only while a seller order is `PLACED` (unchanged rule).
