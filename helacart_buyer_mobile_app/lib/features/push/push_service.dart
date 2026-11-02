import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/data/json.dart';

/// FCM background/terminated handler. Notification payloads are displayed by
/// the operating system; taps are routed by [PushService.listen] and
/// [PushService.initialMessage], so no Dart work is needed here.
@pragma('vm:entry-point')
Future<void> helacartBackgroundMessage(RemoteMessage message) async {}

/// A received push (§7): `data` carries `notificationId`, `type` and `href`.
class PushMessage {
  const PushMessage({this.title, this.body, this.data = const {}});
  factory PushMessage.from(RemoteMessage message) => PushMessage(
    title: message.notification?.title,
    body: message.notification?.body,
    data: {
      for (final entry in message.data.entries)
        if (entry.value != null) entry.key: '${entry.value}',
    },
  );
  final String? title, body;
  final Map<String, String> data;
  String? get notificationId => data['notificationId'];
  Map<String, Object?> get notice => {
    'href': data['href'] ?? '',
    'type': data['type'] ?? '',
  };
}

/// Thin wrapper over Firebase Messaging. Created in main.dart only when
/// Firebase is configured on Android/iOS; otherwise the app keeps polling.
class PushService {
  PushService(this.messaging, {required this.platform});
  final FirebaseMessaging messaging;

  /// `android` or `ios`, as sent to `POST /me/devices`.
  final String platform;
  String? _token;
  String? get token => _token;
  final _subscriptions = <StreamSubscription<Object?>>[];

  /// Requests permission (Android 13+ / iOS) and fetches the FCM token.
  /// Returns whether push delivery is available on this device.
  Future<bool> initialize() async {
    try {
      final settings = await messaging.requestPermission();
      final status = settings.authorizationStatus;
      if (status != AuthorizationStatus.authorized &&
          status != AuthorizationStatus.provisional) {
        return false;
      }
      if (platform == 'ios') await _waitForApnsToken();
      // Backend push delivery sends via FCM multicast registration tokens,
      // not Firebase Installation IDs.
      // ignore: deprecated_member_use
      _token = await messaging.getToken();
      return _token != null;
    } catch (_) {
      return false;
    }
  }

  /// FCM tokens on iOS require the APNs token, which arrives asynchronously.
  Future<void> _waitForApnsToken() async {
    for (var attempt = 0; attempt < 10; attempt++) {
      if (await messaging.getAPNSToken() != null) return;
      await Future<void>.delayed(const Duration(milliseconds: 500));
    }
  }

  void listen({
    required void Function(PushMessage message) onForeground,
    required void Function(PushMessage message) onOpened,
    required void Function(String token) onToken,
  }) {
    _subscriptions
      ..add(
        FirebaseMessaging.onMessage.listen(
          (message) => onForeground(PushMessage.from(message)),
        ),
      )
      ..add(
        FirebaseMessaging.onMessageOpenedApp.listen(
          (message) => onOpened(PushMessage.from(message)),
        ),
      )
      ..add(
        // ignore: deprecated_member_use
        messaging.onTokenRefresh.listen((token) {
          _token = token;
          onToken(token);
        }),
      );
  }

  /// The notification that launched the app from a terminated state.
  Future<PushMessage?> initialMessage() async {
    try {
      final message = await messaging.getInitialMessage();
      return message == null ? null : PushMessage.from(message);
    } catch (_) {
      return null;
    }
  }

  void dispose() {
    for (final subscription in _subscriptions) {
      subscription.cancel();
    }
    _subscriptions.clear();
  }
}

/// Keeps `POST /me/devices` in step with the signed-in buyer and token, and
/// sends `POST /me/devices/unregister` before sign-out (§7).
class DeviceRegistration {
  DeviceRegistration({
    required this.platform,
    required this.token,
    required this.appVersion,
    required this.write,
  });
  final String platform;
  final String? Function() token;
  final Future<String> Function() appVersion;
  final Future<Object?> Function(String path, Json body) write;
  String? _registered;

  /// Registers the current token for [uid]; repeated calls are no-ops.
  Future<void> sync(String? uid) async {
    final current = token();
    if (uid == null) {
      _registered = null;
      return;
    }
    if (current == null || _registered == '$uid:$current') return;
    await write('/me/devices', {
      'token': current,
      'platform': platform,
      'appVersion': await appVersion(),
    });
    _registered = '$uid:$current';
  }

  Future<void> unregister() async {
    final current = token();
    _registered = null;
    if (current == null) return;
    await write('/me/devices/unregister', {'token': current});
  }
}

/// Provided in main.dart when Firebase Messaging is usable.
final pushServiceProvider = Provider<PushService?>((ref) => null);

class PushAvailability extends Notifier<bool> {
  @override
  bool build() => false;
  void setAvailable(bool available) => state = available;
}

/// True once permission was granted and a token obtained; the 60-second
/// notification polling only runs while this is false.
final pushAvailableProvider = NotifierProvider<PushAvailability, bool>(
  PushAvailability.new,
);
