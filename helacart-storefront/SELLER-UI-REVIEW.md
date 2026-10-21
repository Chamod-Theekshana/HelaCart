# Seller Center UI review

Reviewed on 21 October 2026. All eight Seller Center screens were checked in a browser using sample data, with screenshots and element measurements before and after the changes.

## Main cause

The storefront and Seller Center both used `.seller-card`. The storefront rule supplied `display:flex`, alignment and padding that the workspace cards inherited. Forms, table headings, image panels and order details were consequently laid out side by side inside their cards. The storefront now uses `.storefront-seller-card` so the two interfaces have independent layouts.

The two seller stylesheets also contained competing viewport breakpoints. Responsive rules now live together in `app/seller-stitch.css`; container queries use the space actually available after the sidebar and content padding.

## Screens and changes

| Screen | Issues addressed |
| --- | --- |
| Overview `/seller` | Card contents arranged correctly; readable inventory names; consistent spacing; recent orders scroll inside their table; metrics and actions stack when necessary. |
| Products `/seller/products` | Full width catalogue card; reachable status tabs and filters; contained horizontal table scrolling; wrapping pagination and action buttons. |
| Add product `/seller/products/new` | Section heading above the fields; usable input widths; separate image/review cards; wrapping actions; generated slug follows the complete title until edited manually. |
| Edit product `/seller/products/[id]` | Independent form and image panels; usable fields; responsive variant and stock forms; readable inventory totals and review messages. |
| Inventory `/seller/inventory` | Responsive summary and stock calculation; table header stays outside the horizontal scroller; quick adjustment layout adapts to available space. |
| Orders `/seller/orders` | Order queue and details fit their columns; stacked layout on smaller screens; readable item totals, addresses and timeline; visible controls and empty states. |
| Delivery settings `/seller/settings` | Fee form and preview have sufficient space; currency prefix stays together; receipt labels and amounts wrap independently; store details fit narrow cards. |
| Application `/seller/apply` | Form and guidance cards have distinct spacing; fields and actions stack on mobile; complete generated store slug; telephone keyboard for contact entry. |

The shared shell also includes a scrollable mobile drawer, close button, Escape handling, focus containment, restored page scrolling and focus, active navigation semantics, and truncated long account text. Closed mobile navigation is hidden from keyboard navigation. Reduced motion preferences are respected.

Preview timestamps are fixed, and seller dates use the Asia/Colombo timezone. This removes the server/browser hydration errors observed on Overview and Orders.

## Validation

- Eight screens at widths 320, 390, 600, 768, 820, 1024, 1280 and 1440: **64 layout checks passed**. Before the changes, 46 combinations had unexpected overflow or form fields narrower than 150px; after the changes, none did.
- **20 browser interaction checks passed**: mobile navigation, keyboard and resize behavior, product and order filters, inventory filtering, empty states, fee reset, generated/manual slugs, contained table scrolling, and the storefront seller card layout.
- **Zero uncaught browser errors** in the final run, including hydration errors.
- TypeScript check passed. ESLint reported no errors and four existing suggestions to replace raw product `<img>` elements.
- Production build passed using the identical source snapshot in the isolated preview directory.
- CSS parsing and `git diff --check` passed.

Local screenshots and measurement results are under `.next/seller-review/baseline` and `.next/seller-review/final`. The tested preview was compared against every changed working source file and matched exactly.

Validation used sample products and orders in an isolated preview. Authenticated API writes, photo storage and real order/payment transitions were not exercised.
