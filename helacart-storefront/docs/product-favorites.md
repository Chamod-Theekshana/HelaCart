# Product favorites

Buyers can save products from the heart on a product card or the **Save to favorites** button on product details. Saved hearts use the existing teal theme. **My Favorites** is available at `/favorites`, in the storefront navigation, account navigation and footer.

## Behavior

- Favorites are saved per signed-in Firebase account and persist across devices. A guest heart click opens sign-in with the exact product as the return destination. A short-lived session intent resumes the save after authentication, including for a new account whose email is not verified yet. Existing checkout email-verification rules remain unchanged.
- Favorites are product-level entries. Single-variant products retain Add to cart; products with multiple variants retain Choose options.
- The list uses current public product prices, stock and shop information. Sold-out products stay saved. Hidden products, suspended shops and archived categories become unavailable entries with the previously saved public title/shop snapshot. Physical deletion sets the product reference to null, preserving an entry the buyer can remove.
- Duplicate saves are idempotent. A database unique index prevents duplicate account/product pairs. Saves lock the account row to enforce the 500-item limit across concurrent requests. Lists are paginated, newest first, with 12 items per page by default.
- Removal is idempotent and scoped to the current account. Removing another account's or a missing entry has no effect and does not disclose ownership.
- Account changes immediately hide previous hearts, rows, counts and messages. Late requests cannot populate another account's state. Focus/visibility refreshes update the saved-product index.
- Failed reads have explicit retry states. Interrupted write responses refresh the server summary. Removing a recovered favorite clears its pending sign-in intent so it is not added back on reload. Sign-in return paths are restricted to supported local destinations.

## API and database

All endpoints require a Firebase bearer token and return `Cache-Control: no-store`:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/v1/me/favorites/summary` | Own saved IDs and count for hearts/navigation |
| GET | `/api/v1/me/favorites?page=1&limit=12` | Own saved products with current availability |
| PUT | `/api/v1/me/favorites/products/:productId` | Idempotently save a public product |
| DELETE | `/api/v1/me/favorites/:favoriteId` | Remove an owned entry, including deleted-product entries |

Migration `20261025010000_product_favorites` adds `ProductFavorite`, account/product uniqueness and pagination indexes. It was applied to the configured database. The table does not modify products, cart quantities, inventory or orders. No shop-following, shared wishlists or price/stock alerts are added.

## Verification

Backend tests cover ownership, idempotency, pagination validation, hidden/deleted products, current prices, stock-field privacy and the account limit. `helacart-api/scripts/verify-favorites.mjs` checks the actual services and PostgreSQL constraints in a disposable schema that is removed afterward.

Run `node --experimental-strip-types scripts/verify-favorite-intent.mjs` from the storefront to check storage handling, identity claims and safe sign-in redirects.

Browser verification uses real providers, API guards and isolated database records with a test-only Firebase identity adapter. The adapter is confined to the ignored audit copy; production Firebase integration is retained. No customer product, review, cart or order fixtures are inserted into the public schema.

The completed run passed 89 unit tests, 168 HTTP tests, 10 real database checks, 19 storage/redirect checks and 100 browser checks with zero runtime exceptions. TypeScript, lint and both production builds passed. The audit servers were stopped, the isolated schemas removed, and normal Firebase source restored in the audit copy. The regular local storefront and API remain available.
