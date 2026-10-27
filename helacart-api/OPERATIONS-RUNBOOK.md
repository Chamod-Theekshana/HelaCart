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
20-per-minute limit. Never log bearer tokens or private credentials.

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
money or automatically restock returned goods. See the
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
