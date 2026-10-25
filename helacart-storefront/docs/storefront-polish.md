# Storefront visual polish

Implemented 21 October 2026. Existing teal/navy tokens, pale blue canvas, logo, fonts and hero artwork remain in use. No database, environment, credentials or dependencies changed.

## Screens and components

- `screens/storefront/storefront-home-screen.tsx` now uses the paginated public catalog sorted by newest (eight products) and the public shop directory (three shops). Real API failures never fall back to sample products. Shop logos, covers, locations, review counts and ratings come from shop profiles. Design-preview data remains explicitly labelled.
- Homepage sections have clearer typography/spacing, category artwork chosen by category meaning, two category collection links, shop cards, a cash-on-delivery explanation and expandable shopping questions. Unknown category types use their actual name. Short catalogs, one/two shops and missing categories receive appropriate layouts; the hero never points at a nonexistent categories anchor.
- `components/product-card.tsx` and its CSS module provide consistent image framing with `object-fit: contain`, readable titles/prices, aligned buttons, stock state, loading feedback, added confirmation and inline errors. Missing/broken images show a fallback. Available variant selection and existing cart/authentication behavior remain intact.
- `components/storefront-image.tsx` also handles failed shop logos/covers. Real shop ratings are displayed only when reviews exist.
- `components/site-header.tsx` keeps search/navigation reachable while scrolling. The mobile menu closes on Escape and restores focus to its button; search and category links preserve normal navigation.
- The footer links to existing screens and the shopping explanation. The homepage uses its existing hero benefits instead of repeating the footer trust strip; other storefront screens retain that strip.
- Styling lives in `components/storefront-home.module.css`, `components/product-card.module.css` and `app/storefront-polish.css`. Header/footer rules are scoped to storefront elements; seller/admin workspaces retain their own styling.

No wishlist buttons, fabricated discounts, countdowns, sales counts, popularity claims, delivery promises or placeholder support/policy links were added. Collection imagery uses available product images or code-native category artwork.

## Validation

- Next.js production build, TypeScript, targeted ESLint and `git diff --check` pass.
- Eight storefront screens at seven widths passed 56 overflow checks: home, catalog, product, shops, shop detail, cart, checkout and user profile. Desktop/mobile screenshots were inspected.
- Six controlled API states at three widths passed 18 more overflow checks: sparse catalog, one product/shop, no products, completely empty data, no categories and product API failure. These also cover long titles, a large price, sold-out stock, absent/broken photos, shop branding fallbacks, zero reviews, signed-out cart feedback and server-data retry after recovery.
- Additional browser assertions verify desktop/mobile search, collection filtering, cart count/confirmation, expandable questions, sticky navigation, keyboard Escape/focus, reduced motion and unchanged theme tokens. No runtime exceptions occurred.
- The actual configured storefront returned HTTP 200 and rendered the new layout using the live API, without sample data. All fixtures were served by a temporary loopback-only API against an isolated source copy; no customer data was changed.

Ignored screenshots and browser reports are under `.next/storefront-polish-review`. The validation fixture API and source-copy servers are stopped after verification.
