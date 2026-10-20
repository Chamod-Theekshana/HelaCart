# Start here: HelaCart COD backend update

1. Back up your current `C:\HelaCart\helacart-api` source and development database.
2. Merge the `helacart-api` source into your working copy. Keep your existing `.env`
   and Firebase service-account JSON; do not overwrite either. Check for your own
   source changes before replacing files.
3. In PowerShell inside your existing API folder run `npm ci`.
4. Set up Cloudflare R2 and add all five `R2_*` variables from `.env.example` to
   your existing `.env` if you want image uploads.
5. Run `npm run db:deploy`, then `npm run db:status`. This release has seven
   checked-in migrations including `20261015030000_operations`. Never use
   `migrate reset` against your working database.
6. Run `npm run check`, then restart `npm run start:dev`.
7. Check `http://localhost:4000/api/v1/health/ready` for `database: connected`.
8. Use `helacart-api/README.md` for PowerShell tests of image uploads,
   notifications, admin-reviewed returns and COD reconciliation.

This update adds operational safeguards to the COD pilot backend. Read
`helacart-api/OPERATIONS-RUNBOOK.md` before a public release. Actual R2,
Neon/Firebase integration, web and mobile clients, real remittance and production
security/operations must still be completed and tested. No private keys or `.env`
files are included.

## Buyer storefront UI

The `helacart-storefront` folder now contains the Next.js buyer storefront
implemented from the supplied Stitch design. See `helacart-storefront/README.md`
for local setup, Firebase browser settings and API integration. Run the API on
port 4000, then start the storefront on port 3000. Without configuration it shows
an explicitly labelled visual preview and does not submit real COD orders.

## Seller Center UI

The same Next.js project now includes `/seller` for approved sellers. It has
product creation and review submission, variants, inventory adjustment, order
status changes and delivery fee settings. Apply the included `helacart-api`
change to `src/auth/auth.service.ts` alongside the storefront: the seller
settings screen reads `shippingFeeLkrMinor` from `/auth/me`. Merge source files
with your existing working copy and keep your local `.env` files. No new
database migration is required by this UI update. See the storefront README
for available routes and preview behavior.

## Stitch Merchant Hub UI update

The seller screens have been adapted from `stitch_helacart_seller_dashboard_ui.zip`.
Replace the storefront source with the included updated folder while preserving
your `.env.local`, then run `npm ci`, `npm run build` and `npm run dev`.
Open `http://localhost:3000/seller`. The included API is the same previous
Seller Center backend; no migration is required for this visual update.

## Admin Operations UI

The storefront now includes the Stitch-themed `/admin` area for seller and
product approvals, categories, read-only orders, return cases and COD
reconciliation. Use a verified Firebase UID in the API's `ADMIN_FIREBASE_UIDS`.
See `ADMIN-STITCH-IMPLEMENTATION.md` for setup, routes and current API limits.
