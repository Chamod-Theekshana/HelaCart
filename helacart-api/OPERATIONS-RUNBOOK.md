# HelaCart COD pilot operations

## Release to a staging environment

1. Back up or branch the Neon database and confirm the restoration procedure in
   its dashboard. Keep the previous application build available for rollback.
2. Set runtime environment values from `.env.example` in your hosting provider:
   pooled DATABASE_URL, Firebase project, R2 bucket credentials and public URL,
   admin UID allowlist, allowed CORS origins, HOST=0.0.0.0, and NODE_ENV=production.
   Set GOOGLE_APPLICATION_CREDENTIALS to a mounted secret file, or use the
   platform's application default credentials. Never bake a private key into an image.
3. From a migration job with full dependencies and the direct database URL, run
   `npm ci`, `npm run db:status`, then `npm run db:deploy`. Apply migrations
   once per release. Do not run migrate reset or migrate dev on staging/production.
4. Build the image with `docker build -t helacart-api:pilot .` and start it in
   your hosting provider. Expose it only behind HTTPS. The image starts the API;
   it deliberately does not run migrations.
5. Probe `/api/v1/health/ready`, then test a verified buyer, seller and admin
   against staging. Create a low-cost COD order, upload one product image, and
   check notifications, return review and COD reconciliation using test records.
6. Review logs for errors, monitor database connection/CPU, and confirm the R2
   public custom domain serves the uploaded image.

## Security and traffic

`TRUST_PROXY_HOPS=0` is the safe default. Set it to `1` only when exactly one
trusted reverse proxy is in front of the API **and direct access to the API is
blocked**. This makes Express use the client's address for the per-process
request limit. Use an edge or shared-store rate limit on Cloudflare/ingress when
running multiple API replicas. The built-in limit is 180 requests per minute
per address; write attempts to checkout, returns and image upload share a
20-per-minute limit (both configurable with `RATE_LIMIT_*`). Requests with a
bearer token are bucketed per address **and** token subject, with a per-address
ceiling of `RATE_LIMIT_AUTHENTICATED_IP_MULTIPLIER` (default 5) times the limit,
so buyers behind one mobile-carrier NAT do not block each other. Set the same
`INTERNAL_API_TOKEN` on the API and the Next.js storefront server so its
server-side calls skip the general per-address bucket. Never log bearer tokens
or private credentials.

Set `RETURN_WINDOW_DAYS` to your published policy before taking real orders;
the default is 14 calendar days from the seller order delivery event. The
admin reviews return requests and records manual resolution; agree how actual
refunds/replacements, reverse logistics and shipping fees will be handled.

## Daily admin queue

### Seller identity verification

New seller applications use `multipart/form-data` with `identityDocumentType`
(`NATIONAL_ID` or `DRIVING_LICENCE`), required `identityFront` and `identityBack`
photos, and an optional `businessRegistration` photo. Each file must be JPEG,
PNG or WebP and at most 5 MB. The existing store fields are unchanged.

Deploy migration `20261021000000_seller_verification_documents` before releasing
the updated API. Existing approved sellers are unaffected. Older pending
applications without identity photos cannot be approved under the new rule;
review them and request a new complete application before granting access.

Set `R2_PRIVATE_BUCKET` to a separate private bucket that the API credentials
can read/write. Keep its `r2.dev` URL and custom domains disabled. Do not set
it to the public product image bucket. An optional setup helper,
`node scripts/setup-private-documents.mjs`, creates a fresh private bucket,
checks object access using a non-sensitive temporary object, and saves the
bucket name in the local `.env` without changing credentials. It requires an
R2 token with bucket creation and object permissions.

Application responses contain document metadata only. Authorized administrators
retrieve photos from `GET /api/v1/admin/seller-applications/:id/documents/:documentId`.
The endpoint requires a verified administrator token and returns `private,
no-store` image bytes; the admin UI uses temporary blob previews. Storage keys,
public document URLs and original file names are not exposed. Do not log image
bytes or tokens. Restrict access to the private bucket in the hosting account.

Reference: [Cloudflare bucket access defaults](https://developers.cloudflare.com/r2/buckets/create-buckets/)
and [S3 operation support](https://developers.cloudflare.com/r2/api/s3/api/).

### Orders and settlement

- Review `GET /api/v1/admin/returns/page?status=PENDING&limit=20`; pass the
  returned `nextCursor` as `cursor` to read the following page.
- Sellers collect buyer COD payments and pay HelaCart commission separately.
  Assign rates individually under `/admin/commission` → Product rates.
  Unassigned products remain inactive; there is no common percentage.
  Configure payment days and bank details under `/admin/settings`. The default
  commission due date is delivery plus 14 days; future orders snapshot changes.
  Existing orders retain their rates and terms and are not back-charged.
- Open returns automatically hold commission. Use **Hold payment** on an order
  charge to pause every charged item in that shop order for unresolved refunds,
  returns or disputes. A manual release cannot bypass an open return case and
  retains the original due date. Keep the required hold/release reason specific.
- Review submitted commission receipts against the actual bank account, then
  confirm or reject the payment with a recorded note. A receipt does not itself
  reduce the seller's balance. Do not record the full buyer COD amount as a
  HelaCart commission payment.
- Monthly account statements, per-shop balances and overdue reminders are in
  the same workspace. Record commission credit only for a verified merchandise
  refund; resolving a return may instead represent a replacement and does not
  automatically create a refund or credit.
- Legacy COD reconciliation records and API endpoints remain for compatibility.
  The `/admin/cod` screen is now a read-only seller-collection view. Legacy
  records do not settle commission. See
  [the commission guide](../helacart-storefront/docs/seller-commission.md).
- Recount stock when physical stock differs and record seller stock adjustments
  with the actual reason. Periodically review return and stock movement history.

## Item returns, refunds and support

Review item quantities in `/admin/returns`; purchased quantities and return values
come from immutable order snapshots. Verify actual seller refunds in
`/admin/refunds` before confirming records. Pending records reserve refund budgets
and hold commission; verification creates applicable original-rate commission
credit. Refund-record corrections preserve the original evidence and reverse the
linked credit rather than deleting history.

Use `/admin/support` for private case conversations and versioned decisions.
An order-linked case can hold commission until its review completes. Closing one
case releases only that case's hold. Return resolution records full/partial
verified refund, replacement or another agreed outcome; it does not transfer
money. Tick **restock** (`restock: true`) only after the returned units are
physically back and sellable; this appends an inventory movement per item and
cannot be repeated for the same return. See the
[after-sales guide](../helacart-storefront/docs/after-sales.md).

## Product feedback and account access

Before public launch, review `/admin/product-review-reports` for reported product
feedback and record hide/dismiss decisions with specific reasons. Product review
moderation excludes hidden ratings from the public summary and preserves the
reported text snapshot. Review seller brand, specification and warranty text in
the existing product approval dialog.

Use `/admin/accounts` to suspend/restore an account after investigation. This
blocks authenticated buyer and seller access without changing existing orders,
refund records or financial balances. Administrator accounts are protected from
this UI; privileges remain controlled by `ADMIN_FIREBASE_UIDS`. Shop owners
manage manager grants/revocations at `/seller/team`, with recorded reasons.
See [product feedback and permissions](../helacart-storefront/docs/product-feedback-and-permissions.md).

## Bulk tools, stock alerts and reports

Bulk tools at `/seller/bulk-tools` and `/admin/bulk-tools` require saved previews,
reasons and confirmation. A stale or invalid row rejects the whole batch. Reuse
the original job ID when recovering from an interrupted apply request; an
already-applied job is returned without applying the change twice.

The stock-alert worker runs within the API about once a minute. Keep an API
instance running for automatic in-app alerts. Dirty stock-watch rows are retained
if a worker fails and are retried on the next tick. Multiple API instances use
row locking to avoid duplicate alert episodes. The migration establishes a quiet
baseline for existing variants rather than notifying every low-stock shop.

Review `/admin/reports` for marketplace delivery/refund activity and commission
accrual/collections. COD sales remain seller money. Report dates use Sri Lanka
time; receipts/refunds use verification dates and corrections use their own
recording date. See [bulk tools and reports](../helacart-storefront/docs/bulk-stock-and-business-reports.md).

## Discovery and promotions

Review seller offers at `/admin/promotions`. Approved discounts activate only
within their saved dates and use the strongest product offer without stacking.
Checkout saves the original price and applied offer; cancellation does not
rewrite historical orders, commission snapshots or refund caps. Favorite alerts
are opt-in and use an internal bounded worker while the API is running. Inspect
worker warnings if notifications stop, and retry after connectivity recovers.
See [discovery and promotions](../helacart-storefront/docs/search-recommendations-and-promotions.md).

## Recovery and rollout limits

All migrations are forward-only. Rolling back a deployed application does not
roll back database changes. Verify the prior build can read the expanded schema
before rolling back; restore from a tested database backup if a destructive
rollback is ever required. Health readiness checks database connectivity; use
`npm run db:status` to check migration state. Keep Cloudflare R2 credentials,
Neon credentials and Firebase service accounts rotated and restricted.

This package does not operate your bank account, shipping company, hosting
platform, monitoring service or backups. Their live checks and policy choices
must be completed by the operator before public launch.

## November 2026 hardening release

### Deploying this release

1. Take a backup (see below) or create a Neon branch first.
2. Apply the three new migrations with `npm run db:deploy`, in order:
   `20261101000000_hardening_enum_values` (enum values only; PostgreSQL cannot
   use new enum values in the same transaction), `20261101010000_hardening_release`
   (order lifecycle columns, address defaults, phone verification, notification
   outbox, devices, preferences, audit log) and
   `20261101020000_search_trigram_indexes` (`CREATE EXTENSION pg_trgm` plus GIN
   indexes; on a large catalogue run it in a quiet period — plain `CREATE INDEX`
   blocks writes to the indexed table while it builds).
3. Set the new environment values (all have safe defaults unless noted):

   | Variable | Purpose |
   | --- | --- |
   | `DATABASE_POOL_SIZE` | pg pool per process (default 10). Keep replicas x size under the Neon pooler limit; every running worker tick holds one connection while it runs. |
   | `AUTH_TOKEN_CACHE_SECONDS` | Verified Firebase token cache (0-60, default 60; 0 in tests). Revocation can take up to this long to apply; suspension/deletion apply immediately. |
   | `LOG_LEVEL` | `debug` adds debug/verbose lines to production JSON logs. |
   | `INTERNAL_API_TOKEN` | Shared secret for storefront server-to-server calls (`x-helacart-internal`); 32+ characters in production. |
   | `RATE_LIMIT_GENERAL_PER_MINUTE`, `RATE_LIMIT_WRITE_PER_MINUTE`, `RATE_LIMIT_CONTENT_PER_MINUTE`, `RATE_LIMIT_AUTHENTICATED_IP_MULTIPLIER` | Request limits (180 / 20 / 30 / 5). |
   | `SELLER_ACCEPT_HOURS` | PLACED orders not accepted within this window are auto-cancelled (default 48, min 12). |
   | `MAX_OPEN_COD_ORDERS` | Open seller orders a buyer may hold before checkout is refused (default 5). |
   | `MAX_COD_ORDER_LKR_MINOR` | Largest COD order total in cents (default 50,000,000 = LKR 500,000). |
   | `REQUIRE_PHONE_VERIFICATION` | `true` requires an OTP-verified delivery phone at checkout (needs Notify.lk in production). |
   | `NOTIFY_LK_USER_ID`, `NOTIFY_LK_API_KEY`, `NOTIFY_LK_SENDER_ID` | Notify.lk SMS — all three or none. |
   | `OTP_SECRET` | HMAC key for OTP codes; required (32+ chars) when SMS is configured. Rotating it invalidates codes in flight only. |
   | `RESEND_API_KEY`, `RESEND_FROM` | Resend email — both or none; the sender domain must be verified in Resend. |
   | `PUSH_NOTIFICATIONS_ENABLED` | FCM push through the existing Firebase Admin credentials (default true). |
   | `RESERVATIONS_ENABLED` | Keep `false`; enables the unused inventory-reservation expiry loop. |
   | `APP_ANDROID_*`, `APP_IOS_*` (`MIN_VERSION`, `LATEST_VERSION`, `STORE_URL`) | `GET /api/v1/app-config` force-update data. Raise `*_MIN_VERSION` to force an upgrade. |
   | `APP_WEB_BASE_URL` | Web origin used for links in notification emails. |
   | `LEGAL_PRIVACY_URL`, `LEGAL_TERMS_URL`, `LEGAL_RETURNS_URL`, `SUPPORT_EMAIL`, `SUPPORT_PHONE` | Legal links and support contact served to the apps. |

   In production `CORS_ORIGINS` must be https origins. Configuration errors stop
   the process at start-up with the offending variable names (never values).
4. On the first start after the deploy the auto-cancel worker cancels PLACED
   orders older than `SELLER_ACCEPT_HOURS` within about five minutes, restoring
   their stock and notifying buyers and sellers. Review
   `GET /api/v1/admin/orders/attention` beforehand if you want to contact those
   sellers first, or raise `SELLER_ACCEPT_HOURS` temporarily.

### Background workers

All workers run inside every API process but each tick first takes a
PostgreSQL advisory lock (`pg_try_advisory_xact_lock`, held by a short-lived
holder transaction), so only one replica runs a given tick. Failures are logged
at error level with the worker name and retried on the next tick.

| Worker | Interval | Lock key | Work |
| --- | --- | --- | --- |
| `DiscoveryWorker` | 60 s | 731001 | Favorite price-drop/restock alerts |
| `StockAlertsWorker` | 60 s | 731002 | Low/out-of-stock seller alerts |
| `ReservationExpiryService` | 60 s | 731003 | Only when `RESERVATIONS_ENABLED=true` |
| `NotificationDeliveryWorker` | 15 s | 731004 | Email/SMS/push outbox with retries (1 min, 5 min, 15 min, 1 h, then FAILED) |
| `OrderAutoCancelWorker` | 5 min | 731005 | Cancels unaccepted PLACED orders |

Check delivery health with
`SELECT channel, status, count(*) FROM "NotificationDelivery" WHERE "createdAt" > now() - interval '1 day' GROUP BY 1, 2;`.
`SKIPPED` rows record why nothing was sent (preference off, provider not
configured, no device, no phone). A growing `PENDING` backlog means the worker
is not running or a provider is down; `lastError` holds the provider status
(never credentials). To resend after fixing a provider, set the affected
`FAILED` rows back to `PENDING` with `"nextAttemptAt" = now()`.

### Order failure procedures

- **Delivery failed** (courier could not deliver): the seller (or an admin with
  `MARK_DELIVERY_FAILED`) records `DELIVERY_FAILED` with a reason. The buyer is
  notified, including by SMS. The seller either re-ships (`SHIPPED` again,
  optionally with new courier details; the original dispatch date is kept) or
  records `RETURNED_TO_SELLER` when the parcel is back, which restores stock.
- **Parcel back at the shop**: `RETURNED_TO_SELLER` (seller from
  DELIVERY_FAILED; admin `MARK_RETURNED` from SHIPPED or DELIVERY_FAILED).
  Stock is restored and no commission is charged.
- **Delivered but the seller did not mark it**: the buyer can confirm receipt
  in the app (SHIPPED → DELIVERED). Otherwise an admin uses `MARK_DELIVERED`
  after confirming with the courier; this sets the COD collection time and
  accrues commission exactly as a seller delivery would.
- **Fraud or unreachable seller**: admin `CANCEL` (allowed up to SHIPPED and
  DELIVERY_FAILED) with a specific reason; stock is restored.
- **Stuck orders**: review `GET /api/v1/admin/orders/attention?days=7` daily —
  SHIPPED/DELIVERY_FAILED orders unchanged for `days`, and PLACED orders within
  six hours of auto-cancellation.
- Every admin action needs a 5-500 character reason and is written to the
  append-only audit log (`GET /api/v1/admin/audit-log`), together with seller
  suspensions, product decisions, category/hero edits, account access changes
  and commission rate changes.

### Seller suspension

`PATCH /api/v1/admin/sellers/:id/status` moves a shop between APPROVED and
SUSPENDED with a reason; members are notified. A suspended shop disappears from
the public catalogue, search and shop pages, its cart lines become unavailable
and checkout returns `SELLER_SUSPENDED`. The shop can still read its workspace,
change order statuses, update shipments and reply to support cases so existing
orders are completed; all other seller writes return 403 `SELLER_SUSPENDED`.

### COD fraud controls and phone verification

OTP codes are six digits, valid 10 minutes, five attempts, one request per
number per minute and five per account per hour. Only an HMAC of each code is
stored. Without Notify.lk outside production the code is printed to the API log
("DEV ONLY"); production refuses to send codes until SMS is configured. Decide
`MAX_OPEN_COD_ORDERS`, `MAX_COD_ORDER_LKR_MINOR` and whether to enable
`REQUIRE_PHONE_VERIFICATION` with your pilot sellers; the cart reports the
same blockers before checkout.

### Account deletion requests (PDPA)

Buyers export their data from `GET /api/v1/me/data-export` and delete their
account with `DELETE /api/v1/me/account`. Deletion is refused while orders or
returns are open or while the user owns a non-rejected shop (transfer or close
the shop through support first). Orders, ledgers, reviews and audit rows are
retained for accounting; profile, phone, email, avatar, addresses, devices,
cart and favorites are anonymised or removed and the Firebase user is deleted.
If the Firebase deletion fails, the account is still blocked (`DELETED`); the
error is logged with the internal user id — delete that Firebase user manually
in the console.

### Observability

Every response carries `x-request-id` (a client-supplied id of up to 64
`[A-Za-z0-9_-]` characters is echoed). In production logs are one JSON object
per line, including a `request completed` line per request (method, path
without query string, status, duration). Every 5xx is logged with the request
id; ask users or client logs for the id when investigating. Database errors
are returned as safe 4xx messages (unique conflicts 409, missing records 404,
integrity-trigger rejections 409, check violations 400).

### Backups and restore drills

Neon keeps point-in-time history for its retention window; also take
independent logical backups before every migration and on a schedule:

```bash
# DIRECT_URL = the non-pooled Neon connection string
npm run db:backup                    # writes backups/helacart-<UTC>.dump
node scripts/backup-db.mjs /secure/backups
```

The script uses `pg_dump --format=custom` (install the PostgreSQL 17 client
tools), passes credentials through PG* variables rather than the command line,
sets the file to mode 600 and verifies it with `pg_restore --list`. Copy the
file to encrypted storage outside the host; it contains personal data, so apply
the same retention and deletion rules as the database.

Restore drill (at least monthly and before launch):

1. Create an empty database, e.g. a new Neon branch reset to empty or a local
   `docker run --rm -e POSTGRES_PASSWORD=drill -p 5433:5432 postgres:17`.
2. `pg_restore --no-owner --no-privileges --exit-on-error -d "<restore URL>" helacart-<UTC>.dump`
   (`pg_trgm` is recreated from the archive; the role needs CREATE on the database).
3. Point a staging API at it (`DIRECT_URL`/`DATABASE_URL`), run
   `npm run db:status` (must report no pending migrations) and probe
   `/api/v1/health/ready`.
4. Spot-check counts of orders, seller orders and commission charges against
   production, open a recent order in the admin UI, and record the drill date,
   backup age and restore duration in the operations log.
5. Delete the drill database.
