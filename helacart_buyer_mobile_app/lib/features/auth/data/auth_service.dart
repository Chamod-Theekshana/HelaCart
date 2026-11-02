import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';

import '../../../core/network/api_client.dart';
import '../../../l10n/app_strings.dart';

class BuyerSession {
  const BuyerSession(this.uid, this.email, this.verified);
  final String uid, email;
  final bool verified;
}

class AuthService {
  AuthService(this.auth) {
    _subscription = auth?.idTokenChanges().listen((_) => _changes.add(session));
  }
  final FirebaseAuth? auth;
  final _changes = StreamController<BuyerSession?>.broadcast();
  StreamSubscription<User?>? _subscription;
  bool get configured => auth != null;
  BuyerSession? get session {
    final user = auth?.currentUser;
    return user == null
        ? null
        : BuyerSession(user.uid, user.email ?? '', user.emailVerified);
  }

  Stream<BuyerSession?> get states async* {
    yield session;
    yield* _changes.stream;
  }

  Future<String?> token(bool refresh) async =>
      auth?.currentUser?.getIdToken(refresh);
  FirebaseAuth get _configured =>
      auth ??
      (throw AppFailure(AppStrings.current.t('error.firebaseNotConfigured')));
  Future<void> signIn(String email, String password) async => _configured
      .signInWithEmailAndPassword(email: email.trim(), password: password);
  Future<void> register(String email, String password) async {
    final credential = await _configured.createUserWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );
    await credential.user!.sendEmailVerification();
  }

  Future<void> reset(String email) =>
      _configured.sendPasswordResetEmail(email: email.trim());
  Future<void> resend() async =>
      _configured.currentUser?.sendEmailVerification();
  Future<void> reload() async {
    await _configured.currentUser?.reload();
    await _configured.currentUser?.getIdToken(true);
    _changes.add(session);
  }

  Future<void> changePassword(String current, String next) async {
    final user = _configured.currentUser!;
    await user.reauthenticateWithCredential(
      EmailAuthProvider.credential(email: user.email!, password: current),
    );
    await user.updatePassword(next);
  }

  Future<void> changeEmail(String current, String next) async {
    final user = _configured.currentUser!;
    await user.reauthenticateWithCredential(
      EmailAuthProvider.credential(email: user.email!, password: current),
    );
    await user.verifyBeforeUpdateEmail(next.trim());
  }

  final _signOutHooks = <Future<void> Function()>[];

  /// Work that needs the still-valid session right before sign-out, such as
  /// `POST /me/devices/unregister`. Hooks are best-effort and time-limited.
  void addSignOutHook(Future<void> Function() hook) => _signOutHooks.add(hook);
  void removeSignOutHook(Future<void> Function() hook) =>
      _signOutHooks.remove(hook);

  Future<void> signOut() async {
    for (final hook in List.of(_signOutHooks)) {
      try {
        await hook().timeout(const Duration(seconds: 5));
      } catch (_) {
        /* Never block sign-out on a cleanup request. */
      }
    }
    await _configured.signOut();
  }

  void dispose() {
    _subscription?.cancel();
    _changes.close();
  }
}

String friendlyError(Object error) {
  final strings = AppStrings.current;
  if (error is FirebaseAuthException) {
    return strings.t(switch (error.code) {
      'invalid-credential' ||
      'wrong-password' ||
      'user-not-found' => 'auth.error.invalidCredential',
      'email-already-in-use' => 'auth.error.emailInUse',
      'weak-password' => 'auth.error.weakPassword',
      'invalid-email' => 'auth.error.invalidEmail',
      'too-many-requests' => 'auth.error.tooManyRequests',
      'network-request-failed' => 'auth.error.network',
      'requires-recent-login' => 'auth.error.recentLogin',
      'user-disabled' => 'auth.error.disabled',
      _ => 'auth.error.other',
    });
  }
  return error is AppFailure ? error.message : strings.t('error.generic');
}
