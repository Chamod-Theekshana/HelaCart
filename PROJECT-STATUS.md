# HelaCart project status

Assessment date: 2026-10-14

## Implemented in this ZIP

- NestJS API foundation, configuration validation and security headers.
- Prisma 7 with Neon-compatible pooled runtime and direct migration URLs.
- User, Seller and SellerMember account foundation and migrations.
- Health and database-readiness endpoints.
- Firebase Admin initialization and bearer ID-token verification.
- Protected `GET /api/v1/auth/me` with Neon profile synchronization.
- Verified-email seller applications, owner-only application listing and atomic owner
  membership creation.
- Allowlisted Firebase UID administrator guard with verified email and revocation check.
- Admin pending/approved/rejected lists and one-time approval/rejection with an audited
  reviewer decision.
- Automated unit, HTTP, type, lint, formatting and production-build checks.

## Remaining version-one work

| Area | Current state | Remaining work |
| --- | --- | --- |
| Accounts | Firebase identity and `/auth/me` implemented | Client signup/login, verification UI, profile and address APIs |
| Seller onboarding | Basic API application, approval/rejection and decision audit | Suspension, appeal/reapplication, documents and UI |
| Authorization | Firebase identity, admin UID allowlist and owner-filtered application list | Durable admin management and seller ownership policies on future APIs |
| Catalog | Not started | Categories, products, variants, media, moderation and search |
| Inventory | Not started | Movements, reservations, concurrency and stock reconciliation |
| Shopping | Not started | Cart, checkout totals, addresses and shipping calculations |
| Orders | Not started | Parent order, seller orders, fulfillment, cancellation and returns |
| Money | Not started | Approved payment flow, callbacks, refunds, ledger, commission and payouts |
| Web | Not started in this ZIP | Storefront, seller dashboard and admin panel |
| Flutter | Not started in this ZIP | Customer application and Firebase client integration |
| Operations | Foundation only | Jobs, notifications, logs, monitoring, backups and deployment |
| Launch | Not started | Policies, security review, pilot and production release |

## Completion estimate

The repository is approximately **12% of a complete version-one marketplace**. About
**88% remains**. This is a rough product-scope estimate, not a schedule or file count.
The foundation reduces future rework, but most customer, seller, admin, order and money
flows have not been built.

For one developer, a realistic first public pilot is roughly **8 to 14 months of
part-time work**, depending on design depth, payment-provider approval, courier rules
and whether the website and Flutter app are developed together. A narrower pilot with
one web storefront, manual payouts and a small seller group can be completed sooner.

## Recommended next milestone

Build one complete seller publishing path from this approved application:

1. Define suspension, appeal and reapplication policies.
2. Enforce seller membership and approved status on every seller-scoped product route.
3. Add category and product draft models.
4. Add product media and moderation.
5. Let an approved seller publish one moderated product.

The next milestone is complete when an approved seller's authorized members can create
or edit that seller's draft product, and no other account can do so.
