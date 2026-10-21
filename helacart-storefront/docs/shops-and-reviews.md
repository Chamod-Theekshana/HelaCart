# Public shops and customer reviews

Shoppers can discover approved sellers at `/shops`, open `/shops/[slug]`, search that seller's products, filter by category and price, and sort products. The profile shows a public location, optional logo/cover, description, delivery fee, product count and published buyer ratings. Product seller names, homepage seller cards and buyer order cards link to the shop.

Seller Center adds `/seller/shop` for the public profile and JPEG/PNG/WebP logo/cover uploads (5 MB each), plus `/seller/reviews` for customer feedback and public replies. The shop slug remains stable when its name changes. Images use the existing public R2 product bucket; identity documents remain in the separate private verification bucket.

## Review rules

- A verified account needs its own delivered seller order from the exact shop. Shop owners/managers cannot review their own shop.
- One 1–5 star review per delivered seller order, enforced by a unique database constraint. Comments require 10–1500 characters. Buyers can optionally attach up to three JPEG, PNG or WebP photos, each up to 5 MB.
- Buyers can edit or soft-delete their reviews. Deleted reviews can be rewritten for the same order. Reviews hidden by moderation cannot be restored through buyer edits.
- Review access includes the latest 100 delivered orders and existing reviews (up to 1000), including older reviewed orders so their feedback remains editable.
- Public reviews expose a profile-name snapshot, rating, comment, dates and seller response. Buyer IDs, order IDs, email addresses, pickup addresses and verification documents are not public.
- Public ratings and breakdowns exclude deleted and moderated reviews. Product and review lists are paginated on the API.
- Shop members can write, edit and remove one public response per visible review.
- Photo selection includes previews and removal before saving. Updates can retain existing photo IDs, remove attachments and add replacements. Text and photo metadata commit together; failed uploads or concurrent edits keep the previous review intact. A photo revision counter prevents concurrent attachment updates from overwriting each other.
- Review photos use the private R2 bucket under a separate `review-photos/` prefix. Public image routes check the review, shop approval and photo visibility on every request and send no-store headers. Removed, deleted and hidden photos are unavailable publicly. Photos can be opened in a responsive dialog with keyboard navigation and Escape dismissal.
- Verified users can privately report another buyer's review once. The report records a text/rating snapshot.
- Reports also capture attached photo IDs. Administrators can inspect those photos after removal or moderation through authenticated image routes; photo rows and private objects are retained for that report history.
- `/admin/review-reports` requires the existing verified administrator allowlist and revocation checks. Administrators can hide the review (also excluding its rating) or dismiss the report with a recorded note. Decisions are transactional and cannot overwrite an already processed report.

## API and data

Shop identity verification is separate from selling approval and verified-purchase reviews. See [Verified shops](./shop-verification.md) for admin controls, badge behavior and audit details.

`helacart-api/src/shops` contains the public directory/profile/product routes, buyer review access and mutations, seller profile/image/reply routes, and administrator reports. The additive `20261021120000_public_shops_reviews` migration adds public profile fields, `ShopReview` and `ShopReviewReport`; it has been applied to the configured development database.

The additive `20261021150000_shop_review_photos` migration adds `ShopReviewPhoto`, the internal photo revision counter and reported photo snapshots. It has also been applied to the development database. Review PUT routes accept both existing JSON requests and multipart bodies (`rating`, `comment`, JSON `keepPhotoIds`, and up to three `photos` files). No new storage credentials are required.

API availability errors show retry/error states. Sample shops/reviews appear only when `NEXT_PUBLIC_API_URL` is absent and are labelled as design preview. No fabricated ratings are used in live mode.

Price filtering and sorting use each product's catalog base price, as in the catalog data model. A selected purchasable variant can have a different price.

## Verification (21 October 2026)

- API: Prisma validation, TypeScript, lint and production build passed. 42 unit checks and 69 HTTP checks passed, including delivered-order eligibility, ownership, self-review prevention, hidden reviews, conflicts, public field selection, image input limits and admin moderation.
- Storefront: TypeScript, targeted lint and isolated production build passed. An existing product-detail raw-image lint warning predates this work.
- Browser: six new screens at 1440, 1024, 820, 768, 600, 390 and 320 px, with no horizontal overflow. Eighteen navigation/filter/preview assertions passed.
- An isolated browser fixture passed fourteen authenticated UI assertions for create/edit/delete, star selection, report submission and seller reply create/edit/remove. Accounts and network mutations were mocked; customer data was not modified.
- Live development API/database: public shop, products and empty-review summary returned successfully. The running storefront rendered the real approved shop with HTTP 200 and no private profile fields in the public API response.

Review-photo follow-up: 52 unit and 81 HTTP checks pass. Twenty-six isolated browser checks cover native file selection, format/size/count limits, draft removal, failed-upload retry, attachment replacement/removal, keyboard photo viewing, deletion and seven responsive widths. Those browser writes use mocked accounts and requests. TypeScript, lint and both production builds pass. Private R2 photo upload/read/cleanup is checked with a temporary image; no customer records are changed.

Ignored screenshots and audit scripts are under `.next/shop-review`. The local test fixture is not part of the application source.
