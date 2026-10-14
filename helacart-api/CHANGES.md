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

Suspension, reapplication, seller team management, product routes and a web UI remain
future work.
