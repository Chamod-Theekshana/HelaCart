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
- Product variants with SKU, options, price and zero-stock migration backfill.
- Seller-scoped stock adjustments, movement history and public availability.
- Internal idempotent stock reservations with guarded concurrent updates, release,
  commit and periodic expiry handling (reserved for future online payments).
- Buyer addresses and carts; server-priced, idempotent, atomic COD checkout with
  per-seller delivery charges and stock movements.
- Multi-seller order snapshots, seller fulfillment workflow, COD collection marker,
  buyer/seller cancellation, stock restoration and order event history.
- Automated unit, HTTP, type, lint, formatting and production-build checks.

## Remaining version-one work

| Area | Current state | Remaining work |
| --- | --- | --- |
| Accounts | Firebase identity and `/auth/me` implemented | Client signup/login, verification UI, profile and address APIs |
| Seller onboarding | Basic API application, approval/rejection and decision audit | Suspension, appeal/reapplication, documents and UI |
| Authorization | Firebase identity, admin UID allowlist and seller-scoped product checks | Durable admin management and ownership checks on future seller/order APIs |
| Catalog | Categories, variants, HTTPS image URLs, moderation and title search | Hosted image uploads, richer search and merchandising |
| Inventory | Seller adjustments, movements, internal reservations and expiry loop | Stock reconciliation and operational monitoring |
| Shopping | Address, cart, COD checkout and seller delivery fee quote | Taxes or promotions if required, advanced delivery rules |
| Orders | Parent/seller orders, snapshots, fulfillment and pre-shipment cancellation | Returns, disputes, notifications and courier tracking |
| Money | COD collection marker | Gateway, callbacks, refunds, ledger, commission and payouts |
| Web | Not started in this ZIP | Storefront, seller dashboard and admin panel |
| Flutter | Not started in this ZIP | Customer application and Firebase client integration |
| Operations | Foundation only | Jobs, notifications, logs, monitoring, backups and deployment |
| Launch | Not started | Policies, security review, pilot and production release |

## Completion estimate

The repository is approximately **30% of a complete version-one marketplace**. About
**70% remains**, because web and mobile clients, deployment and operations remain large.
For the **backend alone**, a COD pilot is roughly **60% implemented**, with roughly
**40% remaining** before a production-ready marketplace backend. These are rough
scope estimates, not a schedule or file count.
The foundation reduces future rework, but most customer, seller, admin, order and money
flows have not been built.

For one developer, a realistic first public pilot is roughly **8 to 14 months of
part-time work**, depending on design depth, payment-provider approval, courier rules
and whether the website and Flutter app are developed together. A narrower pilot with
one web storefront, manual payouts and a small seller group can be completed sooner.

## Recommended next milestone

The next work after this COD pilot is:

1. Choose durable image hosting and implement authenticated uploads.
2. Build seller/customer/admin UI and end-to-end journeys with real Firebase tokens.
3. Add notifications, returns and disputes, stock reconciliation and operating dashboards.
4. Add a payment provider, secure callbacks, refunds, commission and payouts if online
   payments are required; COD collection still needs accounting and reconciliation.
5. Test on staging with real shipping and operational policies before a limited pilot.

The buyer basket, COD order and stock concurrency flow are implemented and exercised
against an isolated PostgreSQL-compatible database. Live Neon/Firebase, sellers,
couriers and real fulfillment still require staging validation.
