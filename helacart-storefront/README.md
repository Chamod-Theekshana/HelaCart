# HelaCart buyer storefront

This is HelaCart's Next.js 16 web application. For the current project overview, screenshots, features, and full local setup, start with the [repository README](../README.md). The notes below describe the original storefront and dashboard implementation; newer feature documentation is linked from the repository README.

The same Next.js app has a Seller Center at `/seller` using the buyer site's teal and navy theme. Its Merchant Hub design follows the supplied Stitch seller dashboard ZIP: fixed merchant sidebar, utility bar, overview cards, catalog tabs and table, stock matrix, COD order queue, delivery receipt preview, product editor and application states. Approved sellers can use products, variants and stock, COD orders, and delivery settings screens. New sellers can apply at `/seller/apply`. Pending or rejected sellers see the corresponding application state. Every seller operation sends the Firebase ID token to the existing guarded API; the browser UI alone does not grant access.

## Finding screen files

Screen implementations have descriptive names in `screens/storefront`, `screens/user`, `screens/seller` and `screens/admin`. For example, edit `screens/seller/seller-orders-screen.tsx` for seller orders or `screens/admin/admin-profile-screen.tsx` for the admin profile. Use the [complete URL-to-screen index](./screens/README.md) to find any screen.

The `app/**/page.tsx` files are short Next.js route entries that point to those screens. Next.js requires the `page.tsx` convention for routing.

## Run it on Windows

In PowerShell:

```powershell
Set-Location C:\HelaCart\helacart-storefront
Copy-Item .env.example .env.local
npm ci
npm run dev
```

Open http://localhost:3000. Without an API URL, this runs an **explicit design preview** with example products and orders. You can inspect the cart UI; placing an order is disabled.

To connect the backend, set these in `.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_FIREBASE_API_KEY=your-web-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-web-app-id
```

Restart `npm run dev` after changing the variables. Enable Email/Password in Firebase Authentication. Your API must run on port 4000 with `CORS_ORIGINS=http://localhost:3000`. These Firebase settings are public client configuration, never a service account or database URL.

When connected, the storefront uses the existing NestJS endpoints: public categories/products, Firebase ID token protected addresses/cart/COD checkout/orders, notifications, and return requests. It shows only approved products that the backend returns. Buyer email verification, stock, shipping fees, and totals are enforced by the backend.

The Seller Center uses `/auth/me` to identify approved memberships and `/seller-applications/me` for application status. It loads the seller's private product list and orders, creates/edits products, uploads images to configured R2 storage, submits products for admin review, adjusts stock with movement history, advances or cancels COD orders, and saves the per-seller delivery fee. The included API has one small addition: `/auth/me` also returns each member store's `shippingFeeLkrMinor` so the settings page can show its current value. Use the included backend or apply that change to your local backend if you extract only the storefront ZIP.

Some useful routes: `/seller`, `/seller/products`, `/seller/products/new`, `/seller/inventory`, `/seller/orders`, `/seller/settings`. A product's detail and stock history are available from the products list. The catalog tabs, category and stock filters, and CSV export operate on the currently loaded rows. Product lists and orders load the latest 50 rows supplied by the current API. The UI reports this limit when reached. The delivery checkout receipt uses a clearly labelled illustrative item subtotal with the real configured fee.

The Stitch ZIP supplied example product photographs by remote Google URLs. They are used **only in preview mode** and may stop loading. Real catalog images come from the API's `imageUrls`. The original supplied logo is in `public/helacart-logo.png`.

Without `NEXT_PUBLIC_API_URL`, Seller Center shows a clearly labelled visual preview with sample store records; all writes are disabled. For live seller testing, use a Firebase account with a verified email and an approved seller membership. If image uploads are needed, configure the API's R2 variables; alternatively the product editor accepts HTTPS image URLs.

## Production readiness

A deployed web app cannot reach `localhost:4000` on your PC. Host the API at a public HTTPS URL, put that URL plus `/api/v1` in `NEXT_PUBLIC_API_URL`, add the web origin to API CORS and Firebase Authorized domains, then rebuild. Test a verified buyer, approved seller/product, stocked variant, seller delivery fee, address, and COD checkout before taking real orders.

The Stitch designs contain illustrative courier SLAs, COD settlements, commissions, conversion claims, support numbers and product certifications that are not backed by this API. Those claims are not presented as live seller data. This release does not add a real payout dashboard or courier dispatch integration.

## Admin Operations

Open `/admin` in the same Next.js app. The Stitch-themed admin area includes an overview, seller applications, product approvals, categories, read-only orders, returns and COD reconciliation. It reads the existing API and allows confirmed administrative decisions through its guarded endpoints. In preview mode, sample data is labelled and all admin writes are disabled.

For live use, set the API's `ADMIN_FIREBASE_UIDS` to the Firebase UID of an email-verified administrator, restart the API, and sign in on the storefront. The API re-verifies the bearer token and admin allowlist on protected requests. Current lists have a 50-row limit; local searches filter only the loaded records. See `../ADMIN-STITCH-IMPLEMENTATION.md` for the route list and setup checklist. The ZIP's illustrative payout and courier screens have no corresponding API workflow, so the admin UI does not present them as working features.
