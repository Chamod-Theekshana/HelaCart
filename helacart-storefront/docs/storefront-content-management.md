# Category and hero management

The existing teal/navy theme and default hero artwork remain in place. Admin content controls are under **Categories** and **Storefront appearance** in the admin navigation.

## Categories

- Create categories with a name, URL slug, optional description and display order. Lower display orders appear first.
- Edit names, descriptions and order while preserving existing URL slugs. Slug updates are rejected by the API.
- Uncheck **Active category** and save to archive, or check it to restore. Both actions have confirmation dialogs. Archived categories are excluded from public category lists and new seller category choices; their products are excluded from public browsing. Existing product/order records are retained.
- Only empty categories can be deleted. The backend checks product absence and revision when deleting, and the foreign key prevents a racing product insert from losing its category.
- Upload, preview, replace and remove a category photo or illustration. JPEG, PNG and WebP are supported, up to 5 MB. Images fit inside a square area; missing or failed images use the existing category artwork. Image changes save immediately.
- Admin lists include active and archived categories, server-side search, pagination and counts of all products, including drafts/hidden listings. Public responses omit image storage keys.

## Hero

Open `/admin/appearance` to edit the eyebrow, heading, accent line, description, primary button label/link and image description. Button links must point to supported `/products` or `/shops` paths, with optional filters.

Desktop and mobile images can be uploaded separately. Suggested sizes are 1600 × 1200 and 900 × 700 pixels; uploads accept JPEG, PNG or WebP up to 5 MB. Mobile falls back to desktop when no mobile image is set; no desktop image restores the original artwork. Text stays separate from images.

Text is saved with **Save draft**. Image changes save to the draft immediately while preserving unsaved local text edits. Preview supports desktop/mobile widths and comparison against the published version. Save text before publishing. **Publish hero** shows a confirmation and copies the saved draft to the public hero atomically. Draft edits and uploads do not change the public homepage.

Removing/replacing a draft image preserves any image still used by the published hero. After publication, replaced managed images are cleaned up. Failed concurrent uploads clean up their newly uploaded objects. Storage failures are reported without claiming success; cleanup failures after a committed change are logged for retry.

Admin operations reuse verified Firebase admin allowlisting and token revocation checks. Revision checks prevent stale category edits, image uploads and hero publication from overwriting newer changes. Public image fields are server-managed; arbitrary URLs cannot be saved through text DTOs. Public reads use no-store caching and expose only published hero content.

## Product photos

Shared product cards now use a 1:1 photo area on desktop, tablet and mobile. `object-fit: contain`, explicit image bounds and removal of image zoom keep tall and wide products fully visible. This applies to the homepage new arrivals, catalog and shop product cards.

## Backend and validation

The additive `20261022010000_storefront_content` migration adds category metadata, image references/revisions and a singleton hero draft/published record. It has been applied to the configured database. Existing categories retain their links and active state; the default hero appears until an admin publishes edits.

New endpoints live under `/api/v1/admin/categories`, `/api/v1/admin/storefront/hero` and public `/api/v1/storefront/hero`. Existing category creation and public category routes remain compatible. Images use the existing public R2 configuration under a dedicated `storefront/` prefix.

- API: 65 unit and 151 HTTP checks pass; schema validation, TypeScript, lint and production compilation pass.
- Real database/R2: `helacart-api/scripts/verify-storefront-content.mjs` passes 19 checks, rolls back all database changes, and removes all three temporary images. No customer category or hero changes are retained.
- Browser: 88 fixture assertions plus a mobile preview layout check pass, including 28 overflow checks at 1440, 1200, 1024, 820, 768, 390 and 320 px; tall/wide photo containment is checked at each width.
- Storefront: TypeScript, targeted lint and an isolated production build pass. Browser fixtures substitute admin access only in an ignored source copy; real authorization is covered by HTTP tests.

Ignored fixtures, screenshots and browser reports are under `.next/storefront-content-review`. The application source contains no fixture authorization overrides.
