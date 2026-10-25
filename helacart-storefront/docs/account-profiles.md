# Account and shop profiles

Implemented 21 October 2026.

## User

`/account/profile` adds an editable full name, optional contact phone and optional profile photo. The account header and storefront account link reflect the saved name/photo. A photo can be replaced or removed; initials appear without a photo. `/account/security` provides password changes, verification status and a verified email-change flow. Existing addresses, orders and returns stay accessible through the account navigation. Order, address and notification pages load only when their tab is active; account summary counters remain global.

## Seller

The seller profile is the shop itself at `/seller/shop`. There is no separate personal seller-profile editor. The top-bar profile link uses the shop name and logo.

- Public shop: name, description, town/district, logo and cover, plus the existing public shop link, products and reviews.
- Business details: private business contact number and pickup address; read-only approval and identity-front/back/business-registration metadata. The public shop API excludes these private fields. Identity documents continue to use the existing private seller-document storage and review flow.
- Login & security: the login email, verification, password and verified email-change settings.

The public profile and business-details mutations require a verified member of an approved shop. Shop identity documents and approval cannot be changed through these forms.

## Admin

`/admin/profile` adds the personal profile editor and security forms inside the existing admin access gate, linked from the sidebar and top bar. Editing personal details does not change administrator permissions. API role/email/user-ID fields are not accepted by the profile edit DTO.

## Storage and authentication

Migration `20261021130000_account_profiles` adds nullable phone and private avatar metadata to `User`, a version counter, a unique storage-key index and an avatar metadata consistency constraint. The additive migration was applied to the configured development database.

- `GET /api/v1/auth/me`: account and membership details; no private storage keys.
- `PATCH /api/v1/auth/me`: edit only the token owner's name and phone; requires verified email.
- `POST /api/v1/auth/me/photo`: one multipart `photo`; JPEG, PNG or WebP, 1 byte–3 MB, with MIME/signature checks.
- `GET /api/v1/auth/me/photo`: authenticated owner-only stream from the private R2 bucket, with private/no-store caching.
- `DELETE /api/v1/auth/me/photo`: remove private metadata and the stored object.
- `GET /api/v1/sellers/:sellerId/shop`: existing member-only route, extended with private business details and safe document metadata.
- `PATCH /api/v1/sellers/:sellerId/shop/business`: edit contact number and pickup address.

Photo replacements use a conditional database update to avoid overwriting a concurrent change. Failed replacements clean up the new object; successful replacements remove the previous one. Browser object URLs are revoked when the account/photo changes. Stored profile names are no longer overwritten by stale Firebase display-name claims; Firebase initializes the name when the account is first created. Email changes remain in Firebase and synchronize to HelaCart on the next authenticated profile read.

Password and email changes reauthenticate with the current password. Email changes call Firebase's `verifyBeforeUpdateEmail`; they do not directly update the database email. Connected-provider accounts manage those credentials with their provider. No real account passwords or emails were changed during verification.

## Validation

- 57 unit tests and 109 HTTP tests pass, including 12 new profile HTTP tests and two photo validation tests.
- `helacart-api/scripts/verify-profiles.mjs` passed 10 checks against the real development database and private R2 bucket. It creates temporary identities/shop records in an always-rolled-back transaction, tracks test R2 objects separately and removes them. Two test photos were removed; no customer records were changed.
- Six screen states across seven viewport widths passed 42 document-overflow checks against the production build, with no runtime exceptions. Buyer profile/security, admin profile, and the shop's public/business/security sections were inspected. Long names and email addresses also fit at desktop and 320 px widths.
- Thirty-one browser assertions passed with isolated mocked accounts/API requests and mocked Firebase security calls. They cover profile save/reset/error handling, avatar upload/removal, shop changes, private verification metadata, password confirmation/reauthentication errors, verified email-change handling and sign-out. These do not send emails or change real credentials.
- API/storefront TypeScript, targeted lint and production builds pass. All four profile/security routes returned HTTP 200 on the running storefront.

Ignored browser results and screenshots are under `.next/profiles-review`. Browser-only fixture exports and mocked Firebase helpers are confined to the isolated source copy and removed after the audit.
