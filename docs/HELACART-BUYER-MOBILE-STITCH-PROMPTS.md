# HelaCart buyer mobile app — Google Stitch prompt pack

Prepared from the local HelaCart source on 27 October 2026. This is a design specification, not a claim that a native mobile application already exists.

Includes **64 screen/sheet prompts**, **8 state-pack prompts**, **3 separately scoped future-feature prompts**, a master prompt, a shared sample dataset, navigation, and a final design review prompt. Sheets and alternate states are deliberately included: they do not all need separate app routes.

## How to use this pack

1. Start one Stitch project for the **HelaCart buyer mobile app**. Keep all screens in that project.
2. Paste the master prompt below first. Supply the existing HelaCart logo and, if available, the storefront screenshot as visual references. The repo contains `helacart-storefront/public/helacart-logo.png` and `docs/images/storefront-mobile.png`.
3. Generate **08 Home** first. Review its typography, teal/navy colors, product cards and navigation before generating the rest.
4. Paste one numbered screen prompt at a time. Alternatively, request a small related batch of two or three screens. Include the consistency prefix below, especially if the conversation has become long.
5. Use the same approved Home screen as the visual reference for every subsequent screen. Screen numbers are handoff identifiers, not user-visible labels.
6. Generate the state packs after the main journey. Generate F01–F03 only if those new capabilities are accepted for implementation.
7. Use the final review prompt to inspect the complete flow. Stitch output is a design/prototype; Firebase, API integration and native behavior require implementation afterward.

The one-screen/small-batch workflow is our recommendation for reviewing this project. Google's description of Stitch supports text/image input and iterative design refinement: [Introducing Stitch](https://developers.googleblog.com/en/stitch-a-new-way-to-design-uis/).

**Consistency prefix to paste with individual prompts:**

```text
Continue the existing HelaCart BUYER mobile app in this same project. Treat the approved Home screen and the master specification as the visual source of truth. Reuse their exact colors, fonts, navigation, spacing, cards, fields, icons and buttons. Generate only the screen or state requested below. Preserve the existing business rules and sample data. This is a native mobile interface, with no desktop website header or sidebar.
```

## What the repository actually supports

The buyer routes, shared components, DTOs and services were inspected alongside the documentation. Older root status/setup documents predate several implemented packages; the current source and feature-specific documentation take precedence for this pack.

| Area | Existing behavior | Design consequence |
| --- | --- | --- |
| Brand | Teal/navy, pale cool backgrounds, white surfaces; warm cream hero | Preserve the actual theme instead of choosing a new palette |
| Authentication | Firebase email/password, email verification, password reset, reauthenticated password/email changes | Email-first forms; verification is a link in email, not an SMS OTP |
| Guests | Public products, categories, shops, reviews, search and offers | Allow browsing before login; protected actions explain the sign-in requirement |
| Favorites | Account-based product favorites, unavailable saved entries, per-product price/restock preferences | Saved list, removable unavailable items and explicit alert opt-in |
| Discovery | Multiword search, suggestions, category/price/stock/offer filters, five sorts, recommendations | Focused mobile search/filter sheets; no fabricated personalization |
| Product details | Variants, gallery, stock, brand, specifications, warranty, effective promotion price | Explicit selected variant and matching price; complete product imagery |
| Shop identity | Public shop profile, cover/logo, public location, admin-controlled verified flag | Shop identity explanation; never present verification as a quality guarantee |
| Reviews | Product reviews and shop reviews are separate verified-purchase systems | Separate editors, summaries and eligibility rules |
| Review photos | Up to three photos on **shop reviews**; product reviews are text/stars | Photo controls only in the shop-review editor |
| Cart and checkout | Authenticated cart, verified-email commerce, shop grouping, destination quote, COD only | Multiple packages and one delivery charge per shop; no gateway screens |
| Addresses | List, add and delete; no update/default-address endpoint | Address creation/selection/removal; do not promise saved-address editing/default labels |
| Fulfillment | Per-shop PLACED → ACCEPTED → PACKED → SHIPPED → DELIVERED; cancellation before acceptance | Track packages independently; server-confirmed actions only |
| Tracking | Seller-entered courier name/reference and status history | Timeline and copy reference; no live driver map or courier ETA API |
| Returns | Delivered items/remaining quantities, default 14-day configurable window, admin decisions | Item-wise selection and actual deadline from eligibility response |
| Refunds | Seller-recorded cash/bank refunds, admin verification/correction | Record status is separate from movement of money; no buyer wallet |
| Support | Private text cases, optional shop-order link, participant roles, status history | Case-based conversations, no invented live-chat availability or attachments |
| Notifications | In-app inbox, unread count, read/read-all, links; favorite alerts | Inbox works independently of a future native push service |
| Mobile additions | Native shell, launch screen, welcome, share/copy, device photo chooser | New client presentation using existing features; implement native behavior later |
| Not yet established | Native push delivery, account deletion workflow, published legal content | Separate future prompts F01–F03; not part of the existing-backed core |

Source map:

- [Theme tokens](../helacart-storefront/app/globals.css), [hero styling](../helacart-storefront/components/storefront-hero.module.css), [home implementation](../helacart-storefront/screens/storefront/storefront-home-screen.tsx).
- [Screen/route index](../helacart-storefront/screens/README.md), [buyer data types](../helacart-storefront/lib/types.ts), [buyer commerce controller](../helacart-api/src/commerce/commerce.controller.ts), [address/checkout DTOs](../helacart-api/src/commerce/commerce.dto.ts).
- [Shop reviews](../helacart-storefront/docs/shops-and-reviews.md), [verified shop rules](../helacart-storefront/docs/shop-verification.md), [product feedback](../helacart-storefront/docs/product-feedback-and-permissions.md).
- [Delivery/tracking](../helacart-storefront/docs/delivery-tracking.md), [after-sales](../helacart-storefront/docs/after-sales.md), [profile/security](../helacart-storefront/docs/account-profiles.md), [discovery/promotions](../helacart-storefront/docs/search-recommendations-and-promotions.md).
- [Favorites behavior](../helacart-storefront/docs/product-favorites.md) is extended by the newer discovery/promotions document for alert preferences and discounted prices.

## Master prompt — paste this first

```text
Design a complete, high-fidelity native BUYER mobile application for HelaCart, a multi-shop marketplace for physical goods from independent sellers across Sri Lanka. Design Android-first while respecting iOS safe areas and familiar mobile interactions. This is a customer shopping app. The seller is the shop. Seller management and HelaCart owner/admin controls belong outside this buyer app.

BRAND AND VISUAL DIRECTION
Keep the existing HelaCart identity exactly. Use the supplied HelaCart shopping-bag/wordmark logo without redrawing or changing its spelling. Tagline: “Good finds. Local roots.” Make the experience feel carefully designed by a human: calm, useful, warm, photographic, uncluttered and credible. Show contemporary Sri Lankan shopping across fashion, tech, home, beauty, pantry and outdoor goods. Local craft imagery may support the brand but must not make the marketplace look restricted to handicrafts.

Use these existing tokens:
- Primary buttons and selected controls: deep teal #006B61.
- Secondary brand accents: teal #0D9488.
- Main headings/nav: navy #0F172A.
- Body text: #162435. Secondary text: #64748B.
- Main canvas: #F7F9FF. White cards: #FFFFFF.
- Quiet blue wash: #EDF3FF. Positive/teal wash: #E8FAF5.
- Borders: #E2E8F0. Error text: #B91C1C.
- Warm hero background: #F8F5EE.
The palette remains teal/navy throughout. Use semantic warning/error styling sparingly. Check text contrast; bright teal is an accent, not a replacement for readable dark text. Do not introduce a purple, orange or black luxury theme.

Headings: Plus Jakarta Sans, 600–800. Body: Inter, 400–600. Body text around 14–16, supporting text at least 12, page headings around 24–28. Use a consistent outline icon family. Use a 4/8-point spacing rhythm, 20px screen gutters, 12–16px card corners, restrained shadows and clear section spacing. Primary buttons approximately 50–52px tall; interactive targets at least 48px. Design the main frame at 390px logical width with a realistic 844px viewport; show complete scrollable content beyond the viewport where necessary. Provide a narrow 360px layout and support larger system text. Account for status bar, bottom safe area, keyboard and sticky actions. Main content scrolls vertically; horizontal scrolling is reserved for deliberate category/chip rows. Do not hide overflow by clipping text or controls.

NAVIGATION
Use five persistent top-level tabs: Home, Categories, Favorites, Orders, Account. Use a short label under each icon and teal selected styling. Cart is a distinct top-bar action with a quantity badge and is reachable from shopping screens. Notifications are reached through a bell with unread count. Shops, Offers, New arrivals and Search are discovery destinations reached from Home/Categories; no sixth bottom tab.
Keep the tab bar on top-level tab screens. Use a back-button detail shell for product/shop/review details, full-screen search, cart, checkout, package tracking and long forms. Hide the tab bar in focused purchase/form flows. A bottom sheet overlays its parent and must not show a second tab bar. Sticky actions must sit above the safe area and never cover the last content row. Remember the parent scroll/filter state on back navigation.

BUSINESS RULES
- Currency is LKR, displayed consistently as “Rs. 4,365.00”. Use Sri Lankan addresses/districts and phone examples. Display times in Asia/Colombo. English UI first; allow space for later Sinhala/Tamil translations without inventing a working language setting.
- Browsing is public. Sign-in uses email and password. New accounts verify their email through an email link. Protected commerce requires a verified email. Favorites can be saved by a signed-in account before verification; alert-setting changes require verification. Resume supported product/favorite intent after authentication, with no automatic order placement.
- A cart can contain several shops. Each shop has its own fulfillment, destination delivery fee and package. Final delivery fees appear after selecting a saved address. No address means an estimate, not a fabricated final charge. Delivery-unavailable shops block checkout until resolved. There is no silent partial checkout.
- CASH ON DELIVERY is the only payment method. Say “Pay when your order arrives.” There are no credit cards, online bank payments, wallets, points, subscriptions, payment gateways or buyer commission fees. Seller refunds can be recorded as cash or bank transfer without creating an online checkout payment method.
- Only approved active product offers are displayed. Discounts apply automatically; no coupon field. The selected variant’s effective price must agree across details, cart and checkout. Crossed-out price is its current base price, not an invented historical price. No fabricated scarcity or fake countdown.
- Shop verification means “Shop identity reviewed by HelaCart.” Show the badge only when the shop is verified. Approval to sell and buyer verified-purchase badges are different concepts. Never expose identity documents or private shop contacts.
- Product reviews require a delivered purchase of that exact product; one review per buyer/product, 1–5 stars, comment 10–1500 characters. Product reviews currently have no photo upload. Shop reviews require a delivered purchase from that shop, one review per delivered shop order, with the same rating/comment range and optional up to 3 JPEG/PNG/WebP photos, 5 MB each. Show seller replies, report actions and the buyer’s edit/delete controls where permitted. Hidden reviews cannot be republished through editing.
- Order tracking uses seller-entered states/courier/reference. There is no live map, driver contact, courier API or guaranteed arrival time. Show a saved estimate only if supplied. A buyer can cancel a shop package only before seller acceptance. Buyers cannot mark delivery or collection complete.
- Returns select purchased items and remaining quantities after successful delivery. Use the API’s actual return deadline; the default window is 14 days, not a fixed promise. A requested item value is not an approved refund. Refund entries record money already returned by the seller and separately show HelaCart verification. Do not imply the app transfers money or promises instant refunds.
- Support is a private text case. An order-linked case includes that buyer, that shop and HelaCart; a general buyer case is with HelaCart. No file attachments, voice/video calling, live-agent availability or guaranteed response time.
- Existing notifications are in-app, including order/tracking, support, returns and opt-in favorite price/restock alerts. Native push permissions and delivery are separately planned, not already implemented.

DESIGN QUALITY
Use square 1:1 product-image containers. Fit the full sellable product inside the frame with breathing room; crop lifestyle/cover photography only where intentional. Do not cut off headphones, clothing, packaging or handles. Never stretch images. Product titles may use two or three lines, but price, stock and the action have dedicated space. Cards in a row should align without pretending all titles have the same length. Show actual data or explicit empty states, never invented ratings, purchases or verified badges.

Create a reusable component sheet and the Home screen first. Other screen prompts will follow individually. Reuse that design system for every screen. Show realistic content, meaningful loading/empty/error states and reachable primary actions. Prefer native-feeling lists, sheets and forms instead of shrinking the desktop website.
```

## Shared example data — keep totals and identities consistent

These are **design fixtures**, not real customer/shop activity. An implementation must read live API values instead of hardcoding them.

| Fixture | Value |
| --- | --- |
| Buyer | Kasun Perera; `kasun@example.com`; `+94 77 123 4567` |
| Delivery | 42 Galle Road, Colombo 04, Colombo, 00400, Sri Lanka |
| Shop A | Ceylon Threads; public location Kandy; verified shop fixture |
| Shop B | Urban Living Store; public location Colombo; no verification badge |
| Product A | Handwoven Premium Cotton Linen Shirt; Natural / M |
| Product A base/effective price | Rs. 4,850.00 → Rs. 4,365.00; active 10% offer |
| Product A cart quantity | 2; line total Rs. 8,730.00 |
| Product A sample stock | Selected M has 6 available; L is sold out |
| Product B | Stainless Steel French Press Coffee Maker; 600 ml |
| Product B cart quantity/price | 1 × Rs. 3,650.00; line total Rs. 3,650.00 |
| Delivery charges | Shop A Rs. 350.00; Shop B Rs. 450.00 |
| Discounted merchandise subtotal | Rs. 12,380.00 |
| Delivery total | Rs. 800.00 |
| COD total | **Rs. 13,180.00** |
| Savings already included | Rs. 970.00; do not subtract this a second time |
| Package A COD total | Rs. 9,080.00 |
| Package B COD total | Rs. 4,100.00 |
| Return example | 1 of the 2 shirts; requested merchandise value Rs. 4,365.00 |
| Refund example | Merchandise Rs. 4,365.00 + delivery Rs. 0.00 = Rs. 4,365.00 |
| Shop-review summary fixture | Three reviews: two 5-star and one 4-star; average 4.7 |
| Product-review summary fixture | Two reviews: one 5-star and one 4-star; average 4.5 |

Use relative dates or coherent supplied dates so “today”, delivery, returns and refund payment chronology agree. Do not copy the old website screenshot's design-preview/debug banner into the consumer app.

## Screen prompts

### 01 — Launch / session restoration

```text
Design HelaCart’s native launch screen. Use a white or very pale cool canvas, the exact existing HelaCart logo centered, and a small “Good finds. Local roots.” tagline. Keep it quiet and quick; no mandatory countdown, fake progress percentage or marketing carousel. Include a restrained loading indicator for session restoration. Route to Home after restoration; public browsing must remain possible without signing in. Show a separate recoverable startup-error variant with “Try again” and “Continue browsing” only when browsing is actually available. No bottom tab bar here. Preserve the master teal/navy theme.
```

### 02 — Optional first-visit welcome

```text
Design an optional first-visit HelaCart welcome screen as a new mobile presentation, using existing marketplace capabilities. Show a warm, natural Sri Lankan lifestyle photograph, “Good finds. Local roots.”, and a short explanation of independent local shops and cash on delivery. Primary action “Start exploring” opens Home without login. Secondary “Sign in” opens authentication. Use one compact page rather than forcing a three-screen onboarding tour. Include “Skip” where appropriate. Never ask for notification, location, camera or identity permissions at launch. This screen must not claim every shop is verified or every product is locally manufactured.
```

### 03 — Sign in

```text
Design the HelaCart sign-in screen with a back button, brand, “Welcome back”, labelled Email address and Password fields, show/hide password, “Forgot password?”, a full-width teal “Sign in” button, and “Create an account”. Include “Continue browsing” as a secondary exit. No Google, Facebook, Apple, phone OTP or biometric sign-in buttons in this existing-backed scope. Provide incorrect-credentials, busy and network-error variants without exposing whether an email exists. A context banner may say “Sign in to save this product”; preserve the return destination after successful authentication. Keep inputs and submit reachable above the keyboard; no bottom tabs.
```

### 04 — Create account

```text
Design HelaCart’s account creation screen using email/password registration. Show Email address, Password with show/hide and its current minimum 6-character hint, and an optional client-side Confirm password field with mismatch validation. Do not require NIC, date of birth, shop information, delivery address or phone verification. Profile name and contact phone can be completed later. Add “Create account”, a busy state, and “Already have an account? Sign in”. On success continue to email verification, not a shopping success or order confirmation. Preserve a prior favorite/product destination. Do not add policy checkboxes linked to nonexistent published documents.
```

### 05 — Verify email

```text
Design a HelaCart email-verification screen showing the signed-in address, an envelope illustration in teal, “Check your email”, and clear instructions to open the verification link. Actions: “I’ve verified my email”, “Resend verification email” with busy/rate-limited feedback, and “Continue browsing”. Include checking, still-pending, expired-session and successful-verification states. This is an email-link flow, with no OTP digit boxes or SMS countdown. Explain that verified email is needed for ordering and protected account actions; signed-in favorites may still be saved. Successful checking returns to the intended shopping destination without placing an order automatically.
```

### 06 — Forgot password

```text
Design HelaCart’s Forgot password screen. Show a back arrow, “Reset your password”, one labelled email field, “Send reset link”, and “Back to sign in”. Explain briefly that password reset continues through the email link. Include valid-email, submitting, offline and rate-limited states with text beside the relevant control. Do not show an account-existence lookup or SMS verification. Keep the composition small and calm rather than filling the screen with decorative cards. Use the same form fields and keyboard-safe layout as Sign in. The successful request opens screen 07.
```

### 07 — Reset link requested

```text
Design the confirmation state after a password-reset request. Use an envelope/check icon and neutral text: “If this email has an account, a password reset link has been sent.” Display the entered email and suggest checking spam. Provide “Back to sign in” and “Use a different email”. Do not say the password has already changed, expose whether the account exists, or present a new-password form as though the in-app reset-link handler is already built. Keep this visually related to Verify email but clearly distinguish password reset from account verification. No bottom tabs.
```

### 08 — Home / visual anchor

```text
Design the main HelaCart buyer Home screen and establish the component system for all later screens. Top: exact logo, notification bell with unread badge and cart icon with quantity badge. Below: a full-width search field. Use a compact warm-cream photographic hero with “Good finds. Local roots.”, one short description and “Shop now”; products should become visible without scrolling through a huge advertisement. Then category tiles, “New arrivals”, a restrained “Explore offers” entry, recommendations and a local-shops row. Include COD and upfront-delivery-fee reassurance in a compact strip. Use square uncropped product images, honest shop badges and no fake ratings. Recommendation title is “Inspired by your favorites” only for the corresponding data basis; otherwise “Discover more”. Five bottom tabs, Home selected. Show a realistic 844px viewport plus scroll continuation.
```

### 09 — Categories

```text
Design HelaCart’s top-level Categories tab. Use a simple title, search entry and cart action. Present clear image/icon tiles for Fashion & Apparel, Electronics & Tech, Home & Kitchen, Health & Beauty, Ceylon Pantry and Sports & Outdoor, based on the supplied category fixture. Real category names/images are managed by HelaCart and can vary. Include “All products”, “New arrivals”, “Offers” and “Discover shops” as concise secondary navigation. Tapping a category opens the filtered product catalog. Do not invent category hierarchies, product counts or an endless subcategory sidebar. Include a missing-image fallback and category-load retry. Categories is selected in the existing five-tab bar.
```

### 10 — Product catalog / category listing

```text
Design the HelaCart catalog, reused for All products, a selected category and New arrivals. Show back navigation where entered from a parent, a search field, real result count, compact Sort and Filter controls, removable active-filter chips, and a two-column product grid. Cards need full square product imagery, favorite heart, shop name, two/three-line title, effective price, truthful stock state, and Add or Choose options. Preserve filters and position after product-detail back navigation. Include load-more/loading and end-of-results states using the API’s paginated results. Do not add unsupported rating filters, delivery-speed filters or fake bestseller counts. New arrivals uses newest sort.
```

### 11 — Search entry and suggestions

```text
Design a focused full-screen HelaCart search experience. Autofocus a clearly labelled search field with back/clear controls, a maximum 80-character input and useful keyboard search action. After two or more characters, show suggestions for product titles, categories and shops with distinct icons and a clear “See all results for …” row. Include debouncing/loading and a suggestions-unavailable state that still lets the buyer submit the query. Do not present fabricated trending queries, voice/image search, scan controls or a cross-device recent-search history. Any future local recent-search feature would need separate implementation. Preserve the last query on return from results. No bottom tab bar with the keyboard open.
```

### 12 — Search results

```text
Design HelaCart search results for “cotton shirt”. Keep the query editable and show a clear result count, relevant category context, Filter and Sort controls, and removable chips. Default to Relevance when searching. Use the same product grid and pricing rules as the main catalog. Include a no-results variant that repeats the query, offers Clear filters and Edit search, and never replaces a failed request with made-up products. Distinguish zero matches from a connection error with Retry. A shop-specific search must state “Search in Ceylon Threads” and stay inside that shop. Do not imply semantic AI, spelling correction or personalized search ranking that the API does not provide.
```

### 13 — Product filter sheet

```text
Design a tall HelaCart product-filter bottom sheet over the catalog. Sections: Category single selection from real categories, Minimum and Maximum price in LKR with numeric inputs, In stock only toggle, and Active offers only toggle. Use text inputs as the precise price controls; any slider must not invent an authoritative price distribution. Show validation when minimum exceeds maximum. Bottom actions “Reset” and “Apply filters”; preserve unapplied edits until applied or discarded. Active filters become removable chips in the catalog. Reuse this for shop products with that shop’s categories. Do not add brand, rating, distance or delivery-date filters unsupported by this scope.
```

### 14 — Product sort sheet

```text
Design HelaCart’s compact Sort by bottom sheet with single-choice rows: Relevance, Newest, Price: low to high, Price: high to low, and Name: A–Z. Show the current selection with a teal radio indicator and readable labels. Price sorting uses the cheapest currently available variant after an active approved offer. Applying a choice returns to the results while preserving query and filters. Relevance is the search default; Newest is the browsing default. Do not add Best selling, Most reviewed, Distance or Recommended for you as extra sort choices. Make the sheet reachable and dismissible with native back gestures.
```

### 15 — Offers

```text
Design an HelaCart Offers destination reached from Home or Categories. Use a restrained teal-accent introduction, “Offers from local shops”, followed by the existing product grid filtered to currently active approved campaigns. Show real offer names, effective prices and crossed-out current base prices only when a reduction exists. Filters and sorting reuse existing catalog components. Explain briefly that offers apply automatically; there is no coupon entry. Show an honest no-active-offers state linking to All products. Avoid aggressive flash-sale timers, coupon wallets, invented countdowns, stacked discounts, payment-method promotions or globally guaranteed percentage claims. Offer expiry can change the price before checkout; checkout reviews the current total.
```

### 16 — Product details

```text
Design HelaCart product details for the cotton linen shirt fixture. Top actions: back, favorite and cart. Show a full square product image, gallery indicators, title, category/brand if present, Natural / M selected, Rs. 4,365.00 effective price and Rs. 4,850.00 base price with the genuine 10% offer. Give stock and quantity controls space. Include seller row linking to Ceylon Threads, description, Specifications, Warranty if supplied, and product-review summary fetched separately. Add related available products below. A safe-area sticky bar shows selected price and “Add to cart”; multiple options open screen 17. Final destination delivery charge is confirmed at checkout. Do not display a shop verification badge without verified-shop data, or invent a Buy now shortcut.
```

### 17 — Variant and quantity sheet

```text
Design HelaCart’s product-option bottom sheet. Show a small shirt image, product title, selected effective price, and actual complete variant combinations such as “Natural / M” and “Natural / L”. Do not construct color/size combinations that have no corresponding variant. Mark the sold-out L option unavailable. Quantity stepper starts at 1 and respects current selected stock and the API limit. Selection changes the price, SKU and stock together. Include a full-width “Add to cart” button and inline stock-change/error state. Do not silently substitute a different size when the selected one becomes unavailable. Leave comfortable spacing between option chips, quantity and action.
```

### 18 — Full-screen product gallery

```text
Design HelaCart’s full-screen product-image viewer. Use an uncluttered dark or navy viewing surface as a media overlay within the existing theme, not a dark-mode redesign. Fit the entire product photograph, with close/back control, image position such as “2 of 4”, and an optional thumbnail strip. Specify swipe and pinch-to-zoom as native implementation behavior. Keep controls contrast-safe over all photographs and clear of notches. Provide missing-image recovery. Returning restores the selected gallery image and product detail position. Do not overlay pricing, unrelated advertising, fake reviews or a second bottom navigation bar over the image.
```

### 19 — Product description, specifications and warranty

```text
Design a readable HelaCart product-information screen or expanded section from Product details. Use tabs or clearly separated sections for Description, Specifications and Warranty, only when the data exists. Present seller-supplied brand and up to 20 name/value specifications as mobile-friendly stacked rows that wrap long values. Warranty is plain seller-provided text, not an HelaCart guarantee. Show a neutral “Not provided by this shop” state where needed rather than inventing terms. Keep an accessible back action and optional compact selected-product header. Do not create technical specifications, official certifications, return promises or delivery guarantees from the product photograph.
```

### 20 — Product reviews

```text
Design the shirt’s Product reviews screen, separate from shop reviews. Use the 4.5 average/two-review fixture and matching five-star histogram. Include rating filter chips and Newest / Highest rating / Lowest rating sorting. Each review shows public display name, verified-purchase label, purchased option, date, stars, comment, optional seller reply, and overflow Report. Own reviews expose Edit/Delete only when permitted. No product-review photo attachments or helpful-vote counters. Show “Write a product review” only after eligibility resolves; otherwise explain sign-in, verification or delivered-purchase requirements. Include empty, loading and review-fetch-error states. Shop reviews are reached from the shop profile, not mixed into this feed.
```

### 21 — Write / edit product review

```text
Design HelaCart’s Write product review form for an eligible delivered shirt purchase. Include product identity, purchased option label, 1–5 selectable stars with text meaning, comment field with 10–1500 character validation/counter, and “Publish review”. Edit mode preloads the buyer’s existing rating/comment and changes the action to “Save changes”. State that each buyer has one review per product. No camera, photo upload, order selector or seller-reply editor. Include submitting, retry, unsaved-back confirmation and stale-edit conflict states that refresh rather than overwrite another edit. A moderated-hidden review is read-only for publishing; do not offer a way to republish it. Delete is handled by screen 64.
```

### 22 — Report review

```text
Design a reusable private Report review bottom sheet for either a public product review or a public shop review. The parent context must clearly identify which kind. Include a short review excerpt, “Tell HelaCart what is wrong”, a required reason text field, Submit report and Cancel. Use backend-supplied validation limits. Only show reporting for another buyer’s published review and an eligible verified account. After submission show “Report sent to HelaCart” without promising removal, a response deadline or exposing moderation outcomes. Handle already-reported and request-failure states. This action does not delete the public review immediately. Keep report content private and avoid a public accusation banner.
```

### 23 — Shop directory

```text
Design HelaCart’s Discover shops screen. Show a back button, “Good finds. Great little shops.”, a shop-search field and real result count. Use generous shop cards with cover or fallback artwork, logo or initials, shop name, public location, actual average/count and product count. Ceylon Threads may have the verified fixture badge; Urban Living Store must not. An unreviewed shop says “No reviews yet”. Cards lead to the shop profile. Support search, paginated loading and empty/error states. Do not add Follow shop, chat-now, private contact numbers, distance sorting, verified-only filters or a map search without a separately implemented capability.
```

### 24 — Shop profile / Products tab

```text
Design Ceylon Threads’ HelaCart shop profile. Use a tasteful cover photograph, overlapping shop logo, name, public location, real 4.7/3-review summary and a verified-shop badge. Badge tap opens screen 60 with the exact identity-review explanation. Tabs: Products, Reviews, About. Products contains “Search this shop”, category/price/stock/offer filters and the shared two-column product grid scoped only to this shop. Include cart and back navigation. Covers may crop intentionally; product images must remain complete in square containers. Do not add shop-admin edit controls, private pickup address, identity documents, Follow shop or direct messaging. Preserve the shop tab and filters when returning from a product.
```

### 25 — Shop About

```text
Design the About tab of the same Ceylon Threads shop profile. Reuse the cover/logo/header and tab treatment from screen 24. Present public shop description, public location, joined date if returned, category links and the standard delivery fee only when configured. Clearly say “Final delivery fee is confirmed for your address at checkout”; a standard fee is not a guarantee for every district. Include “Browse products” and “Read shop reviews”. The public profile response does not contain the full district-delivery matrix, so do not fabricate one here. Exclude private business contacts, identity verification files, owner login details, bank data and internal review notes.
```

### 26 — Shop reviews

```text
Design the Reviews tab of Ceylon Threads using 4.7 from three reviews, with two 5-star and one 4-star reviews reflected in the breakdown. Show verified-purchase labels, public names, dates, comments, optional shop-review photos and nested seller replies. Include rating filtering and Newest / Highest / Lowest sorting. Show buyer Edit/Delete only on their own eligible feedback and Report on another review. “Review this shop” opens an eligible delivered shop-order selector when necessary; one shop review is allowed per delivered shop order. Explain ineligible/hidden states without suggesting that identity verification qualifies someone to write a purchase review. Keep product reviews separate.
```

### 27 — Write / edit shop review

```text
Design HelaCart’s Write shop review screen. Include shop identity, the buyer’s eligible delivered shop order, 1–5 stars, and a 10–1500 character comment. If multiple unreviewed eligible orders exist, offer a clear order selector using private purchase context only. Add optional up to three review photos with thumbnails, remove controls and JPEG/PNG/WebP, 5 MB per-image guidance. Edit mode retains existing attachments unless the buyer removes them. Show upload progress, failure/retry and save-conflict states without losing text. The photo total includes retained and new photos. Moderated-hidden reviews cannot be republished. A seller reply is not editable by the buyer. Use “Publish shop review” as the primary action.
```

### 28 — Shop-review photo viewer

```text
Design HelaCart’s shop-review photo viewer opened from screen 26. Show the selected review image fitted completely, photo position, close control, and a compact footer with public reviewer name, rating and a short comment. Support swiping among that review’s permitted photos and a neutral image-unavailable state if the review/photo has been removed or hidden. Never keep displaying a revoked private image just because it was once cached. Do not show buyer email, buyer ID, order ID, private storage URLs or seller verification documents. This viewer is for shop-review images only; it does not imply that product reviews support photos.
```

### 29 — Favorites

```text
Design HelaCart’s top-level Favorites tab, with saved count and current product entries. Prefer compact image-and-details cards or a relaxed grid with enough room for heart/remove, current price, stock and an “Alert settings” action. Use product-level favorites, not separate size/color wishlists. Multi-variant items use Choose options; a single available variant can Add to cart. Sold-out products remain saved. For hidden/deleted products, show a neutral unavailable entry using only its permitted saved title/shop snapshot and a Remove action; do not invent current photos/prices or link to restricted details. Include signed-out, empty, loading and retry states. Favorites tab selected; account changes immediately clear the previous account’s entries.
```

### 30 — Favorite alert settings

```text
Design a per-product HelaCart Alert settings sheet opened from Favorites. Show product title/thumbnail if still public, and independent toggles “Price drops” and “Back in stock”, both off by default. Explain that price alerts concern the product’s cheapest available option, and restock means any option becomes available; these are not size-specific subscriptions. Add “Save preferences”, success/error feedback and a refresh-needed state for concurrent settings changes. Unverified accounts get a verify-email action. Existing delivery is to the in-app notification inbox; do not promise phone push, email or SMS. Do not send an instant historical alert merely for enabling a preference. Removing a favorite removes its subscription.
```

### 31 — Multi-shop cart

```text
Design HelaCart’s cart using both sample shops. Group items by shop, show each product’s full thumbnail, title, selected option, effective unit price, quantity stepper, line price and Remove. Display merchandise Rs. 12,380.00. If a delivery address has not been selected, label delivery “Calculated at checkout” and avoid presenting Rs. 13,180.00 as a confirmed total. An address-quoted variant may show delivery Rs. 800.00 and COD total Rs. 13,180.00. State that shops deliver separately. Sticky “Continue to checkout” follows the authoritative can-checkout state. Include out-of-stock, quantity-changed and unavailable-shop rows requiring action. No silent partial checkout, swipe-only removal, coupon field or hidden service fee.
```

### 32 — Added-to-cart confirmation

```text
Design a compact HelaCart added-to-cart sheet or accessible snackbar with an optional expanded sheet. Show the exact selected shirt option, quantity and a clear success icon only after the API confirms the add. Actions: “View cart” and “Continue shopping”. Keep the underlying product context visible without an intrusive full-screen celebration. The cart quantity badge updates from actual data. Include an error counterpart for stock changes or a failed request; never use a success check for a timed-out write. A second tap while saving must not add duplicate quantities accidentally. This is cart confirmation, not order placement or stock reservation.
```

### 33 — Checkout / choose address

```text
Design step 1 of HelaCart’s focused COD checkout: Delivery address. Show progress “Address → Review”, a back action to Cart, and saved addresses as radio-selectable cards with recipient, phone and address. Add “Add new address”. Selecting an address triggers a visible delivery-quote loading state for all shop groups. Show unavailable-district feedback identifying the affected shop; block progression when the current quote cannot support the whole cart. Include no-address, address-fetch-failure and email-verification-gate states. No default-address badge, Edit saved address or GPS lookup because those capabilities are not part of this scope. Hide bottom tabs during checkout.
```

### 34 — Add delivery address

```text
Design HelaCart’s Add delivery address form, reusable from checkout and saved-address management. Fields: recipient full name, contact phone, address line 1, optional address line 2, city, Sri Lankan district selector and postal code. Use persistent labels, suitable keyboards, inline validation, and a full-width “Save address”. Show a coherent sample with Colombo 04 and postal code 00400. Do not use a US state/ZIP layout or add mandatory company, landmark, coordinates, NIC, address nickname or default-address fields. Cancel preserves the checkout draft. Saving in checkout selects the new address and refreshes the delivery quote. This creates a new record; it does not update an existing saved address.
```

### 35 — District selector

```text
Design HelaCart’s searchable district-selection sheet, reused in Add address. List the 25 Sri Lankan districts alphabetically with single-select radios and a sticky search field. Names are Ampara, Anuradhapura, Badulla, Batticaloa, Colombo, Galle, Gampaha, Hambantota, Jaffna, Kalutara, Kandy, Kegalle, Kilinochchi, Kurunegala, Mannar, Matale, Matara, Monaragala, Mullaitivu, Nuwara Eliya, Polonnaruwa, Puttalam, Ratnapura, Trincomalee and Vavuniya. Preserve the selected district and make the entire row tappable. Selection returns to the address form without clearing its other fields. District selection itself does not guarantee a shop delivers there; checkout computes destination availability separately.
```

### 36 — Checkout / review and place COD order

```text
Design step 2 of HelaCart checkout using the quoted sample address and both shop packages. Show recipient/address with Change, package A shirts Rs. 8,730.00 plus Rs. 350.00 delivery, package B French press Rs. 3,650.00 plus Rs. 450.00 delivery. Summary: items Rs. 12,380.00, delivery Rs. 800.00, total due on delivery Rs. 13,180.00. Savings Rs. 970.00 is already included. Payment is a single clear “Cash on delivery — pay when your order arrives” card. Per-shop estimates appear only when returned. Sticky “Place COD order · Rs. 13,180.00”. Include submitting, quote-changed/review-again and uncertain-network recovery states. No card fields, coupon input, wallet or online payment. Retry must check the same checkout attempt rather than risk a duplicate order.
```

### 37 — Order confirmation

```text
Design HelaCart’s confirmed COD order success screen. Show a restrained success illustration, “Order placed”, the actual order reference, total due on delivery Rs. 13,180.00, delivery address summary and two package cards. Explain that each shop fulfills separately and statuses can differ. Actions: primary “View order”, secondary “Continue shopping”. Make “Cash on delivery” clear; do not say “Payment successful” or “Paid”. Show estimated delivery only when the confirmed order contains a saved estimate, and do not imply a courier has accepted the shipment. A failed or uncertain checkout must never use this success screen until the order is confirmed by the server.
```

### 38 — My orders

```text
Design HelaCart’s top-level Orders tab. Include order-reference/recipient search and a compact status filter backed by actual package statuses: All, Placed, Accepted, Packed, Shipped, Delivered, Cancelled. Show order cards with placed date, reference, original COD total and separate shop-package status rows; a multi-shop order must not be reduced to a misleading single delivery status. Tapping opens screen 39. Include no-orders with Shop now, no matches, loading and retry states. Preserve search/status/page on back. Use accurate copy if only some packages are cancelled. No wallet balance, estimated cashback or unsupported reorder button. Orders tab is selected in the five-tab bar.
```

### 39 — Order details / package overview

```text
Design HelaCart’s private Order details screen. Show order reference/date, immutable delivery-address snapshot, payment method COD and original purchase totals. Group purchased items and delivery amounts by shop package, each with its independent status. Package A’s original total is Rs. 9,080.00; package B’s Rs. 4,100.00. Each package links to tracking and support. Only Placed packages expose Cancel; Delivered packages can expose eligible item returns, product-review actions and Review shop. Use bought prices/options even if the current listing changes. Cancelled/refunded amounts should be shown separately without rewriting the original order total. Do not expose commission, seller bank evidence or admin controls.
```

### 40 — Package tracking

```text
Design HelaCart’s package-tracking screen for one shop order. Show shop name, package reference, current status and a vertical timeline: Placed, Accepted, Packed, Shipped, Delivered. Completed steps have actual timestamps; future steps have no fabricated dates. Show seller-provided courier name, optional tracking reference with Copy, original dispatch date and saved delivery estimate if available. “Delivery updates provided by the shop” clarifies the source. Include cancelled, not-yet-dispatched and shipped-without-reference variants. Provide Get support. No live map, moving vehicle, driver photo/phone, invented Out for delivery event or guaranteed arrival countdown. Changes to tracking should not alter the original dispatch date.
```

### 41 — Cancel a shop package

```text
Design HelaCart’s cancellation confirmation sheet for a package still in Placed state. Identify Ceylon Threads, its selected order items and original package total. Explain that only this shop’s package is cancelled, other shop packages remain, and cancellation is available before seller acceptance. Buttons: “Keep order” and clearly labelled “Cancel this package”. No mandatory reason input because the current buyer-cancellation endpoint does not accept one. Include cancelling, confirmed and “This package has already been accepted” states with Refresh order. Do not offer cancellation for Shipped or Delivered packages or claim COD money has been refunded. Confirmation follows the server response.
```

### 42 — Returns and refunds overview

```text
Design HelaCart’s buyer Returns & refunds destination from Account and order details. Use two clear views: Return requests and Refund records. Return cards show shop, order reference, selected item/quantity, requested value, request date and Pending / Approved / Rejected / Resolved status. Refund cards show recorded amount and Awaiting verification / Verified / Rejected / Corrected status. Make it clear that a return request is not proof of a refund. Include status filtering where supported, paginated loading, retry and separate empty states. New returns start from an eligible delivered package, not a free-form product search. Link each card to its own detail screen.
```

### 43 — Return / select items and quantities

```text
Design step 1 of HelaCart’s item-wise return flow for a delivered Ceylon Threads package. Show the actual eligibility deadline returned by the API. List purchased items with bought option, purchased quantity, remaining returnable quantity and paid unit price. Select one of the two shirts with an explicit checkbox and bounded quantity stepper; requested merchandise value is Rs. 4,365.00. Previously pending/approved/resolved requests reduce the remaining allowance. Disable ineligible rows with explanations. “Continue” requires at least one valid item. Show an expired-window and concurrent-quantity-change state with Refresh. Do not hardcode a universal 14-day promise or let a buyer return an unpurchased item.
```

### 44 — Return / reason and submit

```text
Design step 2 of HelaCart’s return request. Summarize selected purchased items and quantities, show “Requested item value Rs. 4,365.00”, and a required text reason using the API’s current validation. Provide “Submit return request”, Back and an unsaved-draft confirmation. Explain that HelaCart reviews the request and this does not confirm refund approval or schedule a pickup. Include submitting, failure/retry and submitted confirmation with a link to Return details. Do not add return-photo upload, bank-details form, courier pickup slots, refund-speed promises or buyer-selected resolution buttons unsupported by the current return endpoint. The same retry must not create duplicate requests.
```

### 45 — Return request details

```text
Design HelaCart’s Return details screen. Show return reference, shop/order link, submitted reason, item/quantity rows, requested value and current status. Use a compact history of Submitted, review decision and resolution, only where those records exist. Display review reason and resolution note. Outcomes can be full verified item refund, partial verified refund, replacement or another agreed resolution; show only the actual recorded outcome. Linked refund records have their independent verification state. Provide Get support and Back to returns. Include pending, rejected and resolved examples. Do not automatically label approved returns as refunded, imply inventory was restocked, or offer a buyer-side admin approval control.
```

### 46 — Refund records

```text
Design HelaCart’s Refund records view, reusable as the second tab of screen 42 or a focused list. Group readable records by related return/order and show product, refunded item quantity, merchandise amount, delivery amount if any, total, paid-on date and record-verification status. Use plain labels “Awaiting HelaCart verification”, “Verified record”, “Rejected record” and “Corrected record” as appropriate. The sample total is Rs. 4,365.00. Explain briefly that these are seller-submitted records of actual cash/bank refunds, not an app wallet or bank transfer initiated here. Avoid claiming rejected records prove no money moved. Tapping opens screen 47; include no-records and load-error states.
```

### 47 — Refund record details

```text
Design HelaCart’s private Refund record details screen. Show related return item/order/shop, merchandise Rs. 4,365.00, delivery Rs. 0.00, total Rs. 4,365.00, actual cash/bank-transfer method, paid-on date and permitted reference/note. Clearly separate seller-recorded payment information from HelaCart’s verification date/status/review note. If corrected, retain the original record and show a distinct correction/reversal note; never imply a reversal recovered money from the buyer. Explain “This screen records and verifies a refund; it does not transfer money.” Provide Contact support and related-return navigation. Do not include Withdraw, Collect refund, wallet balance or an automatic bank-payment success animation.
```

### 48 — Support cases

```text
Design HelaCart’s My support cases screen. Show New case, case-title search, status selection and private case cards with title, category, shop/order context when linked, latest-update date and readable status. Statuses: Open, Under review, Waiting for buyer, Waiting for seller, Resolved and Closed. Distinguish general HelaCart questions from shop-order cases. Include empty, no-matching-cases, loading and retry states. Do not invent unread-message counts, online agents, response-time guarantees or an external WhatsApp channel. A row opens the conversation with participants/history. Keep this a calm case workspace rather than a social chat inbox. Access requires the appropriate signed-in verified account.
```

### 49 — Create support case

```text
Design HelaCart’s New support case form. Fields: optional related shop order, category, title 5–150 characters and message 10–4000 characters. Categories are Order issue, Delivery, Return, Refund, Account and Other. From an order, prefill and retain that exact shop-order context. General cases are with HelaCart; order-linked cases include the relevant shop. Show participant visibility before submit and a full-width “Create case”. Include validation, submitting, retry and successful navigation to the case. Do not request buyer/seller account IDs, let someone select another person’s order, or add attachment/camera controls. One uncertain retry must reuse the same case-creation attempt.
```

### 50 — Support conversation and history

```text
Design HelaCart’s private support conversation. Header: case title/reference, status and related order/shop. Show timestamped text messages with clear Buyer, Shop and HelaCart roles, plus a separate status/history section and recorded resolution when present. A keyboard-safe reply composer accepts 1–4000 characters, with Sending, Failed/Try again states that preserve the draft. Paginate older messages. Resolved cases can be reopened by a participant reply; Closed cases have a read-only composer and explain that HelaCart must reopen them. No message editing/deleting, attachment icon, typing indicator, read receipt, agent avatar claim, calls or voice notes. Keep all case data private to authorized participants.
```

### 51 — Account home

```text
Design HelaCart’s top-level Account tab. Show private avatar or initials, saved profile name, email and verification state. Concise summary tiles may show total orders, active packages, saved addresses and unread notifications from actual account summary data. Navigation rows: My profile, My orders, Favorites, Addresses, Notifications, My product reviews, Returns & refunds, Support cases, Account security, and Shopping help. Include Sign out. Guest mode shows Sign in/Create account while preserving public browsing. Do not expose seller/admin dashboards inside this buyer design or show buyer commission balances. Account selected in the five-tab bar. Profile name/photo changes must update this header consistently.
```

### 52 — Edit profile

```text
Design HelaCart’s My profile editor. Use private profile photo with Change photo, full name 2–100 characters, optional contact phone, and read-only sign-in email with a link to Account security. Full-width Save changes and a secondary discard/reset action. No date of birth, gender, NIC, public username, bank account, business profile or role selector. Phone is a contact field, not a verified login identity. Show saving, saved, invalid phone, upload failure and network retry states while retaining edits. An unverified account receives a clear verify-email gate for protected profile changes. A missing photo uses initials. The photo is an account image, not automatically a public reviewer avatar.
```

### 53 — Profile photo actions

```text
Design HelaCart’s profile-photo action sheet with Choose from photos, Remove photo if one exists, and Cancel. Use the native photo picker during implementation; do not fabricate an unrestricted gallery permission screen. Show JPEG/PNG/WebP, maximum 3 MB guidance and upload progress. Include unsupported-format, too-large, failed-upload and successful-update states; a failed replacement keeps the previous photo. Remove photo returns to initials. Do not add a camera option unless camera capture is separately implemented. Do not apply review-photo rules here: account photos allow one image with their own size limit. Keep this sheet visually consistent with other action sheets.
```

### 54 — Saved delivery addresses

```text
Design HelaCart’s Saved addresses screen with Add address and a readable list showing recipient, phone and full saved address. Each address has an explicit Remove action with confirmation. Reuse screen 34 for creation. Include no-address, removing, failure/retry and removed states. In a checkout-selection context, selected address means the choice for this checkout only. Do not show Edit, Make default, Home/Work nicknames or map pins because the current data/API only supports list/add/delete and has no default-address field. Explain in a confirmation that removing a saved address does not rewrite delivery information already snapshotted into previous orders.
```

### 55 — Notifications inbox

```text
Design HelaCart’s in-app Notifications screen with actual unread count, Mark all as read, manual refresh and a paginated chronological list. Use subtle unread dots/backgrounds and semantic icons for order/tracking, return/support, favorite price drop and favorite restock notices. Each row has supplied message, timestamp and a clear destination. Opening marks read and navigates only to an authorized buyer destination. Favorite-alert notifications link to the current product; current price can differ from an older alert. Include all-read, empty and load-error states. Do not add notification deletion, cross-device push toggles, email/SMS subscriptions or admin commission notifications. A missing/deleted destination needs a safe explanation rather than a broken route.
```

### 56 — Account security overview

```text
Design HelaCart’s Account security screen. Show sign-in email, email verification state, sign-in method and rows for Change password and Change sign-in email. Unverified users get Resend verification and Check verification. Email/password credentials are the currently supported buyer login; a connected-provider fallback can explain managing credentials with that provider without adding new login methods. Include Sign out and sensitive-action reauthentication explanations. Do not add working biometric login, SMS two-factor authentication, passkeys, a session/device revocation list or account deletion to this existing-backed screen. Keep optional future additions outside the core. Use the same verification badge and private form styling as Account.
```

### 57 — Change password

```text
Design HelaCart’s Change password form. Fields: Current password, New password and Confirm new password, all with show/hide controls. Reflect the current security-editor minimum of 8 characters and maximum 128, with mismatch and invalid-current-password feedback. Explain that the current password confirms this sensitive change. Primary “Update password”; busy state prevents duplicate submits. Success says the new password should be used on the next sign-in, without claiming all other devices were signed out. Include reauthentication failure and network retry that do not leak credentials. Keyboard and validation messages must not hide the submit action. Never prefill actual passwords in the mockup.
```

### 58 — Change sign-in email

```text
Design HelaCart’s Change sign-in email flow. Show current email read-only, New email and Current password, then “Send verification link”. Explain that the new address must be verified before it replaces the sign-in email. After the request, show a neutral “Check your new email” state, the intended address and instructions to finish verification and sign in again. Do not immediately mark the account email changed or update the header as if verification already succeeded. Include same-email, invalid-email, wrong-current-password, expired-session and network-error states. Use the same protected form layout as Change password; no OTP or administrator role controls.
```

### 59 — Sign-out confirmation

```text
Design HelaCart’s small sign-out confirmation sheet. Say “Sign out of HelaCart?” and explain that orders and favorites remain saved to the account. Actions: “Stay signed in” and “Sign out”. On completion return to public Home or the guest Account screen, clear account-specific views and avoid showing the previous buyer’s notifications/cart/profile. Do not say signing out deletes the account, empties the server cart or cancels orders. Preserve the familiar brand and readable actions rather than using an alarming full-screen error. Include a busy/error state if sign-out cannot complete; show success only when the local authentication state is actually cleared.
```

### 60 — Shop verification explanation

```text
Design a compact HelaCart Verified shop explanation sheet, opened by tapping a verified-shop badge. Show a teal verification icon, “Verified shop”, and the exact plain-language meaning “Shop identity reviewed by HelaCart.” Explain that this is different from a buyer’s verified-purchase review and does not guarantee every product, delivery date or purchase outcome. Include a single “Got it” action and optional link to that shop’s public reviews. Do not expose NIC/licence images, business registration, private reviewer notes, verification dates not provided publicly or admin identities. Unverified shops simply omit the badge; do not label them suspicious or rejected.
```

### 61 — My product reviews

```text
Design HelaCart’s My product reviews account screen. List only the signed-in buyer’s prior product feedback, including product title, bought option, stars, comment, date and seller reply where returned. Actions vary with actual permission: View product, Edit, Delete or Rewrite a previously deleted eligible review. If a product is unavailable or a review hidden by moderation, retain the permitted private history and explain the restriction; do not fabricate a public product link or republish action. This endpoint is product-feedback history only. Manage shop feedback from each shop’s Reviews tab and delivered order context rather than inventing an aggregated shop-history API. Include paging, empty and retry states.
```

### 62 — Own-review actions / restricted review state

```text
Design HelaCart’s own-review action sheet, reusable with a clear Product review or Shop review heading. Show Edit when permitted, Delete leading to screen 64, and View product/shop when publicly available. Include separate variants for moderated-hidden feedback and an unavailable listing: preserve permitted private text/history, offer deletion where allowed, and remove any republish/edit control that would bypass moderation. Shop-review edit may manage existing photos; product-review edit has no images. This action sheet does not give buyers control over seller replies or review reports. Explain a concurrent-change conflict with Refresh, preserving the draft instead of silently overwriting newer content.
```

### 63 — Shopping help / how HelaCart works

```text
Design a compact Shopping help screen using truthful explanatory content from HelaCart’s existing features. Sections: discover shops/products, choose an option, review delivery fees, place a COD order, track each shop package, review a delivered purchase, request eligible item returns, and contact support. Include clear links to Orders and Support cases. Explain verified-shop identity review, separate shop/product reviews, and that return eligibility/deadlines come from the order. Do not invent a toll-free number, live agent schedule, universal free delivery, instant refund guarantee or published legal policy. This is static mobile help presentation, not a claim that a separate FAQ CMS already exists.
```

### 64 — Delete own review confirmation

```text
Design HelaCart’s review-deletion confirmation sheet for either Product review or Shop review, clearly named. Show a short excerpt and explain that the feedback will no longer appear publicly; for a shop review its attached public review photos also become unavailable. Do not claim every internal moderation/audit record or stored photo is permanently erased. Actions “Keep review” and “Delete review”. Confirm only after the server succeeds, refresh rating summaries and show an accessible success message. Include failed-delete and stale-version/refresh states. Preserve the distinction between deleting review content and deleting the buyer account. No seller-reply deletion button and no power to delete another buyer’s review.
```

## State-pack prompts — required design coverage

These are alternate states/components, not extra permanent navigation destinations. Generate separate readable frames; do not cram all states onto one phone screen.

### S01 — Guest and email-verification gates

```text
Create HelaCart mobile state frames for: guest attempts to add to cart; guest saves a favorite; guest opens Orders; signed-in unverified buyer attempts checkout; unverified buyer saves a favorite successfully but tries to enable alert settings. Explain each actual requirement with Sign in, Verify email or Continue browsing as appropriate. Public browsing remains accessible. Preserve the intended product/favorite destination through authentication. Do not simulate a real server cart for guests, discard saved public browsing context, or place an order automatically after verification. Match the exact established form and sheet styles.
```

### S02 — Loading and refresh

```text
Create reusable HelaCart loading states for Home sections, product grid, product details, shop profile, cart, address quote, Orders, Notifications and Support messages. Skeletons must match the eventual layout, use restrained motion and respect reduced-motion preferences. Distinguish initial load from pull-to-refresh so existing content can remain readable during refresh. Recheck price/stock/delivery before purchase even if cached content is shown. Cart/checkout errors must never leave an apparently usable stale Place order button. No fake percentages or randomly generated product/financial data while the API is loading.
```

### S03 — Empty and zero-result states

```text
Create separate HelaCart empty states for no favorites, no orders, no addresses, no notifications, no product reviews, no shop reviews, no returns, no refund records, no support cases, no active offers and zero search results. Use one small brand-consistent illustration/icon, a specific sentence and a useful next action only where one exists. An unreviewed shop/product shows no invented rating. Distinguish filtered-zero from a genuinely empty account. Do not show “Start a return” without an eligible delivered order or invent sample records to fill the interface.
```

### S04 — Offline, failed requests and unavailable content

```text
Create HelaCart error frames for offline browsing, product fetch failure, shop unavailable, deleted product, failed favorites load and unavailable notification destination. Use precise Retry/Back/Continue browsing actions with recoverable context. Cached public content may be labelled as not recently refreshed; no offline checkout, returns submission or fake success. Private account data from a previous user must never appear after sign-out/account switch. When a shop/product becomes unavailable, remove protected purchase actions. Distinguish a server failure from no results. Keep the design helpful and compact rather than using frightening technical stack traces.
```

### S05 — Stock, offer and delivery changes

```text
Create HelaCart purchase-recovery states: selected variant sold out, quantity exceeds current stock, offer expired, product price changed, district delivery rate changed and one shop cannot deliver to the selected address. Identify affected items/shops and show the revised authoritative amounts before the buyer confirms again. Offer Change option, Update quantity, Remove item, Choose another address or Refresh quote as appropriate. No silent substitutions, silent partial checkout or automatic acceptance of a higher total. Keep original confirmed orders unchanged when current catalog prices change. Sticky purchase controls remain disabled while a valid quote is unavailable.
```

### S06 — Uncertain writes and safe retry

```text
Create HelaCart states for checkout timing out after submission, a return request with an uncertain response, a support reply failing, a favorite-setting conflict and a review-save conflict. Retain user-entered content. For uncertain checkout use “Checking your order” and a way to recheck/retry the same attempt, not an immediate new Place order action or a false “Order failed” conclusion. Success requires server confirmation. Reviews/settings with newer data need Refresh/review changes. Use calm copy and the same buttons; do not expose UUIDs, idempotency tokens or database versions to buyers.
```

### S07 — Session expired and account access restricted

```text
Create HelaCart session-expired and account-access-restricted screens. Session expiry offers Sign in again while preserving safe public destination/drafts and hiding stale private data. Restricted access explains that account access is currently unavailable, offers the available public browsing path and only an actually configured support route. Do not promise the blocked account can open an authenticated support case, show a made-up phone/email contact, or provide a client-side bypass. Private orders/refunds remain protected even if the user can still view public products. Avoid exposing internal admin reasons or other accounts’ information.
```

### S08 — Accessibility, long text and permission denial

```text
Create HelaCart QA frames at 360px width and enlarged system text for Home cards, Filters, Product details, Cart, Checkout, Order details, Profile and Support conversation. Use long shop/product names, large LKR values and a multi-line address. No price/action overlap, clipped headings, tiny tap targets or sideways page scroll. Keyboard must not cover errors/composers/submit buttons. Add upload-picker denied/cancelled and image-load failure variants using friendly fallbacks. Status uses text/icons as well as color. Reading order and labels support screen readers. Respect reduced motion. No global camera/location permission request is necessary for shopping.
```

## Future-feature prompts — separate implementation scope

The following are useful mobile additions, but **not existing backend capabilities confirmed by this audit**. Do not mix them into the accepted core prototype as if they work already.

### F01 — Native push permission and device preferences

```text
Design a FUTURE HelaCart native push opt-in flow. Show a contextual explanation after a useful action, such as placing an order or enabling a favorite alert, then a user-triggered operating-system permission request. Include Not now, permission denied, Open device settings and a device-level enabled state. In-app notifications continue independently. Favorite price/restock subscriptions remain explicit per-product preferences, not automatically enabled by granting push permission. This is planned design requiring device-token registration, push delivery and deep-link implementation. Do not put a fake OS permission dialog directly inside the app UI or claim push already works.
```

### F02 — Account deletion request and confirmation

```text
Design a FUTURE HelaCart account-deletion flow to be finalized with an implemented backend and approved retention policy. Show a clear explanation of what profile data would be removed/anonymized, what order/financial/support records may need retention, and how unresolved obligations affect the request. Include reauthentication, explicit confirmation and a true server-confirmed request status. Keep Delete account visually separate from Sign out. Do not promise instant deletion, a specific retention period, automatic order cancellation or deletion of every audit record. This is proposed scope, not a working button in the current account API.
```

### F03 — Privacy, terms and buyer policies

```text
Design FUTURE HelaCart document-reader screens for Privacy, Terms, Delivery and Returns policies, using reusable readable typography, document title, last-updated date, sections and back navigation. Content must be supplied and approved by HelaCart; use clearly marked content placeholders in the design handoff, not invented legal promises. Do not add sign-up consent links until the corresponding documents and destinations exist. Include accessible text scaling and a safe external-link style where needed. Keep these distinct from the existing factual Shopping help screen. This design requires published content and linked routes before release.
```

## Navigation and journey handoff

```text
01 Launch → 02 Optional welcome → 08 Home
03 Sign in ↔ 04 Register → 05 Verify email → preserved destination
03 Sign in → 06 Reset request → 07 Check email → 03 Sign in

08 Home → 09 Categories / 10 Catalog / 11 Search / 15 Offers / 23 Shops
11 Search → 12 Results → 13 Filters / 14 Sort → 16 Product
16 Product → 17 Options / 18 Gallery / 19 Information / 20 Product reviews
20 Product reviews → 21 Write/edit / 22 Report
23 Shops → 24 Shop products ↔ 25 About ↔ 26 Shop reviews
26 Shop reviews → 27 Write/edit / 28 Review photo viewer / 22 Report
24 Shop → 60 Verified-shop explanation

29 Favorites → 16 Product / 17 Options / 30 Alert settings
16/17 Product/options → 32 Added → 31 Cart
31 Cart → 33 Address → 34 Add address → 35 District → 36 Review
36 Review → 37 Confirmed → 39 Order details
38 Orders → 39 Order details → 40 Package tracking / 41 Cancel
39 Delivered package → 43 Return items → 44 Reason → 45 Return details
42 Returns/refunds → 45 Return details / 46 Refund list → 47 Refund record

48 Support → 49 New case → 50 Conversation
39/45/47 Order/return/refund → 49 Contextual case → 50 Conversation
51 Account → 52 Profile → 53 Photo actions
51 Account → 54 Addresses / 55 Notifications / 61 Product review history
51 Account → 56 Security → 57 Password / 58 Email / 59 Sign out
51 Account → 42 Returns/refunds / 48 Support / 63 Shopping help
61 Own feedback → 62 Actions → 21 Edit / 64 Delete
26/27 Own shop feedback → 62 Actions → 27 Edit / 64 Delete
55 Notification → appropriate authorized product/order/return/support destination

All protected flows → S01 authentication/verification as necessary
All remote data → S02 loading, S03 empty, S04 recovery
All purchase writes → S05 changed data, S06 safe retry
All sessions/forms → S07 access handling, S08 accessibility
```

## Suggested generation batches

| Batch | Frames | Purpose |
| --- | --- | --- |
| 1 | Master + 08, then 09, 10 | Establish visual system and shopping shell |
| 2 | 16–19, 31–37 | Validate the purchase path and totals early |
| 3 | 01–07, S01 | Launch, account and verification |
| 4 | 11–15 | Discovery, search, filters and offers |
| 5 | 23–28, 60 | Shop profiles, credibility and shop feedback |
| 6 | 20–22, 61–62, 64 | Product feedback and own-review management |
| 7 | 29–30, 55 | Favorites, preferences and notifications |
| 8 | 38–41 | Orders, package tracking and cancellation |
| 9 | 42–47 | Item-wise returns and refund records |
| 10 | 48–50, 63 | Support and help |
| 11 | 51–54, 56–59 | Profile, addresses and security |
| 12 | S02–S08 | Recovery, accessibility and alternate states |
| Optional | F01–F03 | Planned features requiring additional implementation |

Within each batch, request individual screens or a small pair/trio; the table groups related work, not a requirement to generate every listed frame in one request.

## Final Stitch review prompt

```text
Audit the complete HelaCart buyer mobile design against the master prompt and all generated frames. Produce a mismatch list, then refine affected frames while preserving the approved Home visual style.

Check:
1. Exact existing teal/navy palette, logo, fonts, icon family and reusable components.
2. Five top-level tabs only; cart and notifications remain reachable; detail/form screens use coherent back navigation.
3. All product cards use full square product imagery; long titles, prices and actions never collide.
4. Public browsing works before login; email verification is an email link; there is no unsupported social/OTP sign-in.
5. Product reviews and shop reviews have separate ratings, eligibility and editors. Photos appear only on shop reviews. Hidden reviews cannot bypass moderation.
6. Verified shop means identity review, not a guarantee. No private documents/contact details leak into public profiles.
7. The same selected variant/offer price appears across detail, favorites, cart and checkout.
8. Sample totals are correct: discounted merchandise 12,380 + delivery 800 = COD total 13,180. Savings 970 is not subtracted twice. Shop-package totals are 9,080 and 4,100.
9. Checkout is COD only, fees are destination-quoted, packages are shop-specific, and changed/unavailable quotes require review. No silent partial checkout or duplicate-order retry.
10. Tracking uses seller updates, not a live map; cancellation is only before acceptance; buyers cannot mark delivery complete.
11. Returns use actual remaining purchased quantities/deadlines. Refund verification is separate from money movement. No wallet, automated bank transfer or instant-refund promise.
12. Support is private text cases; no invented calls, attachments, read receipts or live-agent guarantees.
13. Saved addresses support add/select/delete only, with no fake edit/default-address capability.
14. Notifications are in-app. Push, account deletion and legal readers remain explicitly separate future scope.
15. Every remote screen has honest loading/empty/error states, every write has failure/retry, and all sensitive account state clears correctly on sign-out/switch.
16. At 360px and large text, there is no page overflow, clipped content, covered CTA or inaccessible control. Keyboard and safe-area space are respected.

Return a consistent set of named frames, reusable component definitions, and click-through links for the main browse → buy → track → review/return/support journey. Do not add new capabilities to make the prototype look busier.
```

## Definition of a complete buyer design handoff

- Every numbered core screen/sheet has a named frame or a documented reusable variant.
- The five-tab shell, detail shell, sheets and form keyboard behavior are consistent.
- The two-shop checkout can be followed end to end, with correct pricing and separate fulfillment.
- Product feedback, shop feedback, partial returns, refund records and support cases remain distinct.
- Empty, failed, stale and uncertain-request states are designed, not only the happy path.
- Future capabilities are visibly separated in the handoff and are not presented as already implemented.
- The delivered artifact is a design reference for the mobile implementation; it does not replace functional API integration or device testing.
