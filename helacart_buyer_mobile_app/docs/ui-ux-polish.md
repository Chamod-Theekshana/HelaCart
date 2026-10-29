# Mobile UI/UX refinement — 29 October 2026

The review covered shared controls and the existing catalog, detail, cart, checkout, authentication, account, orders, notifications, support, reviews and after-sales presentation files. The work refines the native layouts while retaining the supplied HelaCart palette, original logo artwork, five tabs and rounded moving navigation cutout.

## Findings and changes

| Finding | Refinement |
| --- | --- |
| Material defaults made headings, form text and list rows compete for attention | Explicit type hierarchy: 28px welcome/hero, 22px page introductions, 18px sections/headers, 15px card headings, 14px body/input text, 12px supporting text |
| Some primary buttons felt too tall or heavy | 48px primary/secondary actions, 13px medium-weight labels, consistent 12px corners and horizontal padding |
| Small icon backgrounds looked oversized | Smaller visible favorite/header circles inside native 48px touch targets |
| Section action links inflated gaps above card lists | Reduced section margins, compact links, consistent separation between heading and content |
| Card action positions shifted when prices wrapped | Product rows share their natural height, preserving two-line titles and complete square product images; bottom actions align without fixed card heights |
| Too many full-width buttons competed in saved cards and the inbox | Secondary actions sit side by side where space allows and stack with 8px separation at larger text sizes |
| Status labels became full-width pills inside stretched columns | Badges hug their actual label, including in order/package cards |
| Form/sheet margins differed between features | Shared 20px screen/sheet gutters and 12px default element gaps; 16px card padding retained |
| Product/total prices dominated content | Detail price reduced to 24px and emphasized totals to 18px |
| Login recovery link appeared below the primary submission action | Forgot password sits beside the password field; account/browsing links form a compact wrapping group |
| Navigation labels sat against the bottom edge | Added bottom breathing room while retaining the requested large rounded navy shoulders and concentric selection circle |
| Sticky actions lacked a clear content boundary | Shared action area has a quiet divider, safe-area padding and a consistent action inset |
| Cart groups had trailing blank space between item controls and the card edge | Removed repeated trailing row padding and added separators only between items |
| Search counters and profile-field counters added visual clutter | Hidden presentation counters while retaining length limits and validation |
| Order/support status filters used a different field style | Outlined, labelled dropdown fields match the search/form controls |
| Long navigation labels broke awkwardly at enlarged text | Concise Browse/Saved labels at larger system text sizes; full Categories/Favorites accessibility labels retained |
| Review address looked disabled and low contrast | Checkout review shows the selected address as a readable, read-only summary; address creation remains in the address-selection step |
| Currency values split awkwardly beside long labels at large text sizes | Summary labels and amounts stack when needed, giving the complete amount its own line |

Typography continues to honor system text scaling. Layouts grow and secondary actions stack when necessary. No fixed maximum text scale, clipped form labels or reduced touch targets were introduced.

## Boundaries

All changes are in presentation, theme and documentation. Repository interfaces, API calls, Firebase authentication, generated models, cart coordination, stock checks, authoritative quotes, COD checkout and recovery behavior are retained. Sample content remains restricted to the explicit read-only preview and automated test fixtures.

Real-account acceptance testing and physical-device/iOS checks remain separate from widget rendering and automated layout checks. Native push, account deletion and legal-policy reader scope is unchanged.

## Validation and visual artifacts

The complete existing regression suite passes **161 tests**, covering public and authenticated routes, 360/390px layouts, 1.8× text, variant stock, two-shop COD totals, session changes, cart actions, checkout recovery and after-sales flows. Flutter analysis reports no issues, and Dart formatting passes.

The retained [visual review helper](../tool/capture_ui_test.dart) runs 18 additional widget-render cases and writes 21 native screenshots, using bundled fonts and decoded assets. It includes normal/narrow catalog layouts, drawer, authentication, cart, both checkout steps, account forms, orders, notifications and large-text saved/inbox/order layouts. These are widget renders, not physical-device screenshots. Images named `fixture` use automated-test accounts/data; public preview images use the explicit sample catalog. No real order is submitted by the renderer.

```powershell
flutter test
flutter test tool/capture_ui_test.dart
flutter analyze
dart format --output=none --set-exit-if-changed lib test tool
```

Selected renders:

- [Home](ui-review/home-390.png)
- [Catalog and aligned product cards](ui-review/products-390.png)
- [Sign in](ui-review/sign-in-390.png)
- [Saved product card](ui-review/favorites-fixture-390.png)
- [Bag and sticky checkout action](ui-review/bag-fixture-390.png)
- [Checkout review](ui-review/checkout-review-fixture-390.png)
- [Orders](ui-review/orders-fixture-390.png)
- [Notification actions](ui-review/notifications-fixture-390.png)
- [Large-text catalog](ui-review/catalog-360-large-text.png)

The main implementation changes are in `app/theme/helacart_theme.dart`, `core/ui/widgets.dart`, `core/ui/buyer_navigation.dart` and the feature presentation files. The native service/data layers are unchanged. Before-polish screenshots are retained locally under the ignored `.artifacts/ui-before-polish/` directory.

Android debug outputs are `build/app/outputs/flutter-apk/app-arm64-v8a-debug.apk` for ARM64 phones and `app-x86_64-debug.apk` for the local emulator. They use the existing development API/Firebase setup; physical phones need the existing reachable-API configuration documented in the app README.
