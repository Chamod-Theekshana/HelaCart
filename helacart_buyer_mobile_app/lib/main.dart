import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:timezone/data/latest.dart' as tz;

import 'app/hc.dart';
import 'app/config.dart';
import 'app/crash_reporting.dart';
import 'app/helacart_app.dart';
import 'app/locale.dart';
import 'app/router.dart';
import 'features/push/push_service.dart';

enum FirebaseSetup {
  /// Initialised from dart-defines or the native platform configuration.
  ready,

  /// No Firebase configuration in this build.
  missing,

  /// Configuration present but incomplete or failing to initialise.
  failed,
}

Future<FirebaseSetup> initializeFirebase() async {
  const apiKey = String.fromEnvironment('FIREBASE_API_KEY'),
      appId = String.fromEnvironment('FIREBASE_APP_ID'),
      sender = String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID'),
      project = String.fromEnvironment('FIREBASE_PROJECT_ID');
  final values = [apiKey, appId, sender, project];
  final complete = values.every((value) => value.isNotEmpty);
  if (!complete && values.any((value) => value.isNotEmpty)) {
    return FirebaseSetup.failed;
  }
  try {
    if (complete) {
      await Firebase.initializeApp(
        options: const FirebaseOptions(
          apiKey: apiKey,
          appId: appId,
          messagingSenderId: sender,
          projectId: project,
          authDomain: String.fromEnvironment('FIREBASE_AUTH_DOMAIN'),
          iosBundleId: String.fromEnvironment('FIREBASE_IOS_BUNDLE_ID'),
        ),
      ).timeout(const Duration(seconds: 10));
      return FirebaseSetup.ready;
    }
    if (kIsWeb) return FirebaseSetup.missing;
    // Native google-services.json / GoogleService-Info.plist.
    await Firebase.initializeApp().timeout(const Duration(seconds: 10));
    return FirebaseSetup.ready;
  } catch (_) {
    return complete ? FirebaseSetup.failed : FirebaseSetup.missing;
  }
}

/// Push is offered on Android and iOS store builds with Firebase configured.
PushService? createPushService() {
  if (kIsWeb) return null;
  final platform = switch (defaultTargetPlatform) {
    TargetPlatform.android => 'android',
    TargetPlatform.iOS => 'ios',
    _ => null,
  };
  if (platform == null) return null;
  try {
    FirebaseMessaging.onBackgroundMessage(helacartBackgroundMessage);
    return PushService(FirebaseMessaging.instance, platform: platform);
  } catch (_) {
    return null;
  }
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  tz.initializeTimeZones();
  final locale = await loadSavedLocale();
  AppStrings.current = AppStrings.forLocale(locale);
  AppConfig config;
  try {
    config = AppConfig.environment();
  } catch (_) {
    runApp(ConfigurationErrorApp(locale: locale));
    return;
  }
  FirebaseAuth? auth;
  PushService? push;
  var firebaseReady = false;
  if (!config.preview) {
    final setup = await initializeFirebase();
    // Release builds must not silently ship without sign-in: missing or
    // broken Firebase configuration (dart-defines or native files) stops here.
    if (kReleaseMode && setup != FirebaseSetup.ready) {
      runApp(ConfigurationErrorApp(locale: locale));
      return;
    }
    if (setup == FirebaseSetup.ready) {
      firebaseReady = true;
      auth = FirebaseAuth.instance;
      push = createPushService();
    }
    /* Debug/profile: public browsing remains usable; auth screens explain. */
  }
  var welcomed = config.preview || auth?.currentUser != null;
  try {
    welcomed =
        welcomed ||
        await SharedPreferencesAsync().getBool('helacart.welcomed') == true;
  } catch (_) {
    /* Welcome is optional if preferences are unavailable. */
  }
  final service = AuthService(auth);
  if (firebaseReady) {
    try {
      await configureCrashReporting(service);
    } catch (_) {
      /* Crash reporting must never prevent start-up. */
    }
  }
  runApp(
    ProviderScope(
      overrides: [
        configProvider.overrideWithValue(config),
        authServiceProvider.overrideWithValue(service),
        initialLocationProvider.overrideWithValue(welcomed ? '/' : '/welcome'),
        initialLocaleProvider.overrideWithValue(locale),
        pushServiceProvider.overrideWithValue(push),
      ],
      child: const HelaCartApp(),
    ),
  );
}

/// Shown when this build cannot run safely: a production build without an
/// HTTPS API, with design preview, or (release) without Firebase settings.
class ConfigurationErrorApp extends StatelessWidget {
  const ConfigurationErrorApp({super.key, required this.locale});
  final Locale locale;
  @override
  Widget build(BuildContext context) => MaterialApp(
    debugShowCheckedModeBanner: false,
    theme: helacartTheme(),
    locale: locale,
    supportedLocales: AppStrings.supportedLocales,
    localizationsDelegates: AppStrings.localizationsDelegates,
    home: Builder(
      builder: (context) => Scaffold(
        body: SafeArea(
          child: Center(
            child: EmptyState(
              title: context.tr('common.configTitle'),
              message: context.tr('common.configMessage'),
            ),
          ),
        ),
      ),
    ),
  );
}
