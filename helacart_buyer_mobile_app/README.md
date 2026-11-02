# HelaCart buyer mobile

Latest UI work: [mobile UI/UX refinement and visual review](docs/ui-ux-polish.md), including consistent button sizing, typography, card alignment, spacing, forms and large-text layouts.

Native Flutter buyer app for HelaCart's Sri Lankan, multi-shop, cash-on-delivery marketplace. The latest visual reference is `../HelaCart_UI_Codex_Reference/helacart-ui-reference/web-preview/`, with navigation decisions from `NAVIGATION_UPDATE.md`. The existing NestJS `/api/v1` API remains the business-data source. See [the UI implementation audit](docs/ui-reference-implementation.md) for changed components, screenshots, validation, and remaining visual scope.

Built with **Flutter 3.47.8 stable / Dart 3.13.7** on 29 October 2026. The SDK patch was verified by Flutter's stable updater; `.flutter-version` and CI pin that version. Pre-existing direct dependencies are pinned in `pubspec.yaml`; packages added in **1.1.0+2** (November 2026 hardening release) use caret ranges. `pubspec.lock` records the resolved graph. Do not force newer transitive dependencies past their upstream constraints.

## First setup after pulling 1.1.0

Release 1.1.0 adds packages, so the committed lockfile is stale until it is regenerated once on a machine with pub.dev access:

```powershell
flutter pub get                 # resolves the new packages and rewrites pubspec.lock
dart format lib test tool       # CI checks formatting; run once and commit any changes
flutter analyze
flutter test
git add pubspec.lock            # commit it: CI runs `flutter pub get --enforce-lockfile`
```

| Package | Range | Used for |
| --- | --- | --- |
| `flutter_localizations` (SDK) | — | Material/Cupertino/Widgets localizations for English, Sinhala and Tamil |
| `firebase_messaging` | `^17.0.0` | FCM push (same FlutterFire generation as `firebase_core` 5.x / `firebase_auth` 7.x) |
| `firebase_crashlytics` | `^6.0.0` | Release-only crash reporting |
| `share_plus` | `^13.2.0` | Sharing product/shop links and the PDPA data export file |
| `package_info_plus` | `^10.2.0` | Installed version for force-update checks and device registration |
| `url_launcher` | `^6.3.2` | Legal pages, seller application, store links |
| `path_provider` | `^2.1.5` | Temporary file for "Download my data" (already a transitive dependency) |

`intl` (0.20.3) and `shared_preferences` (2.5.6) were already direct dependencies and are unchanged.

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

For a physical phone, set `API_URL` to a reachable development LAN address or HTTPS staging URL. A LAN API needs the appropriate host binding and firewall access. `10.0.2.2` is emulator-specific. HTTP is allowed only for debug builds; **release and profile** startup require an HTTPS URL and no design preview. Keep server secrets out of all client configuration.

In debug and profile builds without Firebase configuration, live public browsing remains available, and sign-in explains the missing setup. **Release builds stop at the "Check app configuration" screen** if Firebase cannot be initialised from either the `FIREBASE_*` dart-defines or the native `google-services.json` / `GoogleService-Info.plist` (or if only some `FIREBASE_*` values are set), instead of silently shipping without sign-in. The app does not substitute sample products after a live API failure.

### Production configuration (`--dart-define-from-file`)

```powershell
Copy-Item config/prod.example.json config/prod.json   # config/*.json is git-ignored
# Fill API_URL (https), APP_LINK_HOST and, unless you ship native Firebase files,
# the FIREBASE_* public client values for each platform.
flutter build appbundle --release --dart-define-from-file=config/prod.json
flutter build ipa --release --dart-define-from-file=config/prod.json
```

| Define | Purpose |
| --- | --- |
| `API_URL` | HTTPS API base, e.g. `https://api.helacart.lk/api/v1` |
| `APP_ENV` | `production` enforces HTTPS even in debug |
| `APP_LINK_HOST` | Public web host for shared links and verified App Links (default `helacart.lk`); Gradle reads it for the Android intent filter |
| `FIREBASE_API_KEY`, `FIREBASE_APP_ID`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_PROJECT_ID` | Public Firebase client options (all four or none) |
| `FIREBASE_AUTH_DOMAIN`, `FIREBASE_IOS_BUNDLE_ID` | Optional Firebase options |

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

- **1.1.0 (November 2026 hardening release, `docs/API-CHANGES-2026-11.md`):** English / සිංහල / தமிழ் UI; FCM push with in-app banners and tap navigation; notification channel preferences (push/email/SMS); SMS OTP phone verification; editable addresses with default and verified-phone badges; checkout fraud-control codes and early `checkoutBlockers`; "Start over" for stuck checkout attempts; `DELIVERY_FAILED` / `RETURNED_TO_SELLER` statuses with reasons, "I received this order" and optional cancellation reasons; PDPA data export and account deletion; legal links and force-update from `/app-config`; share links and verified App Links; "Sell on HelaCart"; pull-to-refresh on list screens; release-only Crashlytics.

**Scope:** F01 native push, F02 account deletion and F03 published legal policies from the Stitch archive are now implemented against the November 2026 API contract. Online checkout payments, wallets, live courier maps and unconfigured policy guarantees are outside the COD buyer scope.

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
- Notification links (in-app and push) and sign-in return locations are restricted to buyer destinations. Incoming links are parsed in `lib/app/deep_links.dart`: `helacart://products/<id>`, `helacart:///products/<id>` (any buyer destination) and `https://<APP_LINK_HOST>/products/<id>` or `/shops/<slug>`.
- A stuck checkout attempt can be abandoned with **Start over** after a warning that an order may already exist (with a link to My orders). Definitive 400/403/404/409/422 rejections clear the attempt automatically; unreadable recovery storage can also be cleared.
- Shop verification means identity review. Refund verification records money returned by the seller; it does not initiate a transfer. Return eligibility comes from the order API.

## Push notifications, Crashlytics and Firebase setup

1. Install the FlutterFire CLI and configure **this** app against the existing Firebase project (it writes `android/app/google-services.json`, `ios/Runner/GoogleService-Info.plist` and adds the plist to the Runner target):

   ```powershell
   dart pub global activate flutterfire_cli
   flutterfire configure --project=<firebase-project-id> --platforms=android,ios --android-package-name=com.helacart.buyer --ios-bundle-id=com.helacart.buyer
   ```

   Both files are git-ignored. You do not need the generated `firebase_options.dart`; the app initialises from the native files (or from `FIREBASE_*` defines). Keep `node tool/configure_android_firebase.mjs` as the Android-only alternative.
2. When `google-services.json` exists, Gradle applies both the Google Services and the Crashlytics plugins (`android/app/build.gradle.kts`). Without it, debug builds still start (a fallback resource disables the Crashlytics build-ID requirement).
3. **iOS push:** upload an APNs authentication key in Firebase Console → Project settings → Cloud Messaging. In Xcode, open `ios/Runner.xcworkspace` → Runner target → *Signing & Capabilities* and confirm **Push Notifications**, **Background Modes → Remote notifications** and **Associated Domains** are listed. `Runner/Runner.entitlements` (referenced by `CODE_SIGN_ENTITLEMENTS`) already declares `aps-environment` and `applinks:helacart.lk`; your App ID must have those capabilities enabled (automatic signing does this for a paid team).
4. **Behaviour:** after sign-in the app asks for notification permission (Android 13+/iOS), registers the FCM token with `POST /me/devices` (also on token refresh) and calls `POST /me/devices/unregister` before sign-out. Foreground messages show a snackbar with **View** and refresh the inbox; taps from background/terminated state open the same buyer-safe destination as the in-app inbox. The 60-second inbox polling only runs when push is unavailable. Android uses the `helacart_updates` channel (created in `MainActivity.kt`) and the monochrome `ic_stat_helacart` icon.
5. **Crashlytics** collects only in release builds (native collection is off by default in the manifest/Info.plist and enabled from Dart in release). Reports carry the Firebase uid only, never email or other personal data.

## Release signing (Android)

```powershell
keytool -genkey -v -keystore android/upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
Copy-Item android/key.properties.example android/key.properties   # then fill passwords
flutter build appbundle --release --dart-define-from-file=config/prod.json
```

`storeFile` is resolved relative to `android/app/`. Release builds use R8 minification and resource shrinking (`android/app/proguard-rules.pro`). If `key.properties` is missing, Gradle prints a warning and signs the release with the **debug** key for local smoke tests only — such a bundle cannot be uploaded to Google Play. Keep the keystore and passwords out of git (`key.properties`, `*.jks` and `*.keystore` are ignored).

CI (`.github/workflows/buyer-mobile.yml`) builds a signed app bundle when these repository secrets exist: `ANDROID_KEYSTORE_BASE64` (base64 of the `.jks`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`; optionally `GOOGLE_SERVICES_JSON_BASE64` and `MOBILE_PROD_CONFIG_JSON` (contents of `config/prod.json`). It also compiles iOS with `flutter build ios --no-codesign` on macOS.

## App links and sharing

Product and shop screens share `https://<APP_LINK_HOST>/products/<id>` and `/shops/<slug>` (the storefront serves both). To open them in the app:

- **Android:** the manifest declares an `autoVerify` intent filter for `https://<APP_LINK_HOST>` (`/products/`, `/shops/`). Publish `https://<APP_LINK_HOST>/.well-known/assetlinks.json` with package `com.helacart.buyer` and the SHA-256 fingerprint of the **Play App Signing** certificate (Play Console → Setup → App integrity) and of the upload key for side-loaded builds. Check with `adb shell pm get-app-links com.helacart.buyer`.
- **iOS:** publish `https://<APP_LINK_HOST>/.well-known/apple-app-site-association` containing `{"applinks":{"details":[{"appIDs":["<TEAM_ID>.com.helacart.buyer"],"components":[{"/":"/products/*"},{"/":"/shops/*"}]}]}}`. If `APP_LINK_HOST` is not `helacart.lk`, also change `applinks:` in `ios/Runner/Runner.entitlements`.
- Custom-scheme links (`helacart://…`) work without any web configuration.

"Sell on HelaCart" (account screen and drawer) opens `https://<APP_LINK_HOST>/seller/apply`; legal links come from `GET /app-config` with `/legal/privacy|terms|returns` on the same host as fallback.

## Force update

On start-up the app reads `GET /app-config` and compares the installed version (`package_info_plus`) with `android|ios.minimumVersion` (semantic comparison, so `1.10.0 > 1.9.0`). Below the minimum, a blocking **Update required** screen with a store button replaces the app; below `latestVersion`, a dismissible banner suggests updating. Network failures never block the app.

## Languages (English, Sinhala, Tamil)

Strings live in `lib/l10n/strings_en.dart`, `strings_si.dart` and `strings_ta.dart` (plain maps, no code generation) and are read with `context.tr('key', {'placeholder': value})`. Add new keys to English first, then to Sinhala and Tamil; `test/hardening_release_test.dart` fails if a key or `{placeholder}` is missing. The language is chosen in the account screen or the drawer and saved in shared preferences; English is the default. Core buyer flows are translated (navigation, drawer, home, catalog/search, product, cart, checkout and OTP, orders, auth, account menu, errors/empty states); secondary screens such as reviews, returns, support and profile forms remain English for now. Prices stay in `Rs. 1,234.00` format in every language.

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

The root [buyer mobile CI workflow](../.github/workflows/buyer-mobile.yml) checks generated models, formatting, analysis, tests and an ARM64 debug build; builds a signed release app bundle when the signing secrets are configured; and compiles iOS without code signing. It does not register Firebase clients or publish to a store. The 1.1.0 code was written without access to the Flutter SDK or pub.dev, so run the commands in "First setup after pulling 1.1.0" before relying on CI.

## Native release preparation

Android package and iOS bundle identifier are `com.helacart.buyer`; the app name is **HelaCart** on both platforms. Version **1.1.0+2** (`versionName`/`versionCode` and `CFBundleShortVersionString`/`CFBundleVersion` come from `pubspec.yaml`). Android minimum SDK is 24; iOS deployment target is 15. Only the Android, iOS and web (design preview) platforms are kept; the unused desktop folders were removed.

Launcher icons, the Android adaptive/themed icon, Android 12+ splash, the legacy launch background, iOS app icons (opaque) and launch image, and web icons are generated from `assets/brand/helacart-icon.png` on the brand white background (dark-mode splash uses `HelaColors.navy`). Android backups and device-to-device transfer are disabled (`allowBackup=false`, `data_extraction_rules.xml`).

Production requires a reachable HTTPS API, platform-specific Firebase settings, the owner's release signing configuration, published privacy/terms/return-policy pages, the App Links association files and staging acceptance checks. No build was uploaded to an app store.

Fonts include their OFL licenses under `assets/fonts`. The image references used in the labelled preview came from the supplied Stitch export and existing storefront assets. Live product/shop artwork comes from the API.
