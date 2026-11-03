# Buyer UI reference implementation — 29 October 2026

The supplied prompt lives at `../HelaCart_UI_Codex_Reference/helacart-ui-reference/CODEX_FLUTTER_PROMPT.md`, rather than a `design-reference/` directory. Its README, navigation update, HTML/CSS/JavaScript and buyer specification were read locally. No hosted preview access is required. `NAVIGATION_UPDATE.md` overrides the original Account-tab arrangement.

The later [mobile UI/UX refinement](ui-ux-polish.md) standardizes control sizes, typography and spacing across features. Linked screenshots have been refreshed for that revision; the original three-render validation below records the foundation work.

## Implemented in this revision

| Area | Native implementation |
| --- | --- |
| Theme | White shopping surfaces, warm cream hero, teal/navy tokens, bundled Inter and Plus Jakarta Sans, 48px minimum button targets |
| Home | Circular profile control, centered original logo, notification count from the inbox, location/address entry, search and working filter shortcut, photographic hero with authoritative storefront copy, circular category strip, new products, offers, recommendations, local-shop strip and COD messaging |
| Shared product cards | Square `BoxFit.contain` images, quiet rounded backgrounds, independent favorite targets, two-line titles, wrapping prices, real stock, option selection and guarded add-to-bag actions |
| Five-tab shell | Home, Categories, Bag, Favorites, Orders; preserved GoRouter branch state; navy curved bar and shared moving cutout/teal circle animation; selected semantics, cart count, safe-area handling, reduced-motion support and measured labels for enlarged text |
| Account drawer | Native modal drawer covering the whole shell, profile/guest state, grouped existing destinations, independently scrollable links, close button, backdrop/Escape/swipe dismissal, bottom sign-out with confirmation |
| Categories | Reusable image tiles and real API category destinations |
| Bag | Existing shop groups, quantities and authoritative subtotal; checkout action fixed above the bottom navigation; checkout remains a focused route |
| Session privacy | Header/drawer/avatars show only resolved profile/photo data, so prior-account imagery and details are not retained during replacement loading |

The supplied full logo and H icon are preserved under `assets/brand/`. The full wordmark is displayed through a clipped viewport accounting for the original square file's whitespace, without stretching or redrawing it. Existing native app icon/launch assets are retained. `assets/images/home-reference.jpg` is the decorative home photograph supplied with the web reference. Photography provenance follows the reference README; live catalog images still come from the API.

## Integration boundaries

No changes were made to Firebase configuration, authentication service behavior, DTOs/generated models, repository interfaces/implementations, API client, cart mutation coordination or checkout recovery/idempotency. No new packages or API endpoints were introduced. Browser localStorage behavior, sample accounts, simulated delivery and fixture orders were not imported into live flows.

The existing explicit `DESIGN_PREVIEW` repository remains read-only and labelled. It is never a fallback after a live API failure. Home keeps async loading/error/empty states; category and product failures retain retry actions. Profile loading failures in the drawer have a retry control. Cart/checkout continue to use backend stock, quotes and COD totals without inventing fees or silently placing partial orders.

The app still needs a reachable existing API and the existing platform Firebase client configuration for account operations. This revision introduces no new backend dependency.

## Route and state audit

The [existing route coverage](screen-coverage.md) maps the original 01–64 specification to implemented destinations, sheets and inline states. The shared theme and product controls now reach discovery, details, favorites and purchase screens. Search/filter/sort, variants, saved addresses, two-step COD review, order confirmation/recovery, package tracking, returns/refunds, reviews, account security and private text support retain their existing service-backed implementations.

This revision does **not** claim a new pixel-level reconstruction of every detail/form/state in that larger specification. Screen-specific layout refinement beyond the Home/categories/cards/navigation/Bag foundation remains possible. Real-account staged checkout, real email links, photo uploads, interrupted network/device behavior and physical-device/iOS acceptance testing remain manual checks. Native push delivery, account deletion and approved published legal-policy readers remain future scope, as before.

## Visual review

These are native Flutter widget renders at 390 logical pixels with the bundled fonts and decoded images, using the labelled read-only preview; they are not device screenshots:

- [Home](ui-review/home-390.png)
- [Account drawer](ui-review/drawer-390.png)
- [Shared product cards](ui-review/products-390.png)

## Run

Validation completed for this revision:

| Check | Actual result |
| --- | --- |
| `dart format --output=none --set-exit-if-changed lib test tool` | 48 files checked, zero changes, exit 0 |
| `flutter analyze` | No issues found |
| `flutter test` | All 161 tests passed |
| Native widget visual review | Three 390px renders inspected with bundled fonts, icon font and decoded asset images |
| Responsive/accessibility regression | Existing 360/390px and 1.8× text checks passed, plus new large-text drawer and five-tab tests |
| Android debug build | ARM64 and x86-64 APKs built successfully with live configuration; no device installation/testing in this revision |

New interaction checks cover tab selection including Bag, drawer Escape/swipe/backdrop dismissal, the Home filter shortcut, sticky Bag checkout, focused checkout hiding navigation, and clearing the old identity from an open drawer during an account switch. Existing network, checkout recovery, cart, price/stock, reviews and after-sales tests passed. The screenshot harness was an additional successful local check, separate from the 161-test suite.

Debug outputs: `build/app/outputs/flutter-apk/app-arm64-v8a-debug.apk` and `app-x86_64-debug.apk`. The build emitted an existing Firebase plugin warning about future built-in Kotlin compatibility; no package upgrades were made as part of this UI change.

From `helacart_buyer_mobile_app/`, with the existing API on port 4000:

```powershell
flutter pub get --enforce-lockfile
flutter run -d emulator-5554
```

For a labelled visual preview without the API:

```powershell
flutter run -d chrome --dart-define=DESIGN_PREVIEW=true
```

For a physical phone, supply its reachable API URL through the existing configuration described in the app README. The emulator's default `10.0.2.2` address is emulator-specific.
