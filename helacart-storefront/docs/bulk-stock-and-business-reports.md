# Bulk tools, stock alerts and business reports

Implemented 26 October 2026. The additive migration `20261026070000_bulk_stock_reports` has been applied to the configured development database.

## Bulk tools

Seller Center → `/seller/bulk-tools` supports physical-stock CSV imports, submitting draft/rejected products for approval, and hiding approved products. Admin → `/admin/bulk-tools` supports approval/rejection of pending listings. The product picker supports search, pagination, up to 100 selected products and expandable descriptions, images, specifications and warranty information.

Each action requires a reason and a saved preview before confirmation. A preview contains the exact before/after quantities or listing states, row errors, reserved quantities and an expiry time. Invalid rows block the whole action. Previews expire after 20 minutes. The apply request uses only the stored preview ID; it does not trust new quantities or decisions in a browser request.

- Stock CSV uses exactly `sku,on_hand`, with case-sensitive shop SKUs and whole quantities from 0 to 1,000,000,000. On-hand is the counted physical quantity, not available stock and not a quantity to add. UTF-8 BOM, quoted fields and CRLF are supported. Duplicate SKUs, unknown headers, malformed quoting, decimals, negative quantities, unknown shop SKUs and quantities below reservations are rejected.
- Download a stock template for all matching variants, up to 500. Larger shops must narrow the template search. Exports never silently truncate. Each import supports up to 500 rows; the browser accepts files up to 64 KB and also supports pasted CSV.
- Previewing does not change inventory or listing state. Applying stock rechecks every saved on-hand/reserved quantity. Listing actions recheck status and update timestamp, seller/category eligibility and required images. All rows commit together or roll back together. Successful stock changes retain normal inventory movement history; admin decisions retain normal product approval history.
- Preview creation uses an actor-scoped request key and payload hash. Retrying the same preview returns the original job. Retrying an applied job returns the recorded result without duplicating stock movements or approval records.
- Preview identity, reason, snapshots and completed action records are immutable in PostgreSQL. Recent action history is private to its creator and workspace. Another member of the same shop cannot apply someone else’s preview. Seller actions cannot approve products or change commission rates.

## Stock alerts

`/seller/stock-alerts` shows physical, reserved and available quantities, a configurable threshold, enabled state and product status. Each variant defaults to a threshold of five available units. A threshold of zero alerts only when availability reaches zero. Settings use a revision check and do not change stock quantities or the listing’s approval state.

Available quantity is `onHand - reserved`. Inventory, product and overview screens use the configured thresholds instead of the previous fixed five-unit rule. Disabling notifications does not remove a variant from the ordinary inventory low-stock calculation; the alerts page has its own disabled/enabled filters.

Database triggers queue affected variants after physical stock/reservation changes, threshold changes and product/shop/category visibility changes. This covers checkout, order cancellation, reservation expiry/release/commit, single adjustments and CSV imports without requiring every write path to remember an alert call.

The API worker checks queued variants about once a minute while the API is running. It processes bounded batches with row locks and `SKIP LOCKED`, so concurrent API instances cannot duplicate an alert episode. Published products in approved shops and active categories notify active shop members through the existing in-app notification bell. A low-to-out-of-stock transition sends a new alert; repeated low stock, repeated checks and out-to-low improvement do not. Restocking above the threshold clears the episode and allows a future alert.

Draft/hidden products and disabled variants are visible in the management screen but do not send stock notifications. Existing stock receives a quiet baseline during migration, so rollout does not flood shops with notifications. The alert dashboard still shows those existing quantities. Suspended shops can read their reports/alerts; changing settings or applying bulk actions requires selling approval.

## Business reports

Seller `/seller/reports` is limited to the selected shop. Admin `/admin/reports` covers the marketplace and adds shop comparison. Date ranges are inclusive Sri Lanka calendar dates, support up to 366 days, and use 2000–2100 date inputs. Reports use a consistent repeatable-read database snapshot and have empty/error/retry states. Design preview does not fabricate business figures.

| Figure | Basis |
| --- | --- |
| Delivered merchandise, delivery fees and COD totals | Successful delivery event date; historical fallback to the recorded collection timestamp; saved order prices and quantities |
| Product performance | Delivered order-item quantities and line totals, grouped by product; current product name/SKU identify the listing |
| Net verified merchandise/delivery refunds | Refund verification date, minus corrections on their correction date; pending/rejected records are excluded |
| Net merchandise | Delivered merchandise in the period minus verified merchandise refund activity recorded in the period, including refunds relating to earlier sales |
| Commission accrued | Ledger charge/credit dates, including reversal entries; held charges are included as accruals |
| Verified commission collections | Payment verification date minus payment corrections on the correction date; pending receipts are excluded |
| Orders by current status | Shop orders placed in the chosen period, grouped by their current status |
| Support/returns opened | Case creation date within the selected period |
| Current inventory | Current quantities across all listings, including drafts; independent of the historical date filter |

Seller COD totals are seller collections. HelaCart commission accrual and verified commission collections are separate figures. These are sales/ledger activity reports; product costs, tax liabilities and operating expenses are not stored as profit calculations. Corrections can make a period’s net collections/refunds negative; earlier published periods retain their original recorded events.

Daily sales include zero-value dates and an accessible scrollable chart. Product rows are paginated in the UI. Admin shop comparison shows the top 20, with the full returned set available in CSV. A report exceeding 5,000 product or shop rows is rejected with a shorter-period instruction instead of truncating. Daily, product, shop and summary CSV downloads use the loaded date range, include all returned rows and protect spreadsheet text cells against formula execution. Monetary aggregation uses exact integer cents and rejects totals outside the supported safe range.

## API routes

Paths are relative to `/api/v1`; all require Firebase authentication. Administrator routes also require verified allowlist access and revocation checks. Responses are private/no-store; CSV endpoints return attachments.

| Method | Route | Scope |
| --- | --- | --- |
| GET | `/sellers/:sellerId/bulk-tools/stock-template.csv` | Shop member; optional `q` filter |
| GET | `/sellers/:sellerId/bulk-tools/jobs` | Creator’s shop history |
| POST | `/sellers/:sellerId/bulk-tools/preview` | Approved shop member |
| GET | `/sellers/:sellerId/bulk-tools/jobs/:jobId` | Creator and shop |
| POST | `/sellers/:sellerId/bulk-tools/jobs/:jobId/apply` | Creator and approved shop |
| GET | `/admin/bulk-tools/jobs` | Administrator’s own history |
| POST | `/admin/bulk-tools/preview` | Administrator |
| GET | `/admin/bulk-tools/jobs/:jobId` | Creator administrator |
| POST | `/admin/bulk-tools/jobs/:jobId/apply` | Creator administrator |
| GET | `/sellers/:sellerId/stock-alerts` | Shop member |
| PATCH | `/sellers/:sellerId/stock-alerts/:variantId/settings` | Approved shop member |
| GET | `/sellers/:sellerId/reports`, `/sellers/:sellerId/reports/export.csv` | Shop member |
| GET | `/admin/reports`, `/admin/reports/export.csv` | Administrator |

Bulk/settings writes share a 20-request-per-IP-per-minute process limit. Report and bulk browser requests allow 60 seconds for cold database connections. The notification worker has no public execution endpoint and stops with the application.

## Verification

- API: 167 unit tests and 350 HTTP checks passed, including CSV validation, date boundaries, exact signed-money arithmetic, DTO forgery, account/shop scope, administrator guards and CSV response headers. Schema, types, formatting, lint and the API build passed.
- `scripts/verify-business-tools.mjs`: 11 real PostgreSQL workflow checks passed for previews, idempotency, atomic rollback, reservation protection, concurrent alert workers, threshold changes, listing decisions, delivery-date boundaries, verified refunds and commission credit corrections.
- `scripts/verify-business-report-collections.mjs`: three further PostgreSQL checks passed for verified/pending commission receipts, seller/admin scope, corrections applied on later days, historical totals and signed CSV values. Both scripts use disposable schemas and remove them; customer data, actual money and external messages are untouched.
- Browser: 88 mocked-account interaction checks passed, including actual CSV file selection/download, retries, saved preview confirmation, stale inventory/settings, product detail inspection, date filters and report exports. Another 55 checks passed against the restored production source across nine screens at 1440, 1024, 768, 390 and 320 px. No runtime exceptions or document overflow were observed.
- Storefront types and the 53-route production build passed. Frontend lint has zero errors and six existing raw-image warnings in earlier product/inventory screens. Browser fixtures are excluded from application source; ignored artifacts are under `.next/business-tools-review`.
