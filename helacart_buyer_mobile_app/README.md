# HelaCart buyer mobile

Latest UI work: [mobile UI/UX refinement and visual review](docs/ui-ux-polish.md), including consistent button sizing, typography, card alignment, spacing, forms and large-text layouts.

Native Flutter buyer app for HelaCart's Sri Lankan, multi-shop, cash-on-delivery marketplace. The latest visual reference is `../HelaCart_UI_Codex_Reference/helacart-ui-reference/web-preview/`, with navigation decisions from `NAVIGATION_UPDATE.md`. The existing NestJS `/api/v1` API remains the business-data source. See [the UI implementation audit](docs/ui-reference-implementation.md) for changed components, screenshots, validation, and remaining visual scope.

Built with **Flutter 3.47.8 stable / Dart 3.13.7** on 29 October 2026. The SDK patch was verified by Flutter's stable updater; `.flutter-version` and CI pin that version. Direct application dependencies are pinned in `pubspec.yaml`, and `pubspec.lock` records the resolved graph. Do not force newer transitive dependencies past their upstream constraints.

## Run on Android

Start the existing HelaCart API on port 4000, then from this directory:

```powershell
flutter pub get --enforce-lockfile
flutter devices
flutter run -d emulator-5554
```

The default development URL on Android is `http://10.0.2.2:4000/api/v1`, which reaches the Windows host from an Android emulator. The first launch offers optional welcome content; browsing does not require authentication.

**Firebase is connected locally:** the Android client `com.helacart.buyer` was registered in the existing backend's Firebase project. Its public SDK configuration is saved in the ignored `android/app/google-services.json` and `config/android-dev.json`. No server credentials, service-account private keys or database credentials are copied into the app. No customer accounts/passwords were changed during setup. The Google Services Gradle plugin is applied only when its configuration file exists.

On another checkout, obtain the configuration for **this same package name** from the existing Firebase project, or reuse the backend's configured ADC with:

```powershell
node tool/configure_android_firebase.mjs
```

That command reuses an existing registered client. It does not register a new client unless explicitly passed `--register`. The script requires the existing API's Node dependencies and Firebase project configuration. It writes only public client configuration; it does not print access tokens or API-key values.

Alternatively, explicit public Firebase client settings can be supplied through the example below:

```powershell
Copy-Item config/dev.example.json config/my-device.json
# Fill with this platform's Firebase application settings and the API URL.
flutter run --dart-define-from-file=config/my-device.json
```

For a physical phone, set `API_URL` to a reachable development LAN address or HTTPS staging URL. A LAN API needs the appropriate host binding and firewall access. `10.0.2.2` is emulator-specific. HTTP is allowed only for development; production/release startup requires an HTTPS URL. Keep server secrets out of all client configuration.

Without Firebase configuration, live public browsing remains available, and sign-in explains the missing setup. The app does not substitute sample products after a live API failure.

## Read-only design preview

```powershell
flutter run -d chrome --dart-define=DESIGN_PREVIEW=true
```

Preview uses clearly labelled sample products and shops, with bundled reference artwork and no invented ratings. It does not authenticate, submit real orders, modify stock or create refund/support records. Private destinations show their sign-in gate. Preview cannot be enabled in a production/release build.

For a local headless/browser QA build:

```powershell
flutter build web --debug --dart-define=DESIGN_PREVIEW=true --output=.artifacts/preview-web
node tool/serve_preview.mjs .artifacts/preview-web 4317
```

The optional `tool/browser_audit.mjs` uses Chromium CDP and saves ignored screenshots/results under `.artifacts/browser`. Set `CHROMIUM_PATH` when the executable is elsewhere. The local preview server's API proxy permits public GETs only; it is a QA utility, not a production server.

## Features

- Five main tabs: Home, Categories, Bag, Favorites and Orders, with a curved navy bar and moving teal selection. The Home profile opens a native account drawer; focused product and checkout routes keep their separate headers.
- Public catalog, multiword search/suggestions, active offers, category/price/stock filters, sorting and paginated browsing.
- Public shop directory/profiles, Products/Reviews/About navigation, identity-verification explanations and shop-specific product browsing.
- Product variants, square complete-product imagery, option/quantity selection, enlarged gallery, specifications, brand and seller-supplied warranty text.
- Account-based favorites, removable unavailable entries and explicit per-product price/restock alert settings.
- Multi-shop cart, destination delivery quotes, saved-address add/select/delete, two-step COD checkout and confirmed-order recovery.
- Per-shop fulfillment, courier references, saved delivery estimates, event history and cancellation before acceptance.
- Separate product/shop review systems, rating summaries, seller replies, own-review editing/deletion and private reports. Shop reviews allow up to three photos; product feedback remains text/stars.
- Item-wise return requests, remaining quantities/deadlines, return outcomes and separately verified cash/bank refund records.
- Private text support cases, participant roles, case history and safe reply retries.
- Profile name/contact/photo, email verification, password changes, verified email changes, sign-out and in-app notifications.
- Honest loading, empty, inaccessible, failed-request, changed-quote and account-switch states. Public and authenticated layouts are checked at mobile sizes and with enlarged text.

**Scope:** F01 native push, F02 account deletion and F03 published legal policies in the Stitch archive are future-feature designs. This implementation does not pretend those backend workflows already exist. Existing notifications and favorite alerts are delivered to the in-app inbox. Crashlytics is also an optional production integration. Online checkout payments, wallets, live courier maps and unconfigured policy guarantees are outside the COD buyer scope.

The Stitch export contained all 64 main designs, seven state packs, one component sheet and three future-feature screens. State pack S05 was absent; stock/price/delivery-change recovery is implemented against the real API regardless. Some designs map to sheets, inline editors or state variants rather than separate routes. See [screen coverage](docs/screen-coverage.md).

## Architecture

```text
Screen / reusable UI
        ↓
Riverpod state and controllers
        ↓
Repository abstraction
        ↓
Dio API service / Firebase Auth / platform storage
        ↓
Existing NestJS API → PostgreSQL and Cloudflare R2
```

Features live under descriptively named `lib/features/*/presentation` files. Shared code is in `core/`; application composition, providers, routing and theme are in `app/`. Complex cart/checkout coordination has its own application layer. Ordinary read-only screens use scoped asynchronous providers rather than adding a pass-through use-case class for every API call.

| Responsibility | Implementation |
| --- | --- |
| UI | Official `material_ui` 1.8.0, custom HelaCart tokens, locally bundled Inter/Plus Jakarta Sans, Material Symbols |
| State / dependency injection | Riverpod 3.4.3; stable provider/async APIs |
| Navigation | GoRouter 18.1.1, five preserved tab branches and focused detail/form routes |
| Networking | Dio 5.11.1, Firebase bearer tokens, bounded timeouts, ownership checks and explicit mutation retries |
| Models | Freezed 4.0.3 generator / annotations 3.1.0; JSON Serializable 6.15.2 / annotations 4.12.0 |
| Firebase | Core 5.1.0 and Auth 7.0.1; native SDK manages sessions |
| Images | Cached Network Image 4.0.5 for public imagery; no disk caching of authenticated profile/review API images |
| Photo selection | Image Picker 1.2.4, format/size checks and multipart uploads |
| Local data | Secure Storage 11.2.0 for owner-scoped checkout recovery; Shared Preferences 2.5.6 for non-sensitive welcome preferences |
| Formatting | Intl 0.20.3 and Timezone 0.11.2; integer minor units and Asia/Colombo display |
| Request identity | UUID 4.6.0, retained attempt keys for retry |

### Purchase and account safeguards

- Final prices, promotion terms, availability, fees and permissions come from the API. Original confirmed orders are not recomputed from current catalog prices.
- Cart additions are serialized and add to current quantities instead of silently replacing an existing line.
- Before checkout dispatch, the original request key/address/quote is durably saved. An interrupted response is rechecked with the same key, including after an app restart. Only a confirmed order or a definitive 400/404/409 rejection clears that attempt. Recovery-storage failure blocks dispatch.
- Private responses are rejected after an account change. Async action ownership is retained across photo picking, reauthentication and other waits, so a stale form cannot write to a newly signed-in account.
- An expired authenticated GET may refresh once. Writes are never automatically replayed after a 401 or network error.
- Passwords, Firebase refresh tokens and backend secrets are not stored in app preferences. Tokens are obtained from Firebase as needed and are not logged.
- Notification links and sign-in return locations are restricted to buyer destinations. Native custom links use `helacart:///products/...` etc.; verified HTTPS app links require a real domain association later.
- Shop verification means identity review. Refund verification records money returned by the seller; it does not initiate a transfer. Return eligibility comes from the order API.

## Verification

```powershell
dart run build_runner build
dart format --output=none --set-exit-if-changed lib test tool
flutter analyze
flutter test
flutter build apk --debug --target-platform android-arm64,android-x64 --split-per-abi
```

The table below records the earlier baseline validation. For the latest web-reference UI revision (161 passing tests, current analysis, native widget renders and rebuilt Android APKs), see [UI revision validation](docs/ui-reference-implementation.md#run). Device and browser baseline checks were not repeated for that UI revision.

| Check | Result |
| --- | --- |
| Generated models | Rebuilt successfully; no generated changes |
| Static analysis | No issues found |
| Automated suite | 155 tests passed, including 360/390px layouts and 1.8× text |
| Live API contracts | Nine public-read/anonymous-denial checks passed on port 4000 |
| Browser preview | Six responsive-width screens rendered without reported exceptions or document overflow |
| Android | ARM64 and x86-64 debug APKs built; x86-64 installed and launched on API 36.1 |
| Native smoke check | Welcome, real catalog, configured sign-in and custom deep link checked using the emulator's compatible software renderer; no Flutter/runtime errors reported in the inspected log window |

Tests cover checkout recovery/concurrency, stale sessions/forms, exact money, JSON contracts, cart mutations, protected routes, separate feedback systems, partial returns, support retries and responsive screens. Authenticated widget flows use local fake identities/repositories. They do not change real accounts, send verification emails, submit customer orders or move money.

With a running API, `dart run tool/check_live_api.dart http://localhost:4000/api/v1` repeats the public GET/anonymous-denial checks without authenticating or writing customer data. Customer login/registration with a real account, real photo uploads, a complete staged purchase/return and physical-device/network testing remain manual acceptance checks.

The Android debug outputs are `build/app/outputs/flutter-apk/app-arm64-v8a-debug.apk` (typical Android phones) and `app-x86_64-debug.apk` (the local emulator). They use the local development API by default, so a physical phone needs a build configured with its reachable API URL. These are development artifacts, not store releases.

The root [buyer mobile CI workflow](../.github/workflows/buyer-mobile.yml) checks generated models, formatting, analysis, tests and an ARM64 debug build. It is prepared but has not been run remotely. It does not register Firebase clients, publish to a store or receive production signing secrets. Without the ignored native Firebase file, its artifact supports public browsing/configuration gates.

## Native release preparation

Android package and iOS bundle identifier are `com.helacart.buyer`. Android minimum SDK is 24; iOS deployment target is 15. App icons are derived from the supplied HelaCart logo. Firebase Android registration is configured locally; an iOS Firebase client/configuration and macOS/Xcode build/device checks are still required for iOS.

Production requires a reachable HTTPS API, platform-specific Firebase settings, the owner's release signing configuration, approved privacy/terms/return-policy content and staging acceptance checks. Release builds are intentionally not signed with the debug key. No APK was uploaded to an app store.

Fonts include their OFL licenses under `assets/fonts`. The image references used in the labelled preview came from the supplied Stitch export and existing storefront assets. Live product/shop artwork comes from the API.
