# Admin Operations UI from Stitch

The Next.js storefront includes a responsive HelaCart Operations area at `/admin`, adapted from `stitch_helacart_admin_panel_ui.zip`. It uses the existing HelaCart teal, navy, white and pale blue theme.

## Screens and backend wiring

| Route | Supported workflow |
| --- | --- |
| `/admin` | Live queue counts and recent orders from existing API lists |
| `/admin/seller-applications` | Review and approve/reject pending sellers with recorded reasons |
| `/admin/products` | Inspect listing, variants and images; approve/reject submissions |
| `/admin/categories` | List active categories and create new ones |
| `/admin/orders` | Inspect latest COD orders and seller order status, read-only |
| `/admin/returns` | Review, approve/reject, and record resolution notes |
| `/admin/cod` | Reconcile delivered COD amounts or record a dispute with explanation |

API list responses are capped at 50, and text search applies to loaded rows. Stitch mockups for courier dispatch, real payouts, KPI trends and document verification have no matching backend contracts and are not offered as working operations.

## Setup in PowerShell

1. Back up your current `C:\HelaCart\helacart-storefront`. Merge this storefront source into that folder, keeping your private `.env.local`.
2. In the API `.env`, set `ADMIN_FIREBASE_UIDS` to your administrator's Firebase UID, keep the existing API environment settings, and restart the NestJS API.
3. Set `NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1` and your Firebase browser app settings in storefront `.env.local`. Add `http://localhost:3000` to API `CORS_ORIGINS`.
4. Run `npm ci`, `npm run build`, then `npm run dev` in the storefront folder.
5. Open `http://localhost:3000/admin`; sign in with that administrator account and verify the Firebase email.
6. Test application and product review with pending records, then COD reconciliation with a delivered COD order. Confirm changes via the API and buyer/seller views.

This UI update does not require a new migration. The included API source is the prior Seller Center compatible backend. If `NEXT_PUBLIC_API_URL` is empty, `/admin` displays explicitly labelled sample data and disables every write. The API guard verifies the administrator on each protected request; browser navigation does not grant admin access. Do not put an Admin SDK private key or Neon URL in the storefront.

## Validation

`npm run build` passed for all seven admin routes, and `npm run lint` passed with only image optimization warnings. Live Neon/Firebase mutation tests must be run with your configured local services.
