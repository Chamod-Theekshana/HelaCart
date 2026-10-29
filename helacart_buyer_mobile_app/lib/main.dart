import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:timezone/data/latest.dart' as tz;

import 'app/hc.dart';
import 'app/config.dart';
import 'app/helacart_app.dart';
import 'app/router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  tz.initializeTimeZones();
  AppConfig config;
  try {
    config = AppConfig.environment();
  } catch (_) {
    runApp(
      MaterialApp(
        home: const Scaffold(
          body: SafeArea(
            child: EmptyState(
              title: 'Check app configuration',
              message: 'Production needs an HTTPS API_URL and live data. See the mobile README.',
            ),
          ),
        ),
        theme: helacartTheme(),
      ),
    );
    return;
  }
  FirebaseAuth? auth;
  if (!config.preview) {
    try {
      const apiKey = String.fromEnvironment('FIREBASE_API_KEY'),
          appId = String.fromEnvironment('FIREBASE_APP_ID'),
          sender = String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID'),
          project = String.fromEnvironment('FIREBASE_PROJECT_ID');
      if (apiKey.isNotEmpty &&
          appId.isNotEmpty &&
          sender.isNotEmpty &&
          project.isNotEmpty) {
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
        auth = FirebaseAuth.instance;
      } else if (!kIsWeb) {
        await Firebase.initializeApp().timeout(const Duration(seconds: 10));
        auth = FirebaseAuth.instance;
      }
    } catch (_) {
      /* Public browsing remains usable. Auth screens explain configuration. */
    }
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
  runApp(
    ProviderScope(
      overrides: [
        configProvider.overrideWithValue(config),
        authServiceProvider.overrideWithValue(service),
        initialLocationProvider.overrideWithValue(welcomed ? '/' : '/welcome'),
      ],
      child: const HelaCartApp(),
    ),
  );
}
