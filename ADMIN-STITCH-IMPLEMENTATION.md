# Admin Operations UI from Stitch

The Next.js storefront includes a responsive HelaCart Operations area at `/admin`, adapted from `stitch_helacart_admin_panel_ui.zip`, in the HelaCart teal/navy theme (English only).

## Main screens and backend wiring

| Route                                                | Supported workflow                                                                                                                                                                                               |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/admin`                                             | Live queue counts and recent orders                                                                                                                                                                              |
| `/admin/seller-applications`                         | Approve/reject sellers and shop verification, with reasons                                                                                                                                                       |
| `/admin/sellers`                                     | Approved/suspended/pending/rejected sellers; suspend or reinstate with a reason (`GET /admin/sellers`, `PATCH /admin/sellers/:id/status`)                                                                        |
| `/admin/products`                                    | Inspect listings; approve (optional commission rate in %, sent as `commissionRateBps`; required when the API answers `COMMISSION_RATE_REQUIRED`) or reject                                                       |
| `/admin/categories`, `/admin/appearance`             | Categories and storefront hero                                                                                                                                                                                   |
| `/admin/orders`                                      | Order search and detail; per seller order: cancel, mark delivery failed, mark returned, mark delivered with a reason (`POST /admin/orders/:id/actions`); **Needs attention** tab (`GET /admin/orders/attention`) |
| `/admin/returns`, `/admin/refunds`, `/admin/support` | After-sales workflows                                                                                                                                                                                            |
| `/admin/commission`                                  | Commission charges, seller payments and holds                                                                                                                                                                    |
| `/admin/cod`                                         | Record a COD reconciliation (amount, reference, note; a different amount is recorded as disputed)                                                                                                                |
| `/admin/audit-log`                                   | Administrative audit trail with action filter (`GET /admin/audit-log`)                                                                                                                                           |

Courier dispatch, real payouts and KPI trends from the mockups have no backend contracts and are not offered.

## Setup

1. In the API `.env`, set `ADMIN_FIREBASE_UIDS` to your administrator's Firebase UID and restart the API.
2. In storefront `.env.local`, set `NEXT_PUBLIC_API_URL`, the `NEXT_PUBLIC_FIREBASE_*` values and (for server calls) `HELACART_INTERNAL_API_TOKEN`; add the web origin to API `CORS_ORIGINS`.
3. `npm ci`, then `npm run dev`; open `/admin`, sign in with the administrator account and verify the email.

Without `NEXT_PUBLIC_API_URL`, `/admin` shows labelled sample data and disables every write. The API verifies the administrator on each request; the browser UI grants nothing. Never put an Admin SDK key or database URL in the storefront.
