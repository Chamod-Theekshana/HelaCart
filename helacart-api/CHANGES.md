# Backend review and corrections

## November 2026 hardening release (2026-11-01)

Implements the shared contract `../docs/API-CHANGES-2026-11.md` (sections 1-12)
plus backend hardening. Deviations are recorded at the end of that document.

- **Order lifecycle:** `DELIVERY_FAILED` and `RETURNED_TO_SELLER` statuses, one
  state machine (`src/commerce/order-state.ts`) for seller, buyer, admin and
  background transitions, required reasons, `statusReason`/`statusChangedAt` on
  every seller order and `reason` on events. Stock is restored on every
  transition into CANCELLED or RETURNED_TO_SELLER; commission accrues only on
  DELIVERED. New buyer `confirm-receipt`, admin `POST /admin/orders/:id/actions`
  and `GET /admin/orders/attention`; an auto-cancel worker for orders not
  accepted within `SELLER_ACCEPT_HOURS`.
- **Commission integrity:** approval requires a product commission rate while
  the policy is enabled (`COMMISSION_RATE_REQUIRED`), or accepts
  `commissionRateBps` and records the history in the same transaction; bulk
  approval enforces the same rule.
- **COD fraud controls:** Notify.lk SMS OTP verification (HMAC-only storage,
  rate limits), verified phones, checkout limits (`PHONE_NOT_VERIFIED`,
  `TOO_MANY_OPEN_ORDERS`, `COD_LIMIT_EXCEEDED`, `SELLER_SUSPENDED`) and
  `checkoutBlockers` on the cart.
- **Addresses:** `PATCH /me/addresses/:id`, `isDefault` and `phoneVerified`.
- **Seller suspension and roles:** admin shop list and APPROVED<->SUSPENDED
  changes; suspended shops are hidden and their writes return
  `SELLER_SUSPENDED` (order fulfilment, shipments and support stay open);
  owner-only routes return `OWNER_ONLY`; `/auth/me` memberships carry
  `sellerStatus`/`statusReason`.
- **Notifications:** email (Resend), SMS (Notify.lk) and push (FCM) through the
  `NotificationDelivery` outbox, written in the same transaction as each in-app
  notification and delivered by a retrying worker; device registration and
  channel preferences; invalid FCM tokens are removed.
- **PDPA:** data export and account deletion with open-order/shop guards.
- **App configuration, admin audit log, product image domain check and
  EXIF/GPS/text metadata stripping** (pure TypeScript) for every upload.
- **Observability:** `x-request-id`, JSON logs in production, a global exception
  filter mapping Prisma/PostgreSQL errors to safe 4xx responses and logging 5xx
  with the request id; workers log failures.
- **Workers:** every interval worker takes a PostgreSQL advisory lock per tick;
  the reservation expiry loop only runs with `RESERVATIONS_ENABLED=true`.
- **Performance:** cached Firebase token verification (bounded, <= 60 s), admin
  guard reuses the verified identity, read-before-write profile sync,
  `DATABASE_POOL_SIZE`, `pg_trgm` GIN indexes matching the search expressions,
  capped OFFSET browsing.
- **Rate limits:** configurable, per token subject behind shared addresses, and
  `x-helacart-internal` for the storefront server.
- **Other:** one pending seller application per user, optional `restock` when
  resolving a return, category/hero edits audited, public `GET /api/v1` hello
  route removed, stricter environment validation (https CORS in production,
  all-or-nothing providers).
- **Infrastructure:** `.github/workflows/api.yml` (Node 24 checks and a
  PostgreSQL 17 migration job), pinned non-root Docker image with a health
  check, `scripts/backup-db.mjs` and runbook sections for backups, restore
  drills, new settings, workers and order-failure procedures.
- **Migrations:** `20261101000000_hardening_enum_values`,
  `20261101010000_hardening_release`, `20261101020000_search_trigram_indexes`.

Not included: online payments, seller payouts and courier API integration.


## Findings in the uploaded ZIP

The archive contained a standard NestJS starter, not an existing ecommerce API.
Its original build and single unit test passed. Missing functionality was distinguished
from broken functionality.

- Observe was enabled with literal YOUR_APP_KEY / YOUR_APP_SECRET values.
- Neon/Prisma packages, configuration, schema and migrations were absent.
- No environment example or runtime validation existed.
- No database readiness route existed; the only response was Hello World.
- Full project typechecking exposed the starter E2E import of supertest/types,
  which could not resolve under NodeNext.
- Setup documentation was the generic Nest template.
- The test runner used a now-unnecessary vite-tsconfig-paths plugin.

## Changes

Removed placeholder telemetry and unused deployment integration. Preserved the actual
ESM setup instead of mixing the earlier CommonJS instructions into it.
Added pinned Prisma 7.10 dependencies, Neon URL configuration, account/seller schema,
initial migration, shutdown handling, environment validation, /api/v1 routing, security
headers, explicit CORS, DTO validation, and independent liveness/readiness routes.
Corrected the E2E server type import and expanded tests for relevant failure paths.
Added reliable generate/build/start scripts, credential exclusions and Windows guidance.

## Scope

This initial repair established the backend foundation; subsequent milestones added
Firebase authentication and basic seller approval. Product management, checkout,
payment integration, admin UI and mobile app are not implemented. See README.md and
VALIDATION.md.

## Firebase authentication milestone

- Connected the existing AuthModule to the Nest application.
- Consolidated duplicate Firebase initialization into one injectable service.
- Added strict bearer-token parsing and Firebase ID-token verification.
- Added `GET /api/v1/auth/me` with no-store responses.
- Added safe Neon profile upsert from verified Firebase claims.
- Added the `emailVerified` profile snapshot and a forward-only migration.
- Added Firebase project environment validation and safe credential documentation.
- Added HTTP coverage for missing, invalid, email-less and valid identities.

Firebase client registration screens, seller workflows and marketplace features remain
outside this milestone.

## Seller application and admin approval milestone

- Added a forward-only migration for application details and SellerReview decisions.
- Added verified-email application submission and owner-filtered application listing.
- Created sellers with OWNER memberships in one database create operation.
- Added server-configured Firebase UID admin allowlist with verified email and revoked
  token checks; no public role-assignment endpoint.
- Added admin queue filtering and one-time APPROVED/REJECTED decisions, each with an
  audited reviewer record in a transaction; rejection requires a reason.
- Added validation and HTTP tests for permission boundaries, data validation,
  concurrent-review guard conditions and decision audit behavior.
- Removed test credentials copied into the previous README and documented safe
  upgrading without replacing a working `.env` or resetting a database.

Suspension, reapplication, seller team management and a web UI remain future work.

## Product catalog and seller authorization milestone

- Added forward-only Category, Product and ProductReview schema/migration.
- Added validated seller product drafts with per-seller slug/SKU uniqueness and LKR
  minor-unit prices; HTTPS image URLs are references, not hosted uploads.
- Scoped every seller product read to a verified membership; writes also require the
  seller to be APPROVED. Managers and owners can both manage products.
- Added draft submission, admin approve/reject with transactional review records,
  approved-product hiding and automatic unpublishing when an approved product is edited.
- Added public category and product reads that filter seller/category/product status.
- Tested permissions and transitions through HTTP mocks; deployed all migrations and
  exercised a complete product lifecycle against an isolated PGlite PostgreSQL instance.

At that milestone, stock and variants had not yet been implemented.

## Inventory and variants milestone

- Added a forward-only migration that gives each existing product a position-zero
  variant with its original SKU and price; stock starts at zero.
- Added seller-scoped creation and editing of additional SKU, option and price
  combinations; variant edits return products to DRAFT for moderation.
- Preserved the existing product fields and API; editing its default SKU or price
  updates the default variant in the same transaction.
- Added authenticated seller stock adjustments, guarded by available quantity and
  recorded as stock movements with an actor and reason.
- Added public per-variant availability and an internal, idempotent reservation
  service with atomic reserve, release, commit and expiration methods.
- Verified backfill, stock limits, simultaneous reservations, release, commit and
  movement history against an isolated PGlite database; see VALIDATION.md.

Hosted images, buyer cart, checkout, payments and web/mobile UIs remain future work.

## COD commerce milestone

- Added a forward-only migration for buyer addresses, carts, parent and seller
  orders, immutable item/address/price snapshots and fulfillment event history.
- Added seller-configured flat delivery fees, server-calculated cart quotes and
  idempotent checkout keys scoped to the buyer.
- COD checkout updates every stock row and creates all seller orders in one
  serializable database transaction. Insufficient stock rolls back the whole order.
- Added buyer and seller cancellation before shipping with audited stock restoration.
- Added seller status transitions and explicit confirmation of COD collection on
  delivery. Added a bounded reservation expiry loop for future online payments.
- Verified two simultaneous checkouts for one available item using an isolated
  PostgreSQL-compatible database; only one order succeeded.

Online payments, returns, hosted image uploads, notifications, commission,
payouts, courier integration and production deployment remain separate work.

## COD pilot operations milestone

- Added authenticated Cloudflare R2 product image uploads with 5 MiB limit,
  content signature checks, seller authorization and a five-image maximum.
- Added private buyer/seller database notifications generated within order and
  return transactions, plus an authenticated inbox and read operation.
- Added buyer return requests for delivered seller orders and admin approval,
  rejection and manual resolution, preserving reviewer and resolver identities.
- Added append-only COD reconciliation records for delivered/collected orders,
  including disputed partial remittances and a corrected matching entry.
- Added operations migration, endpoint coverage and isolated SQL integration
  scenarios. Live external services and automatic refunds remain out of scope.

## COD pilot launch safeguards

- Added a bounded per-process request guard with an extra limit for sensitive
  writes and an explicit proxy trust setting; ingress limits remain required
  for multiple replicas.
- Enforced a configurable return-request deadline from the recorded delivery
  event, defaulting to 14 days.
- Added cursor-based admin return and COD queues without changing legacy list
  response shapes.
- Added a production Dockerfile, secret-safe build exclusions and a staging,
  remittance, backup and recovery runbook.
