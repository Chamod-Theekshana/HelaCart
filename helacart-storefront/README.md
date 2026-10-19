# HelaCart buyer storefront

This is the Next.js 16 storefront inside `HelaCart-pre-dev`, rebuilt from the supplied Stitch screens. It includes home, catalog/search, product detail, Firebase email/password sign-in, cart, address/COD checkout, order confirmation, and buyer account/orders.

## Run it on Windows

In PowerShell:

```powershell
Set-Location C:\HelaCart\HelaCart-pre-dev\helacart-storefront
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

The Stitch ZIP supplied example product photographs by remote Google URLs. They are used **only in preview mode** and may stop loading. Real catalog images come from the API's `imageUrls`. The original supplied logo is in `public/helacart-logo.png`.

## Production readiness

A deployed web app cannot reach `localhost:4000` on your PC. Host the API at a public HTTPS URL, put that URL plus `/api/v1` in `NEXT_PUBLIC_API_URL`, add the web origin to API CORS and Firebase Authorized domains, then rebuild. Test a verified buyer, approved seller/product, stocked variant, seller delivery fee, address, and COD checkout before taking real orders.

The Stitch designs contain illustrative ratings, discounts, courier names, guarantees and support numbers that are not backed by this API. Those claims were not made live in the UI. Seller/admin dashboards are outside this buyer storefront milestone.
