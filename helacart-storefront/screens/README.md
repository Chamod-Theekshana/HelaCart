# HelaCart screen files

Open these descriptive files when editing a screen. `app/**/page.tsx` files are the small route entries required by Next.js; each entry points to its screen below. Shared UI stays in `components/`, and shared data/helpers stay in `lib/`.

Screen implementations retain their server/client boundaries, metadata and original logic. For a new route, add a descriptively named `*-screen.tsx` file to the relevant folder, connect it from `app/.../page.tsx`, and update this index.

## Storefront

| URL | Screen file |
| --- | --- |
| `/` | [storefront-home-screen.tsx](./storefront/storefront-home-screen.tsx) |
| `/auth` | [auth-screen.tsx](./storefront/auth-screen.tsx) |
| `/cart` | [cart-screen.tsx](./storefront/cart-screen.tsx) |
| `/checkout` | [checkout-screen.tsx](./storefront/checkout-screen.tsx) |
| `/order-success` | [order-success-screen.tsx](./storefront/order-success-screen.tsx) |
| `/products` | [product-catalog-screen.tsx](./storefront/product-catalog-screen.tsx) |
| `/products/[id]` | [product-details-screen.tsx](./storefront/product-details-screen.tsx) |
| `/shops` | [shop-directory-screen.tsx](./storefront/shop-directory-screen.tsx) |
| `/shops/[slug]` | [shop-details-screen.tsx](./storefront/shop-details-screen.tsx) |

## User

| URL | Screen file |
| --- | --- |
| `/account` | [user-account-screen.tsx](./user/user-account-screen.tsx) |
| `/account/profile` | [user-profile-screen.tsx](./user/user-profile-screen.tsx) |
| `/account/returns` | [user-returns-screen.tsx](./user/user-returns-screen.tsx) |
| `/account/security` | [user-security-screen.tsx](./user/user-security-screen.tsx) |
| `/orders` | [user-orders-screen.tsx](./user/user-orders-screen.tsx) |
| `/favorites` | [user-favorites-screen.tsx](./user/user-favorites-screen.tsx) |

## Seller

| URL | Screen file |
| --- | --- |
| `/seller` | [seller-overview-screen.tsx](./seller/seller-overview-screen.tsx) |
| `/seller/apply` | [seller-application-screen.tsx](./seller/seller-application-screen.tsx) |
| `/seller/inventory` | [seller-inventory-screen.tsx](./seller/seller-inventory-screen.tsx) |
| `/seller/orders` | [seller-orders-screen.tsx](./seller/seller-orders-screen.tsx) |
| `/seller/products` | [seller-products-screen.tsx](./seller/seller-products-screen.tsx) |
| `/seller/products/[id]` | [seller-product-details-screen.tsx](./seller/seller-product-details-screen.tsx) |
| `/seller/products/new` | [seller-create-product-screen.tsx](./seller/seller-create-product-screen.tsx) |
| `/seller/reviews` | [seller-reviews-screen.tsx](./seller/seller-reviews-screen.tsx) |
| `/seller/settings` | [seller-delivery-settings-screen.tsx](./seller/seller-delivery-settings-screen.tsx) |
| `/seller/shop` | [seller-shop-profile-screen.tsx](./seller/seller-shop-profile-screen.tsx) |

## Admin

| URL | Screen file |
| --- | --- |
| `/admin` | [admin-overview-screen.tsx](./admin/admin-overview-screen.tsx) |
| `/admin/categories` | [admin-categories-screen.tsx](./admin/admin-categories-screen.tsx) |
| `/admin/appearance` | [admin-storefront-appearance-screen.tsx](./admin/admin-storefront-appearance-screen.tsx) |
| `/admin/cod` | [admin-cod-reconciliation-screen.tsx](./admin/admin-cod-reconciliation-screen.tsx) |
| `/admin/orders` | [admin-orders-screen.tsx](./admin/admin-orders-screen.tsx) |
| `/admin/products` | [admin-product-approvals-screen.tsx](./admin/admin-product-approvals-screen.tsx) |
| `/admin/profile` | [admin-profile-screen.tsx](./admin/admin-profile-screen.tsx) |
| `/admin/returns` | [admin-returns-screen.tsx](./admin/admin-returns-screen.tsx) |
| `/admin/review-reports` | [admin-review-reports-screen.tsx](./admin/admin-review-reports-screen.tsx) |
| `/admin/seller-applications` | [admin-seller-applications-screen.tsx](./admin/admin-seller-applications-screen.tsx) |
