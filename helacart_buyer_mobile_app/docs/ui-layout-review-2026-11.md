# Mobile layout review — 3 November 2026

The review addresses oversized controls, avoidable label wrapping and crowded
headings across the buyer app. The existing teal/navy palette, fonts and native
navigation remain in use.

## Changes

| Area | Result |
| --- | --- |
| Buttons | Primary surfaces are 44 logical pixels high; outlined/compact surfaces are 40. Both retain at least 48-pixel touch targets. Padding, icon sizes and label spacing are consistent. These are minimum heights, so accessibility text can grow. |
| Secondary actions | Buttons take the space their labels need and move as whole controls to another row when necessary. Equal-width columns no longer squeeze longer labels into two lines. |
| Section headings | A competing action moves below the heading when both cannot fit. Titles keep their available width. |
| Orders | Shop names and status badges move onto separate rows when needed; currency values remain together; tracking/cancellation actions have consistent separation. |
| Addresses | Edit, phone verification, default selection and removal share a compact action area. Removal is a red text action and retains its confirmation. |
| Address form | District selection uses the same field treatment as the other inputs, with inline required validation. Name/address keyboards, capitalization and next-field actions are appropriate to each field. |
| Product purchase | Price and action are separate elements in the bottom bar. The action label no longer includes the price. The layout can stack at larger text sizes. |
| Checkout | The submission label is “Place COD order” in each supported language. The complete amount remains in the immediately preceding total summary. |
| Catalog | Filter/sort controls size to their labels; the existing search field replaces the duplicate toolbar search action. Notification and cart actions remain available. |
| Saved products | Smaller thumbnails on narrow cards leave more space for titles. Alert/removal actions use the shared responsive layout. |
| Returns/refunds | Concise tab labels, consistent status fields and a filter reset when switching between returns and refund records. |

## Verification

- The complete automated suite passes **382 tests**.
- Static analysis reports no issues.
- Bundled Inter and Plus Jakarta Sans fonts are loaded in the new layout tests,
  replacing the test engine's Ahem font for meaningful text measurements.
- Twenty-nine routes are scrolled and inspected at 320, 360 and 390 logical pixels
  with normal English text, at 360 pixels with 1.8× text, and in Sinhala/Tamil.
- Normal English button labels are checked for unintended wrapping/truncation.
  Separate checks cover full touch targets, heading/action reflow, the district
  picker above a keyboard, return/refund filter switching, and narrow/large-text
  checkout review. The checkout layout checks do not submit an order.
- The capture helper passes **26 render cases** and produces **30 screenshots**.
  Public screens use the labelled preview; private screens use test fixtures.
- Android ARM64 and x86-64 debug APKs build successfully with the existing
  `config/android-dev.json` configuration. Outputs are
  `build/app/outputs/flutter-apk/app-arm64-v8a-debug.apk` and
  `build/app/outputs/flutter-apk/app-x86_64-debug.apk`.

These are native widget renders, not physical-device screenshots. This review
does not establish real-account or iOS device acceptance.

Selected screenshots:

- [Delivery addresses](ui-review/addresses-fixture-390.png)
- [Address form](ui-review/address-form-fixture-390.png)
- [Orders](ui-review/orders-fixture-390.png)
- [Order details](ui-review/order-details-fixture-390.png)
- [Narrow saved-product card](ui-review/favorites-fixture-320.png)
- [Product and purchase bar](ui-review/details-390.png)
- [Checkout total and submit action](ui-review/checkout-submit-fixture-390.png)
- [Returns](ui-review/returns-fixture-390.png)

```powershell
flutter analyze --no-pub
flutter test --no-pub
flutter test tool/capture_ui_test.dart --no-pub
dart format --output=none --set-exit-if-changed lib test tool
flutter build apk --debug --no-pub --target-platform android-arm64,android-x64 --split-per-abi --dart-define-from-file=config/android-dev.json
```

To retain a separate set of renders, pass
`--dart-define=UI_CAPTURE_DIR=.artifacts/my-ui-review` to the capture command.
The pre-change renders for this review are retained locally under
`.artifacts/ui-layout-before/ui-review/`.
