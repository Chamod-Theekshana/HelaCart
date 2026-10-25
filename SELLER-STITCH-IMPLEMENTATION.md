# Seller Center Stitch implementation

Reference: `stitch_helacart_seller_dashboard_ui.zip` (seven screens and `lankan_merchant_flow/DESIGN.md`).

| Stitch screen | Next.js route | Implementation |
| --- | --- | --- |
| Seller overview | `/seller` | Merchant sidebar and top bar, welcome card, store readiness, real product/order/stock metrics, recent COD orders and inventory health. |
| Products list | `/seller/products` | Status tabs, category and stock filters, searchable catalog, client pagination, CSV of currently loaded products, approval actions. |
| Create/edit product | `/seller/products/new`, `/seller/products/[id]` | Core item details, photo upload, review feedback, listing approval controls, variants and stock. |
| Product variants and stock | `/seller/inventory`, product detail | On hand minus reserved summary, stock matrix, adjustment form and backend stock history on product detail. |
| Seller orders | `/seller/orders` | Fulfilment status filters, buyer/order queue, order timeline, itemized COD amount, address, contact and guarded status actions. |
| Delivery settings | `/seller/settings` | Current single seller fee, edit/reset controls and an explicitly illustrative buyer receipt with the real fee. |
| Seller application and access states | `/seller/apply`, `/seller` | Application form, pending/rejected/verification states and honest review steps. |

The source mockups also contain settlement balances, couriers, delivery guarantees, commissions, support numbers and approval time estimates. The current API does not supply or support these, so the live dashboard does not display them as facts. The catalog API currently returns at most 50 products, so filters, pagination and CSV operate on those loaded records.

No migration is required for this UI change. The included API has the existing `/auth/me` delivery fee select from the prior Seller Center bundle. Live Firebase, Neon, R2 and COD flows require your own configuration and real account testing.
