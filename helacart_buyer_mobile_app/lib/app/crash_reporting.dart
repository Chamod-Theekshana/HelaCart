import 'dart:async';

import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart' show WidgetsBinding;

import '../features/auth/data/auth_service.dart';

/// Sends uncaught Flutter and platform-dispatcher errors to Crashlytics in
/// release builds only. Debug and profile builds keep collection off (and the
/// native default is off in AndroidManifest.xml / Info.plist).
///
/// `PlatformDispatcher.instance.onError` catches the asynchronous errors that
/// `runZonedGuarded` used to cover, without a zone mismatch around
/// `WidgetsFlutterBinding.ensureInitialized()`.
///
/// Only the Firebase uid is attached to reports; no email or other PII.
Future<StreamSubscription<BuyerSession?>?> configureCrashReporting(
  AuthService auth,
) async {
  if (kIsWeb) return null;
  final crashlytics = FirebaseCrashlytics.instance;
  if (!kReleaseMode) {
    // The setting persists on device; undo a previous release install.
    await crashlytics.setCrashlyticsCollectionEnabled(false);
    return null;
  }
  await crashlytics.setCrashlyticsCollectionEnabled(true);
  FlutterError.onError = crashlytics.recordFlutterFatalError;
  WidgetsBinding.instance.platformDispatcher.onError = (error, stack) {
    crashlytics.recordError(error, stack, fatal: true);
    return true;
  };
  return auth.states.listen(
    (session) => crashlytics.setUserIdentifier(session?.uid ?? ''),
  );
}
