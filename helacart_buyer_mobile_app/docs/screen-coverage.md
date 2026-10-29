# Buyer design coverage

This index maps the supplied Stitch frames to Flutter screens and reusable variants. Numbers identify designs, not a requirement for 64 separate navigation routes. Screen files use descriptive names.

The later [web-reference implementation](ui-reference-implementation.md) updates the shared presentation and supersedes navigation: Home, Categories, Bag, Favorites, Orders are the five branches; Account is opened from the Home profile drawer. Bag retains navigation and a fixed checkout action; focused details/checkout hide the bar. The original route coverage below describes functional destinations, not complete visual parity with every web-reference state.

| Designs | Implementation / destination |
| --- | --- |
| 01 Launch/session restore | Native launch icon, `main.dart` bootstrap, Firebase session provider and protected loading states |
| 02 Welcome | `app/router.dart` → `/welcome`, optional first-visit content |
| 03–04 Sign in/register | `features/auth/presentation/auth_screen.dart` → `/auth`, `/auth/register` |
| 05 Verification | `/verify`, resend/check, preserved buyer destination |
| 06–07 Reset request/confirmation | `/auth/reset`, neutral inline confirmation state; reset link handled by Firebase email flow |
| 08 Home | `features/catalog/presentation/home_screen.dart` → `/` |
| 09 Categories | Same feature → `/categories` |
| 10 Catalog, 12 Results, 15 Offers | `catalog_screen.dart` → `/products`, query variants, `/offers` |
| 11 Search | `search_screen.dart` → `/search` |
| 13–14 Filters/sort | Modal sheets in `catalog_screen.dart`; validated prices and supported API filters |
| 16 Product details, 19 Specifications/warranty | `product_details_screen.dart` → `/products/:id` |
| 17 Options/quantity | `VariantSelectionSheet` and selected-option controls, only actual variant combinations |
| 18 Gallery | `/gallery/:id`, swipe/zoom and missing-image state |
| 20–22 Product reviews/editor/report | `features/reviews/presentation/reviews_screen.dart` → `/products/:id/reviews`, inline editor and private report sheet |
| 23 Shop directory | `features/shops/presentation/shops_screen.dart` → `/shops` |
| 24 Shop products | `/shops/:slug/products`, scoped search/category/price/sort, shop navigation |
| 25 Shop About | `/shops/:slug`, cover/logo/public description/location and standard delivery explanation |
| 26–27 Shop reviews/editor | `/shops/:slug/reviews`, delivered-order selector, own feedback and photo controls |
| 28 Review image | `/review-photo`, visibility-checked API image, no persistent private-image cache |
| 29–30 Favorites/alert settings | `features/favorites/presentation/favorites_screen.dart` → `/favorites`, opt-in sheet |
| 31 Cart | `features/cart/presentation/cart_screen.dart` → `/cart`, shop groups and stock recovery |
| 32 Added confirmation | Shared product action bottom sheet, confirmed API write only |
| 33 Address selection, 36 Order review | `features/checkout/presentation/checkout_screen.dart` → `/checkout`, two-step destination-quoted COD flow |
| 34–35 Add address/district | `features/account/presentation/addresses_screen.dart` → `/account/addresses/new`, searchable 25-district sheet |
| 37 Order confirmation | `/order-success/:id`, fetches the confirmed buyer-owned order |
| 38–39 Orders/details | `features/orders/presentation/orders_screen.dart` → `/orders`, `/orders/:id` |
| 40 Tracking | `/orders/:id/tracking/:package`, seller-entered courier/reference/event history |
| 41 Cancellation | Confirm dialog and shop-package cancellation action before acceptance |
| 42–47 Returns/refunds | `features/after_sales/presentation/returns_screen.dart` → `/returns`, `/refunds`, `/returns/new/:package`; item steps and owner-checked detail sheets |
| 48–50 Support | `features/support/presentation/support_screen.dart` → `/support`, `/support/new`, `/support/:id`; case history and text replies |
| 51–53 Account/profile/photo | `features/account/presentation/account_screen.dart` → `/account`, `/account/profile`, native photo-picker sheet |
| 54 Addresses | `/account/addresses`, add/remove with confirmation; no unsupported update/default action |
| 55 Notifications | `features/notifications/presentation/notifications_screen.dart` → `/notifications`, read/read-all, refresh and buyer-safe navigation |
| 56–58 Security | `/account/security`, `/account/security/password`, `/account/security/email` |
| 59 Sign out | Confirm dialog, Firebase sign-out and account-scoped invalidation |
| 60 Verified shop | Shared badge explanation sheet |
| 61–62 Own reviews/actions | `/account/reviews`, eligible review editors, hidden-review restrictions |
| 63 Help | `features/account/presentation/help_screen.dart` → `/help` |
| 64 Delete review | Own-review confirmation actions; no moderation/history erasure promise |

S01–S08 are implemented as reusable loading, empty, offline, authorization, changed-data, pending-write and accessible-layout states. S05 was missing from the supplied archive; its purchase-recovery behavior uses authoritative API rejection/refresh instead of invented artwork or automatic acceptance of new totals.

Some exported labels were corrected: no universal “7-Day Free Returns”, fake pinned address, universal verified status, online payment, or unconfigured guarantee. HelaCart theme tokens take precedence over font/color drift between individual exported frames.

F01 push delivery/preferences, F02 account deletion and F03 published legal readers require additional backend/platform/policy scope. They are not live features in this buyer app. The existing in-app inbox is implemented.
