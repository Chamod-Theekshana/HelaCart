# Product feedback, product details and account permissions

Implemented 26 October 2026. Migration `20261026060000_product_feedback_permissions` is additive and has been applied to the configured development database.

## Buyer experience

Product pages show verified-purchase reviews, the overall average/count, a five-star breakdown, rating filters and newest/highest/lowest sorting. An email-verified buyer needs a delivered order containing that exact product. Each buyer maintains one review per product across repeat purchases, with 1–5 stars and a 10–1500 character comment. Shop owners and managers cannot review their own products.

Buyers can edit, soft-delete or rewrite their own review. The original delivered order item and purchased variant label remain attached internally. Edits, deletions and seller replies use a version check so an older browser cannot overwrite another change. Reviews hidden by moderation cannot be republished through buyer edits. Reviews reflect a purchase experience; a later return does not automatically remove them.

`/account/reviews` lists the buyer’s previous product feedback, including hidden reviews and feedback for unavailable listings. Buyers can delete their own feedback there even if its product has left the public catalog. Delivered order items link directly to the product’s reviews. Product reviews are separate from the existing shop reviews and listing-approval history.

Public responses contain the buyer’s display-name snapshot, review text/rating, purchased option label, dates and seller response. Buyer IDs, order-item IDs, login emails and reply-author IDs are excluded. Public review routes follow product, category and seller visibility. Private history and eligibility responses use `private, no-store` caching.

## Seller and administrator reviews

- `/seller/product-reviews` lists that shop’s customer product feedback. Approved shops can add, edit or remove a public response. Replies also require the current review version.
- Verified accounts can privately report someone else’s published review once. The report retains a rating/comment snapshot even if the buyer subsequently changes or deletes their review.
- `/admin/product-review-reports` lets allowlisted administrators inspect the snapshot and current review, then hide the review or dismiss the report with a reason. Each report accepts one decision. Hiding immediately excludes the review and its rating from public results.
- Database constraints enforce valid review ratings, delivered-purchase linkage, review identity, version increments and retained moderation history.

The existing `ProductReview` model records administrator listing approval. The new `CustomerProductReview` and `CustomerProductReviewReport` models hold buyer feedback and moderation separately.

## Product details

Sellers can enter an optional brand (100 characters), warranty description (500 characters), and up to 20 specification name/value pairs (60/300 characters). Names must be unique ignoring case. Nested fields are validated; arbitrary properties, null arrays, blank specification values and oversized content are rejected.

These fields are available in product create/edit forms, the administrator’s listing-review dialog and the public product page. Existing products receive an empty specification list and nullable brand/warranty. Changing these details follows the existing draft/reapproval workflow. Warranty text describes the seller’s supplied terms and is displayed as plain text. The gallery supports an enlarged native dialog, thumbnail selection and previous/next images.

## Account permissions

All authenticated API routes check Firebase revocation/disabled-session state and current HelaCart account access. A suspended account is rejected on its next authenticated request. Public browsing remains available. Restoring access preserves the account’s existing buyer and shop memberships. Suspension does not cancel orders, delete customer data, change commission balances or mark refunds paid. Requests already in flight can finish under their earlier access check.

`/admin/accounts` supports name/email search, access filters, suspension/restoration, reasons and recent access history. Decisions require the current access version. The acting administrator and other allowlisted administrator accounts cannot be suspended through this screen. Administrator privileges still come only from the server’s `ADMIN_FIREBASE_UIDS`; profile fields and team forms cannot grant them. Existing users default to `ACTIVE`; no accounts are automatically suspended during migration.

`/seller/team` explains shop permissions. Only the owner can inspect the team, add an existing email-verified active HelaCart account as a manager, or remove a manager. The exact account email is matched without regard to case. Adding a manager grants access immediately and does not send email. A shop supports up to 20 members. The owner cannot be removed or replaced through this workflow. Add/remove actions require reasons and retain append-only history.

| Capability | Buyer | Shop manager | Shop owner | HelaCart admin |
| --- | --- | --- | --- | --- |
| Review a delivered purchase | Own purchases | Own purchases outside their shop | Own purchases outside their shop | Own purchases outside their shop |
| Manage products, stock, orders, shop and replies | No | Assigned shop | Own shop | Admin approval workflows |
| Record shop refunds/commission payments and use support | Own buyer support | Assigned shop | Own shop | Verify and moderate |
| Add/remove shop managers | No | No | Own shop | No automatic membership bypass |
| Suspend/restore accounts or moderate product reports | No | No | No | Allowlisted administrator |
| Assign commission rates | No | No | No | Allowlisted administrator |

Removing manager access takes effect on the next membership check and preserves that person’s buyer account and recorded work. Suspended shops retain the owner’s team-management route to revoke staff access, alongside their existing support and financial-obligation routes. Shop suspension and account suspension are separate controls.

## API routes

All paths are relative to `/api/v1`.

| Method | Route | Access |
| --- | --- | --- |
| GET | `/products/:productId/customer-reviews` | Public, visible product |
| GET | `/products/:productId/customer-reviews/access` | Verified buyer |
| PUT, DELETE | `/products/:productId/customer-reviews/mine` | Verified review owner / delivered buyer |
| POST | `/products/:productId/customer-reviews/:reviewId/reports` | Verified account |
| GET | `/me/product-reviews` | Verified account, own history |
| GET | `/sellers/:sellerId/product-reviews` | Shop member |
| PUT | `/sellers/:sellerId/product-reviews/:reviewId/reply` | Approved shop member |
| GET, PATCH | `/admin/product-review-reports[/:id]` | Administrator |
| GET | `/admin/accounts` | Administrator |
| PATCH | `/admin/accounts/:id/access` | Administrator |
| GET, POST | `/sellers/:sellerId/team` | Shop owner |
| DELETE | `/sellers/:sellerId/team/:id` | Shop owner, manager target |

Writes have a shared per-process limit of 20 requests per IP per minute. Sensitive routes use validated DTOs and reject forged role, ownership and moderation fields.

## Verification

API validation passed: 141 unit tests, 315 HTTP tests, schema validation, formatting, lint, type checking and production build. Storefront type checking and the restored production build passed with 48 routes. Frontend lint has no errors; six existing raw-image warnings remain in earlier product/inventory screens.

The API unit/HTTP suites cover authentication, revoked and suspended sessions, request validation, account-scoped history and private response rules. `helacart-api/scripts/verify-product-feedback-permissions.mjs` passed 14 real PostgreSQL workflow checks in a disposable schema, including concurrent edits, wrong-shop replies, preserved report snapshots, hidden ratings, owner-only manager access, immediate revocation and append-only history. The temporary schema was removed; customer data and real account credentials were untouched.

Browser audits exercise actual components with mocked identities and JSON responses: review create/edit/delete/rewrite, stale edits, error recovery, safe text rendering, reports, seller responses, moderation, account access decisions, team grants/removals and specification fields. Responsive checks cover 1440, 1024, 768, 390 and 320 px. Audit fixtures and screenshots remain in ignored `.next/product-feedback-review`; fixture providers and API adapters are excluded from application source.

All 107 form/interaction checks and 61 restored-production browser checks passed, with no runtime exceptions or horizontal overflow. The running development API returned healthy/public catalog responses, protected review/account routes returned 401 without a token, and all five new storefront routes returned 200. A read-only database check confirmed the migration and buyer-history query.
