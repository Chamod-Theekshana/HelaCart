# Backend review and corrections

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
