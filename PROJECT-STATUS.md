# HelaCart project status

Assessment date: 2026-10-13

## Implemented in this ZIP

- NestJS API foundation, configuration validation and security headers.
- Prisma 7 with Neon-compatible pooled runtime and direct migration URLs.
- User, Seller and SellerMember account foundation and migrations.
- Health and database-readiness endpoints.
- Firebase Admin initialization and bearer ID-token verification.
- Protected `GET /api/v1/auth/me` with Neon profile synchronization.
- Automated unit, HTTP, type, lint, formatting and production-build checks.

## Remaining version-one work

| Area | Current state | Remaining work |
| --- | --- | --- |
| Accounts | Firebase identity and `/auth/me` implemented | Client signup/login, verification UI, profile and address APIs |
| Seller onboarding | Tables only | Application, review, approval, suspension and audit trail |
| Authorization | Firebase identity only | Admin roles and seller ownership policies on every API |
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

The repository is approximately **10% of a complete version-one marketplace**. About
**90% remains**. This percentage measures working product scope, not the number of files.
The foundation reduces future rework, but most customer, seller, admin, order and money
flows have not been built.

For one developer, a realistic first public pilot is roughly **8 to 14 months of
part-time work**, depending on design depth, payment-provider approval, courier rules
and whether the website and Flutter app are developed together. A narrower pilot with
one web storefront, manual payouts and a small seller group can be completed sooner.

## Recommended next milestone

Build one complete seller publishing path:

1. Add administrator roles and authorization.
2. Add seller application submission.
3. Add admin review, approval and suspension.
4. Enforce seller membership on every seller route.
5. Add category and product draft models.
6. Let an approved seller publish one moderated product.

The milestone is complete when a new user can apply, an admin can approve the seller,
and only that seller's authorized members can create or edit its products.
