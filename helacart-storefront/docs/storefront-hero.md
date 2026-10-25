# Storefront hero

Admin editing, desktop/mobile images, draft preview and publishing are documented in [Storefront content management](./storefront-content-management.md).

The homepage uses `components/storefront-hero.tsx` and its CSS module. The hero remains available when the catalogue is empty or unavailable. Its primary action opens `/products`; its secondary action opens the categories section when available, or `/shops` when there are no categories. See [the storefront polish notes](./storefront-polish.md) for the current mobile layout and validation.

The illustration is saved in the project at `public/marketplace-hero.webp` (1374 × 1145, approximately 177 KB). It was generated with the built-in image generation tool, then encoded as WebP for the website. The original generation remains at `C:/Users/Chamod/.codex/generated_images/01a1584b-cd51-7a93-8eb2-e71e27628c71/exec-c6c4c3b8-109c-4a6a-bea6-ca22eb6cd92c.png`.

The illustration is decorative marketplace inspiration, with no product-specific prices, offers or availability claims. Shopping buttons are HTML links with visible keyboard focus and touch targets of at least 48px. Reduced motion preferences disable smooth anchor scrolling.

## Validation

Browser checks passed at widths 320, 360, 390, 430, 600, 768, 820, 1024, 1280 and 1440. The image loaded at every size, neither the hero nor the page overflowed, both action targets remained at least 48px tall, and the primary action stayed within the first 900px of the page. The catalogue link, category scroll/focus, and reduced motion behavior passed with zero uncaught browser errors. TypeScript, ESLint and `git diff --check` passed.

Local preview screenshots are in `.next/storefront-review/hero`.

## Final generation prompt

Use case: ads-marketing. Asset type: an original photographic website hero illustration for HelaCart, a Sri Lankan multi-seller shopping marketplace. Create one beautiful premium editorial product still life, nearly square composition, with no typography. A thoughtfully arranged small selection of everyday finds: a natural woven palm tote basket, soft folded cream linen with a sage green linen shirt draped neatly, a sculptural ivory ceramic coffee mug and small terracotta bowl, unbranded matte forest-green over-ear headphones, and a small amber glass bottle without any label. Arrange on two low warm sand-colored display plinths, with the tote toward the back, linen in the middle and ceramics in the foreground. Cohesive colors: warm ivory #f5f1e8, sandy beige, deep HelaCart teal #006b61, muted sage, tiny touches of terracotta. Backdrop a seamless warm cream studio wall with a subtle large pale sage curved architectural arch, a cropped tropical palm-leaf shadow falling from the upper right, and very soft warm morning sunlight. Authentic tactile woven fibers, linen and matte ceramic details. Restrained, curated, modern lifestyle campaign, sophisticated yet approachable; realistic soft contact shadows. Camera at a natural slightly elevated three-quarter front angle, with generous clear space around the products and 10% margin from each edge so the group remains complete on mobile crops. All objects visibly grounded, no floating objects. Landscape-ish square crop with subjects arranged as a single group centered slightly right. No people, no text, no letters, no labels, no logos, no watermark, no UI, no prices, no sale stickers. This image sits in the right half of a website hero; page heading and buttons will be rendered separately as HTML.
