# Storefront reference refresh

Reference: the user-provided [Hela Island Market Lovable preview](https://lovable.dev/preview/NVWOzCAze9Y8dHs2eSjDfhufwmnCGhTX).

The reference uses a white search header, a full-width cream hero, a three-part shopping reassurance strip, photographic category tiles, an eight-product grid, paired collection banners, compact shop cards and a navy seller invitation. HelaCart now follows this composition using its existing teal, navy, pale blue and mint palette.

## Implementation

- The customer header links to existing products, category anchors, shops, buyer orders and Seller Center. Search remains connected to the current product query. Signed-in account avatars and cart loading/count states are retained.
- The hero uses the shared admin-managed content and desktop/mobile image fields. A local reference photo is used when an image is not configured or fails. The default copy is “Good finds. Local roots.” Existing saved/published admin content is preserved.
- Homepage category tiles prefer admin images. Curated local category photos are illustrative fallbacks for appropriate categories; other categories keep their existing artwork.
- New arrivals display up to eight actual catalog products in one grid. Product photo frames are square with `object-fit: contain`. Products with multiple variants link to their product detail for option selection. Low-stock labels use real available quantities; sold-out items remain disabled.
- Collection banners link to real category filters. Compact homepage shop cards use actual shop names, locations, descriptions, rating counts and admin verification status. The shop directory keeps its cover-based cards.
- The seller invitation links to the existing application flow. A compact shopping-help section retains payment, multi-shop delivery and return guidance. Footer links use existing account and shopping routes.
- Mobile places the hero message and actions before its image and uses a horizontally scrollable navigation row. The design accommodates 320-pixel screens.

Images in `public/marketplace/` were obtained through the supplied preview's viewer session and stored locally. They are used for hero/category/collection presentation. Catalog product photos and reviews continue to come from HelaCart data. No preview access tokens, external viewer URLs, demo products or fabricated ratings are added to application code or customer data.

## Further suggestions

1. Use a consistent set of category images through the existing admin category editor.
2. Add explicit admin selection and ordering of featured shops and collections. Current sections use available shop/category data automatically.

These are suggestions for later work; the refresh does not add a separate curation workflow.

## Verification

- TypeScript and targeted ESLint checks passed; API and storefront production builds passed.
- Existing backend suites passed: 77 unit and 151 HTTP tests.
- Browser verification passed 56 layout/navigation checks and 16 product/shop/image-state checks, with no runtime exceptions. Viewports included 1440, 1024, 768, 390 and 320 pixels.
- Checks covered square uncropped product images, multiple-variant option selection, low stock, disabled sold-out actions, working single-variant cart addition, cached broken image fallback, verified shops without reviews, verification explanations, and the admin hero preview.
- The layout audit used an isolated frontend with the existing demo catalog. The actual local storefront was also checked against its existing API configuration. No shop, product, review or order records were created or changed. The temporary preview server was stopped and its fixture routes removed. The normal local storefront/API remain available.
