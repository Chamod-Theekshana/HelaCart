import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';

import '../../../core/network/api_client.dart';

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
      (throw const AppFailure(
        'Firebase is not configured. Follow the mobile README to enable sign-in.',
      ));
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

  Future<void> signOut() => _configured.signOut();
  void dispose() {
    _subscription?.cancel();
    _changes.close();
  }
}

String friendlyError(Object error) {
  if (error is FirebaseAuthException) {
    return switch (error.code) {
      'invalid-credential' ||
      'wrong-password' ||
      'user-not-found' => 'The email or password is incorrect.',
      'email-already-in-use' => 'Could not create this account. Try signing in or resetting your password.',
      'weak-password' => 'Choose a stronger password.',
      'invalid-email' => 'Enter a valid email address.',
      'too-many-requests' => 'Please wait before trying again.',
      'network-request-failed' => 'Check your connection and try again.',
      'requires-recent-login' =>
        'Sign in again before changing account security.',
      'user-disabled' => 'Account access is currently unavailable.',
      _ => 'Could not complete this account action. Please try again.',
    };
  }
  return error is AppFailure
      ? error.message
      : 'Something went wrong. Please try again.';
}
