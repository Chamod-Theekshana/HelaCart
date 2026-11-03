import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:helacart_buyer_mobile_app/app/app_update.dart';
import 'package:helacart_buyer_mobile_app/app/config.dart';
import 'package:helacart_buyer_mobile_app/app/deep_links.dart';
import 'package:helacart_buyer_mobile_app/app/hc.dart';
import 'package:helacart_buyer_mobile_app/app/helacart_app.dart';
import 'package:helacart_buyer_mobile_app/app/locale.dart';
import 'package:helacart_buyer_mobile_app/app/router.dart';
import 'package:helacart_buyer_mobile_app/core/data/app_config.dart';
import 'package:helacart_buyer_mobile_app/core/ui/buyer_navigation.dart';
import 'package:helacart_buyer_mobile_app/features/account/presentation/phone_verification_screen.dart';
import 'package:helacart_buyer_mobile_app/features/checkout/application/checkout_coordinator.dart';
import 'package:helacart_buyer_mobile_app/features/checkout/presentation/checkout_screen.dart';
import 'package:helacart_buyer_mobile_app/features/orders/presentation/orders_screen.dart';
import 'package:helacart_buyer_mobile_app/features/push/push_service.dart';
import 'package:timezone/data/latest.dart' as tz;

import 'support/buyer_fixture.dart';
import 'support/fakes.dart';

const pendingKey = 'e0e6a8ed-3f1f-4e04-a9e4-e944572c1e6b';

/// Saved attempt that cannot be parsed until it is cleared.
class UnreadableStore extends MemoryCheckoutStore {
  @override
  Future<CheckoutIntent?> read(String owner) async => values.containsKey(owner)
      ? throw const AppFailure('Checkout recovery data needs attention.')
      : null;
}

class FakePushService extends Fake implements PushService {
  FakePushService({this.fcmToken = 'fcm-token-1234567890123456'});
  final String? fcmToken;
  @override
  String get platform => 'android';
  @override
  String? get token => fcmToken;
  @override
  Future<bool> initialize() async => fcmToken != null;
  @override
  void listen({
    required void Function(PushMessage message) onForeground,
    required void Function(PushMessage message) onOpened,
    required void Function(String token) onToken,
  }) {}
  @override
  Future<PushMessage?> initialMessage() async => null;
  @override
  void dispose() {}
}

Future<FakeAuth> pumpBuyer(
  WidgetTester tester,
  String route,
  FakeRepository repo, {
  CheckoutStore? store,
  Locale locale = const Locale('en'),
  String? appVersion,
  bool overrideNullVersion = false,
  PushService? push,
}) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  final auth = FakeAuth(
    const BuyerSession('buyer-a', 'kasun@example.test', true),
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        configProvider.overrideWithValue(
          const AppConfig(apiUrl: 'https://example.test/api/v1'),
        ),
        authServiceProvider.overrideWithValue(auth),
        repositoryProvider.overrideWithValue(repo),
        initialLocationProvider.overrideWithValue(route),
        initialLocaleProvider.overrideWithValue(locale),
        checkoutStoreProvider.overrideWithValue(store ?? MemoryCheckoutStore()),
        if (push != null) pushServiceProvider.overrideWithValue(push),
        if (appVersion != null || overrideNullVersion)
          appVersionProvider.overrideWith((ref) async => appVersion),
      ],
      child: const HelaCartApp(),
    ),
  );
  await tester.pumpAndSettle();
  addTearDown(() async {
    await tester.pumpWidget(const SizedBox());
    auth.dispose();
    AppStrings.current = AppStrings.en;
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });
  return auth;
}

Future<void> scrollTo(WidgetTester tester, Finder finder) async {
  await tester.scrollUntilVisible(
    finder,
    200,
    scrollable: find.byType(Scrollable).first,
  );
  await tester.pumpAndSettle();
}

Json appConfig({String? minimum, String? latest}) => {
  'android': {
    'minimumVersion': ?minimum,
    'latestVersion': ?latest,
    'storeUrl':
        'https://play.google.com/store/apps/details?id=com.helacart.buyer',
  },
  'legal': {'privacyUrl': 'https://helacart.lk/legal/privacy'},
};

void main() {
  setUpAll(tz.initializeTimeZones);

  group('version compare and update policy', () {
    test('compares semantic versions numerically', () {
      expect(compareVersions('1.10.0', '1.9.9'), greaterThan(0));
      expect(compareVersions('1.1', '1.1.0'), 0);
      expect(compareVersions('1.1.0+2', '1.1.0'), 0);
      expect(compareVersions('1.1.0-beta', '1.1.0'), 0);
      expect(compareVersions('2.0.0', '10.0.0'), lessThan(0));
      expect(compareVersions('1.0.0', '1.0.1'), lessThan(0));
    });
    test('minimumVersion blocks, latestVersion suggests', () {
      const release = PlatformRelease(
        minimumVersion: '1.1.0',
        latestVersion: '1.3.0',
        storeUrl: 'https://store.example/app',
      );
      expect(evaluateUpdate('1.0.9', release).kind, UpdateKind.required);
      expect(evaluateUpdate('1.1.0', release).kind, UpdateKind.optional);
      expect(evaluateUpdate('1.3.0', release).kind, UpdateKind.none);
      expect(evaluateUpdate('1.4.0', release).kind, UpdateKind.none);
      expect(evaluateUpdate(null, release).kind, UpdateKind.none);
      expect(evaluateUpdate('1.0.0', null).kind, UpdateKind.none);
      expect(
        evaluateUpdate('1.0.0', release).storeUrl,
        'https://store.example/app',
      );
    });
    test('app config tolerates missing or unsafe values', () {
      final config = RemoteAppConfig.fromJson({
        'legal': {'privacyUrl': 'javascript:alert(1)'},
        'ios': {'minimumVersion': 'not-a-version'},
      }, 'helacart.lk');
      expect(config.legal.privacyUrl, 'https://helacart.lk/legal/privacy');
      expect(config.legal.termsUrl, 'https://helacart.lk/legal/terms');
      expect(config.legal.returnsUrl, 'https://helacart.lk/legal/returns');
      expect(config.ios?.minimumVersion, isNull);
      expect(config.android?.storeUrl, RemoteAppConfig.androidStoreUrl);
    });
    testWidgets('below minimumVersion shows the blocking update screen', (
      tester,
    ) async {
      final repo = BuyerFixture();
      repo.onRead = (path) async => path == '/app-config'
          ? appConfig(minimum: '1.2.0', latest: '1.3.0')
          : repo.respond(path);
      await pumpBuyer(tester, '/', repo, appVersion: '1.1.0');
      expect(find.text('Update required'), findsOneWidget);
      expect(
        find.byKey(const ValueKey('update-required-store')),
        findsOneWidget,
      );
      expect(find.byType(BuyerNavigationBar), findsNothing);
      expect(tester.takeException(), isNull);
    });
    testWidgets('newer latestVersion shows a dismissible banner', (
      tester,
    ) async {
      final repo = BuyerFixture();
      repo.onRead = (path) async => path == '/app-config'
          ? appConfig(minimum: '1.0.0', latest: '1.2.0')
          : repo.respond(path);
      await pumpBuyer(tester, '/', repo, appVersion: '1.1.0');
      final banner = find.byKey(const ValueKey('update-available-banner'));
      expect(banner, findsOneWidget);
      expect(find.byType(BuyerNavigationBar), findsOneWidget);
      await tester.tap(find.text('Later'));
      await tester.pumpAndSettle();
      expect(banner, findsNothing);
      expect(tester.takeException(), isNull);
    });
    testWidgets('current version and unknown version are never gated', (
      tester,
    ) async {
      final repo = BuyerFixture();
      repo.onRead = (path) async => path == '/app-config'
          ? appConfig(minimum: '1.0.0', latest: '1.1.0')
          : repo.respond(path);
      await pumpBuyer(tester, '/', repo, appVersion: '1.1.0');
      expect(find.text('Update required'), findsNothing);
      expect(
        find.byKey(const ValueKey('update-available-banner')),
        findsNothing,
      );
      expect(find.byType(BuyerNavigationBar), findsOneWidget);
    });
  });

  group('deep links', () {
    test('all three link forms open the same product', () {
      for (final link in [
        'helacart://products/preview-shirt',
        'helacart:///products/preview-shirt',
        'https://helacart.lk/products/preview-shirt',
        'https://www.helacart.lk/products/preview-shirt',
      ]) {
        expect(
          deepLinkTarget(Uri.parse(link)),
          '/products/preview-shirt',
          reason: link,
        );
      }
      expect(
        deepLinkTarget(Uri.parse('https://helacart.lk/shops/ceylon-threads')),
        '/shops/ceylon-threads',
      );
      expect(
        deepLinkTarget(Uri.parse('helacart://shops/ceylon-threads')),
        '/shops/ceylon-threads',
      );
    });
    test('respects APP_LINK_HOST and rejects other destinations', () {
      expect(
        deepLinkTarget(
          Uri.parse('https://staging.helacart.lk/products/a1'),
          host: 'staging.helacart.lk',
        ),
        '/products/a1',
      );
      for (final link in [
        'https://evil.test/products/a1',
        'http://helacart.lk/products/a1',
        'https://helacart.lk/seller/apply',
        'https://helacart.lk/products/a1/edit',
      ]) {
        expect(deepLinkTarget(Uri.parse(link)), isNull, reason: link);
      }
      expect(deepLinkTarget(Uri.parse('helacart:///admin')), '/');
      expect(deepLinkTarget(Uri.parse('helacart://orders')), '/orders');
    });
    test('router redirect converges and leaves in-app paths alone', () {
      expect(deepLinkRedirect(Uri.parse('/products/a1')), isNull);
      for (final link in [
        'helacart://products/a1',
        'helacart:///products/a1',
        'https://helacart.lk/products/a1',
        'https://evil.test/products/a1',
        'helacart:///admin',
      ]) {
        var uri = Uri.parse(link);
        var next = deepLinkRedirect(uri);
        var hops = 0;
        while (next != null) {
          expect(++hops, lessThanOrEqualTo(1), reason: link);
          uri = Uri.parse(next);
          next = deepLinkRedirect(uri);
        }
        expect(
          uri.path,
          link.contains('evil') || link.contains('admin')
              ? '/'
              : '/products/a1',
          reason: link,
        );
      }
    });
    test('share links use the public https host', () {
      expect(
        productShareUrl('p 1').toString(),
        'https://helacart.lk/products/p%201',
      );
      expect(
        shopShareUrl('ceylon').toString(),
        'https://helacart.lk/shops/ceylon',
      );
      expect(
        sellerApplicationUrl().toString(),
        'https://helacart.lk/seller/apply',
      );
    });
    for (final link in [
      'helacart://products/preview-shirt',
      'helacart:///products/preview-shirt',
      'https://helacart.lk/products/preview-shirt',
    ]) {
      testWidgets('opening $link shows the product', (tester) async {
        await pumpBuyer(tester, link, BuyerFixture());
        expect(find.text('Good find'), findsOneWidget);
        expect(find.text('Handwoven Premium Cotton Linen Shirt'), findsWidgets);
        expect(tester.takeException(), isNull);
      });
    }
  });

  group('localization', () {
    test('Sinhala and Tamil define every English key and placeholder', () {
      final english = AppStrings.tables['en']!;
      final placeholder = RegExp(r'\{\w+\}');
      for (final code in ['si', 'ta']) {
        final table = AppStrings.tables[code]!;
        expect(
          english.keys.where((k) => !table.containsKey(k)),
          isEmpty,
          reason: '$code is missing keys',
        );
        expect(
          table.keys.where((k) => !english.containsKey(k)),
          isEmpty,
          reason: '$code has unknown keys',
        );
        for (final entry in english.entries) {
          final translated = table[entry.key]!;
          expect(translated.trim(), isNotEmpty, reason: '$code ${entry.key}');
          expect(
            placeholder.allMatches(translated).map((m) => m[0]).toSet(),
            placeholder.allMatches(entry.value).map((m) => m[0]).toSet(),
            reason: '$code ${entry.key}',
          );
        }
      }
    });
    test('placeholders are filled and English is the fallback', () {
      expect(
        AppStrings.si.t('cart.each', {'price': 'Rs. 13,180.00'}),
        contains('Rs. 13,180.00'),
      );
      expect(AppStrings.ta.t('no.such.key', const {}, 'Fallback'), 'Fallback');
      expect(AppStrings.forLocale(const Locale('fr')), AppStrings.en);
      expect(money(1318000), 'Rs. 13,180.00');
    });
    testWidgets('Sinhala locale translates navigation and keeps money format', (
      tester,
    ) async {
      await pumpBuyer(
        tester,
        '/cart',
        BuyerFixture(),
        locale: const Locale('si'),
      );
      expect(find.text('මුල් පිටුව'), findsOneWidget);
      expect(find.text('Home'), findsNothing);
      expect(find.text('ඔබේ කරත්තය'), findsOneWidget);
      expect(find.textContaining('Rs. '), findsWidgets);
      expect(tester.takeException(), isNull);
    });
    testWidgets('Tamil locale renders the account drawer', (tester) async {
      await pumpBuyer(tester, '/', BuyerFixture(), locale: const Locale('ta'));
      await tester.tap(find.byTooltip('கணக்கு மெனுவைத் திற'));
      await tester.pumpAndSettle();
      expect(find.text('உங்கள் ஷாப்பிங்'.toUpperCase()), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });

  group('checkout start over', () {
    testWidgets('pending attempt can be abandoned after the orders warning', (
      tester,
    ) async {
      final store = MemoryCheckoutStore();
      await store.save(
        CheckoutIntent(
          owner: 'buyer-a',
          key: pendingKey,
          addressId: fixtureAddress,
          quote: List.filled(64, 'a').join(),
        ),
      );
      final repo = BuyerFixture();
      await pumpBuyer(tester, '/checkout', repo, store: store);
      expect(find.text('Check my order'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('checkout-start-over')));
      await tester.pumpAndSettle();
      expect(find.text('Start a new checkout?'), findsOneWidget);
      expect(find.byKey(const ValueKey('start-over-orders')), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('start-over-confirm')));
      await tester.pumpAndSettle();
      expect(store.values, isEmpty);
      expect(find.text('Choose a delivery address'), findsOneWidget);
      expect(repo.writes, isEmpty);
      expect(tester.takeException(), isNull);
    });
    testWidgets('going back keeps the pending attempt', (tester) async {
      final store = MemoryCheckoutStore();
      await store.save(
        CheckoutIntent(
          owner: 'buyer-a',
          key: pendingKey,
          addressId: fixtureAddress,
          quote: List.filled(64, 'a').join(),
        ),
      );
      await pumpBuyer(tester, '/checkout', BuyerFixture(), store: store);
      await tester.tap(find.byKey(const ValueKey('checkout-start-over')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Go back'));
      await tester.pumpAndSettle();
      expect(store.values['buyer-a'], isNotNull);
      expect(find.text('Check my order'), findsOneWidget);
    });
    testWidgets('unreadable recovery data offers start over', (tester) async {
      final store = UnreadableStore();
      await store.save(
        CheckoutIntent(
          owner: 'buyer-a',
          key: pendingKey,
          addressId: fixtureAddress,
          quote: List.filled(64, 'a').join(),
        ),
      );
      await pumpBuyer(tester, '/checkout', BuyerFixture(), store: store);
      expect(
        find.text(
          'The saved checkout attempt on this phone could not be read.',
        ),
        findsOneWidget,
      );
      await scrollTo(tester, find.byKey(const ValueKey('checkout-start-over')));
      await tester.tap(find.byKey(const ValueKey('checkout-start-over')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('start-over-confirm')));
      await tester.pumpAndSettle();
      expect(store.values, isEmpty);
      expect(find.text('Choose a delivery address'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
    testWidgets('known checkout blockers disable review and offer OTP', (
      tester,
    ) async {
      final repo = BuyerFixture()..checkoutBlockers = ['PHONE_NOT_VERIFIED'];
      await pumpBuyer(tester, '/checkout', repo);
      await tester.tap(find.text('Kasun Perera'));
      await tester.pumpAndSettle();
      await scrollTo(
        tester,
        find.byKey(const ValueKey('checkout-verify-phone')),
      );
      expect(
        find.byKey(const ValueKey('checkout-blocker-PHONE_NOT_VERIFIED')),
        findsOneWidget,
      );
      await scrollTo(tester, find.widgetWithText(FilledButton, 'Review order'));
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Review order'),
            )
            .onPressed,
        isNull,
      );
      expect(tester.takeException(), isNull);
    });
    testWidgets('checkout error code maps to a buyer message', (tester) async {
      final repo = BuyerFixture();
      repo.onWrite = (path, method, data) async => throw const AppFailure(
        'Raw server text',
        status: 409,
        code: 'TOO_MANY_OPEN_ORDERS',
      );
      await pumpBuyer(tester, '/checkout', repo);
      await tester.tap(find.text('Kasun Perera'));
      await tester.pumpAndSettle();
      await scrollTo(tester, find.text('Review order'));
      await tester.tap(find.text('Review order'));
      await tester.pumpAndSettle();
      await scrollTo(tester, find.text('Place COD order'));
      await tester.tap(find.text('Place COD order'));
      await tester.pumpAndSettle();
      expect(
        find.byKey(const ValueKey('checkout-blocker-TOO_MANY_OPEN_ORDERS')),
        findsOneWidget,
      );
      expect(find.text('Raw server text'), findsNothing);
      expect(tester.takeException(), isNull);
    });
  });

  group('order lifecycle', () {
    test('confirm receipt and cancel follow the state machine', () {
      for (final status in sellerOrderStatuses) {
        expect(canConfirmReceipt(status), status == 'SHIPPED', reason: status);
        expect(canCancelPackage(status), status == 'PLACED', reason: status);
      }
      expect(sellerOrderStatuses, contains('DELIVERY_FAILED'));
      expect(sellerOrderStatuses, contains('RETURNED_TO_SELLER'));
    });
    testWidgets('only the shipped package offers "I received this order"', (
      tester,
    ) async {
      final repo = BuyerFixture();
      await pumpBuyer(tester, '/orders/$fixtureOrder', repo);
      final shipped = find.byKey(const ValueKey('confirm-receipt-package-b'));
      await scrollTo(tester, shipped);
      expect(shipped, findsOneWidget);
      expect(
        find.byKey(const ValueKey('confirm-receipt-$fixturePackage')),
        findsNothing,
      );
      expect(
        find.byKey(const ValueKey('cancel-package-package-b')),
        findsNothing,
      );
      await tester.tap(shipped);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Yes, I received it'));
      await tester.pumpAndSettle();
      final call = repo.writes.single;
      expect(
        call.path,
        '/me/orders/$fixtureOrder/seller-orders/package-b/confirm-receipt',
      );
      expect(call.method, 'POST');
      expect(tester.takeException(), isNull);
    });
    testWidgets('a status that moved on meanwhile shows a clear message', (
      tester,
    ) async {
      final repo = BuyerFixture();
      repo.onWrite = (path, method, data) async => throw const AppFailure(
        'Raw server text',
        status: 409,
        code: 'ORDER_TRANSITION_NOT_ALLOWED',
      );
      await pumpBuyer(tester, '/orders/$fixtureOrder', repo);
      final shipped = find.byKey(const ValueKey('confirm-receipt-package-b'));
      await scrollTo(tester, shipped);
      await tester.tap(shipped);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Yes, I received it'));
      await tester.pumpAndSettle();
      expect(
        find.textContaining('changed status in the meantime'),
        findsOneWidget,
      );
      expect(find.text('Raw server text'), findsNothing);
    });
    testWidgets('placed package cancels with an optional reason', (
      tester,
    ) async {
      final repo = BuyerFixture();
      await pumpBuyer(tester, '/orders/$fixtureOrder', repo);
      final cancel = find.byKey(
        const ValueKey('cancel-package-$fixturePackage'),
      );
      await scrollTo(tester, cancel);
      await tester.tap(cancel);
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byKey(const ValueKey('cancel-reason')),
        'Ordered by mistake',
      );
      await tester.tap(find.byKey(const ValueKey('cancel-confirm')));
      await tester.pumpAndSettle();
      final call = repo.writes.single;
      expect(call.path, endsWith('/seller-orders/$fixturePackage/cancel'));
      expect(object(call.data), {'reason': 'Ordered by mistake'});
    });
    testWidgets('delivery failure shows the status reason', (tester) async {
      final repo = BuyerFixture();
      repo.onRead = (path) async {
        if (path != '/me/orders/$fixtureOrder') return repo.respond(path);
        final order = Map<String, dynamic>.of(BuyerFixture.order);
        order['sellerOrders'] = [
          {
            ...object(objects(BuyerFixture.order['sellerOrders'])[1]),
            'status': 'DELIVERY_FAILED',
            'statusReason': 'Customer unreachable',
          },
        ];
        return order;
      };
      await pumpBuyer(tester, '/orders/$fixtureOrder', repo);
      expect(find.text('Reason: Customer unreachable'), findsOneWidget);
      expect(find.text('Delivery failed'), findsWidgets);
      expect(
        find.byKey(const ValueKey('confirm-receipt-package-b')),
        findsNothing,
      );
      expect(tester.takeException(), isNull);
    });
  });

  group('phone verification', () {
    test('OTP error codes map to specific messages', () {
      final strings = AppStrings.en;
      for (final code in [
        'PHONE_INVALID',
        'OTP_RATE_LIMITED',
        'OTP_INVALID',
        'OTP_EXPIRED',
      ]) {
        expect(otpErrorKey(code), 'otp.$code');
        expect(
          otpErrorMessage(AppFailure('raw', status: 400, code: code), strings),
          strings.t('otp.$code'),
        );
      }
      expect(otpErrorKey('SOMETHING_ELSE'), isNull);
      expect(
        otpErrorMessage(const AppFailure('raw', status: 429), strings),
        strings.t('otp.OTP_RATE_LIMITED'),
      );
      expect(
        otpErrorMessage(const AppFailure('raw', status: 410), strings),
        strings.t('otp.OTP_EXPIRED'),
      );
      expect(
        otpErrorMessage(const AppFailure('raw', status: 503), strings),
        strings.t('otp.unavailable'),
      );
      expect(
        otpErrorMessage(
          const AppFailure('Server says no', status: 500),
          strings,
        ),
        'Server says no',
      );
    });
    test('API error bodies keep the machine-readable code', () {
      final failure = failureFrom(
        DioException(
          requestOptions: RequestOptions(path: '/me/phone-verifications'),
          response: Response(
            requestOptions: RequestOptions(path: '/me/phone-verifications'),
            statusCode: 400,
            data: {'statusCode': 400, 'message': 'Bad', 'code': 'OTP_INVALID'},
          ),
        ),
      );
      expect(failure.code, 'OTP_INVALID');
      expect(failure.status, 400);
    });
    test('Sri Lankan mobile numbers are pre-checked and compacted', () {
      for (final valid in [
        '0771234567',
        '771234567',
        '94771234567',
        '+94771234567',
        '+94 77 123 4567',
      ]) {
        expect(isSriLankanMobile(valid), isTrue, reason: valid);
      }
      for (final invalid in ['0112345678', '+4477123456', '07712345']) {
        expect(isSriLankanMobile(invalid), isFalse, reason: invalid);
      }
      expect(compactPhone('+94 (77) 123-4567'), '+94771234567');
    });
    testWidgets('send then confirm verifies the phone', (tester) async {
      final repo = BuyerFixture();
      repo.onWrite = (path, method, data) async {
        if (path == '/me/phone-verifications') {
          return {
            'verificationId': 'v-1',
            'phone': '+94771234567',
            'expiresAt': '2099-01-01T00:10:00Z',
            'resendAfter': DateTime.now()
                .add(const Duration(seconds: 30))
                .toUtc()
                .toIso8601String(),
          };
        }
        if (path == '/me/phone-verifications/v-1/confirm') {
          if (object(data)['code'] != '123456') {
            throw const AppFailure('raw', status: 400, code: 'OTP_INVALID');
          }
          return {'phone': '+94771234567', 'verifiedAt': '2026-11-01T00:00Z'};
        }
        return {};
      };
      await pumpBuyer(tester, '/account/phone?phone=077%20123%204567', repo);
      await tester.tap(find.byKey(const ValueKey('otp-send')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(object(repo.writes.first.data), {'phone': '0771234567'});
      expect(find.textContaining('Resend code in'), findsOneWidget);
      await tester.enterText(find.byKey(const ValueKey('otp-code')), '000000');
      await tester.tap(find.byKey(const ValueKey('otp-verify')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(
        find.text('That code is not correct. Check the SMS and try again.'),
        findsOneWidget,
      );
      await tester.enterText(find.byKey(const ValueKey('otp-code')), '123456');
      await tester.tap(find.byKey(const ValueKey('otp-verify')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(repo.writes.last.path, '/me/phone-verifications/v-1/confirm');
      expect(object(repo.writes.last.data), {'code': '123456'});
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });

  group('push device registration', () {
    testWidgets('registers FCM token with resolved app version', (
      tester,
    ) async {
      final repo = BuyerFixture();
      await pumpBuyer(
        tester,
        '/',
        repo,
        appVersion: '1.1.0',
        push: FakePushService(),
      );
      final deviceWrite = repo.writes.singleWhere(
        (call) => call.path == '/me/devices',
      );
      expect(deviceWrite.method, 'POST');
      expect(object(deviceWrite.data), {
        'token': 'fcm-token-1234567890123456',
        'platform': 'android',
        'appVersion': '1.1.0',
      });
    });

    testWidgets('falls back to 0.0.0 when platform version is null', (
      tester,
    ) async {
      final repo = BuyerFixture();
      await pumpBuyer(
        tester,
        '/',
        repo,
        overrideNullVersion: true,
        push: FakePushService(),
      );
      final deviceWrite = repo.writes.singleWhere(
        (call) => call.path == '/me/devices',
      );
      expect(object(deviceWrite.data)['appVersion'], '0.0.0');
    });
  });
}
