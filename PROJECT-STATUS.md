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
- Admin-created categories, seller-owned product drafts and HTTPS image references.
- Seller membership and approved-status checks on product routes; changes to approved
  products return to draft for review.
- Product moderation with audited decisions and public approved-product filtering.
- Automated unit, HTTP, type, lint, formatting and production-build checks.

## Remaining version-one work

| Area | Current state | Remaining work |
| --- | --- | --- |
| Accounts | Firebase identity and `/auth/me` implemented | Client signup/login, verification UI, profile and address APIs |
| Seller onboarding | Basic API application, approval/rejection and decision audit | Suspension, appeal/reapplication, documents and UI |
| Authorization | Firebase identity, admin UID allowlist and seller-scoped product checks | Durable admin management and ownership checks on future seller/order APIs |
| Catalog | Basic categories, drafts, HTTPS image URLs, moderation and title search | Hosted image uploads, variants, richer search and merchandising |
| Inventory | Not started | Movements, reservations, concurrency and stock reconciliation |
| Shopping | Not started | Cart, checkout totals, addresses and shipping calculations |
| Orders | Not started | Parent order, seller orders, fulfillment, cancellation and returns |
| Money | Not started | Approved payment flow, callbacks, refunds, ledger, commission and payouts |
| Web | Not started in this ZIP | Storefront, seller dashboard and admin panel |
| Flutter | Not started in this ZIP | Customer application and Firebase client integration |
| Operations | Foundation only | Jobs, notifications, logs, monitoring, backups and deployment |
| Launch | Not started | Policies, security review, pilot and production release |

## Completion estimate

The repository is approximately **15% of a complete version-one marketplace**. About
**85% remains**. This is a rough product-scope estimate, not a schedule or file count.
The foundation reduces future rework, but most customer, seller, admin, order and money
flows have not been built.

For one developer, a realistic first public pilot is roughly **8 to 14 months of
part-time work**, depending on design depth, payment-provider approval, courier rules
and whether the website and Flutter app are developed together. A narrower pilot with
one web storefront, manual payouts and a small seller group can be completed sooner.

## Recommended next milestone

Build inventory and a safe purchase path from the moderated catalog:

1. Choose durable image hosting and implement authenticated uploads.
2. Add variants/SKUs and stock movement records.
3. Reserve/release stock safely under simultaneous checkout attempts.
4. Add cart, addresses and server-side price/delivery quotes.
5. Add seller-specific orders and idempotent order placement.

The next milestone is complete when a buyer's basket can be priced on the server and
one stock unit cannot be sold twice. Payment integration follows approved provider
and business decisions.
