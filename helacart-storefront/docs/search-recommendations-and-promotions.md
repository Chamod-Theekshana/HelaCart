# Search, recommendations, favorite alerts and promotions

Implemented 27 October 2026. The additive migration `20261027010000_discovery_promotions` is applied to the configured development database.

## Product discovery

Storefront and shop searches match multiple words across product title, description, brand, SKU, category and shop name. Each term must match the combined public product fields. Unicode input is normalized, values remain SQL parameters, and only approved products in approved shops and active categories are returned. A relevance option favors exact/prefix titles and text matches. Existing category, stock, price and pagination controls remain available; price filtering/sorting uses the cheapest currently available variant after approved offers.

The header provides debounced product/category suggestions and an explicit full-results link. Suggestions support arrow-key selection, Enter, Escape, visible focus and separate accessible IDs for desktop/mobile search forms. Search input is bounded to 80 characters. The **Offers** navigation link and catalog filter show products with an active approved campaign.

Product-detail suggestions prioritize the same category, then recent delivered purchase volume and newest listings. Home-page suggestions use the signed-in buyer’s saved categories, excluding products they already favorited; guest suggestions use recent delivered purchases and recency. Recommendations include available products only and do not expose customer IDs, orders or other people’s favorite lists. No browsing-history tracker or external recommendation service is required. The interface labels these as suggestions and does not invent ratings or sales figures.

## Favorite alerts

Each saved product has independent **Price drops** and **Back in stock** preferences. Both default to off, including existing favorites. An email-verified buyer can save preferences from `/favorites`; the API checks ownership and a settings version. Enabling preferences establishes the current product availability/price as a baseline, so opting in does not immediately send an alert for an old change.

An internal worker checks due subscriptions about once a minute while the API runs, with bounded batches and row locks for multiple API instances. Delivery time depends on the queue. Notifications use the existing in-app inbox and link to the product.

- Price alerts compare the cheapest available variant’s effective price against the minimum already observed/notified since preferences were saved. A new lower price can notify; an increase followed by a return to an already-alerted price does not repeatedly notify. Saving preferences establishes a fresh baseline.
- Restock alerts detect a product changing from no available variants to at least one available variant. They concern the saved product rather than a particular size/color.
- Hidden products, suspended shops, inactive categories, inactive accounts and unverified accounts do not send favorite alerts. Visibility changes alone are not treated as a stock-out episode. Removing a favorite removes its subscription. Turning both preferences off stops checks.
- Public prices can change after an alert is recorded; buyers see current pricing when following the notification.

## Seller-funded product offers

Seller `/seller/promotions` submits an offer for an approved product. The form accepts a name, percentage from 1% to 90% (two decimal places), and explicit Sri Lanka start/end times. A campaign lasts at most 90 days, starts within one year and must end in the future. Terms are immutable after submission; sellers can cancel and submit a replacement when needed. A shop can have up to 100 pending/approved non-ended campaigns.

Admin `/admin/promotions` approves, rejects or cancels offers with a recorded reason. Sellers cannot approve or reject their own offers. Decisions use a version check and append-only history. Approved campaigns apply only while `startsAt <= pricing time < endsAt`; future and expired campaigns do not require a scheduler to become inactive. Product/shop/category approval still governs storefront visibility. An approved shop member can create offers; existing members of a suspended shop can read/cancel their existing campaigns.

If approved schedules overlap, only the strongest percentage for that product applies, with a stable ID tie-breaker. Discounts apply to all variants, round once per unit in integer cents, and retain a one-cent minimum price. The current base price is the original-price reference; it is not a claimed historical price. Cards/details show the offer name and original price when there is an actual reduction.

The same pricing function/formula is used in public catalog results, shop results, recommendations, product details, favorites, cart and checkout. The cart quote includes the selected offer identity/rate/original price. A changed offer rejects an older quote before stock writes. Checkout stores the original unit amount, selected promotion ID/percentage and paid unit/line amounts on each order item. These fields are immutable, and later campaign cancellation does not change old orders.

Commission snapshots and refund caps use the discounted merchandise actually ordered. Free-delivery thresholds use the resulting merchandise subtotal. Existing orders retain their original totals and rates; migration does not discount historical purchases. Discount campaigns create no online-payment flow.

## API

All paths are relative to `/api/v1`. Private routes use Firebase identity and existing account/shop/admin guards. Responses are no-store; private routes are private/no-store. Promotion and favorite-setting writes share a 20-request-per-IP-per-minute process limit.

| Method | Route | Access |
| --- | --- | --- |
| GET | `/discovery/suggestions?q=...` | Public, 2–80 characters |
| GET | `/discovery/recommendations?productId=...&limit=...` | Public, up to 12 products |
| GET | `/me/recommendations` | Authenticated buyer, own favorites |
| PATCH | `/me/favorites/:favoriteId/alerts` | Verified favorite owner |
| GET, POST | `/sellers/:sellerId/promotions` | Shop member; create requires approved shop |
| PATCH | `/sellers/:sellerId/promotions/:id` | Shop member, cancellation only |
| GET, PATCH | `/admin/promotions[/:id]` | Verified allowlisted administrator |

Promotion create retries use a submitter-scoped UUID request key and exact term comparison. Creator IDs, request keys and notification baselines are not exposed publicly. New tables retain promotion terms/decision history; existing favorite records gain disabled alert preferences. New nullable order snapshot fields preserve compatibility with historical orders.

## Deployment and verification

Prisma’s schema engine repeatedly failed to connect in this development environment, while the configured PostgreSQL driver worked. The migration was therefore applied through `scripts/deploy-discovery-migration.mjs`: one fixed migration, a transaction and migration lock, required-prior-migration checks, and a verified SQL checksum/receipt in `_prisma_migrations`. Normal Prisma deployment remains the standard workflow. The fallback changes no credentials or TLS settings and refuses an unexpected schema, unfinished migration or checksum mismatch.

- API: 175 unit and 374 HTTP tests passed, including exact rounding, strongest-offer selection, bound dates, recommendation-basis transparency, preference ownership, forged input, administrator checks and existing checkout/favorites behavior.
- `scripts/verify-discovery-promotions.mjs` passed eight real PostgreSQL workflow checks in a disposable schema: Unicode/multiple-word discovery, visibility, private preferences, approved/future/overlapping campaigns, matching cart/favorite/catalog prices, discounted commission snapshots, stale checkout rollback, immutable order snapshots and concurrent deduplicated favorite alerts. The temporary schema was removed and customer data was untouched.
- Browser: 56 mocked-account checks passed for suggestion keyboard handling, recommendation cards, alert opt-in/retries, original-price labels, seller scheduling/timezone conversion, admin decisions, stale versions, cancellation and safe text. Responsive checks cover 1440, 1024, 768, 390 and 320 px.
- Restored production source passed another 55 route/responsive checks across the storefront, catalog searches/offers, product details, favorites, shop directory, cart and seller/admin promotions, with no runtime exceptions or settled document overflow. The production build contains 55 routes.
- Schema validation, API types/lint/format/build and storefront types/build passed. Frontend lint has no errors and retains six existing raw-image warnings in earlier screens. Browser fixtures are excluded from application source and remain under ignored `.next/discovery-review`.
