import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:helacart_buyer_mobile_app/app/hc.dart';
import 'package:helacart_buyer_mobile_app/app/config.dart';
import 'package:helacart_buyer_mobile_app/app/helacart_app.dart';
import 'package:helacart_buyer_mobile_app/app/router.dart';
import 'package:helacart_buyer_mobile_app/core/ui/buyer_navigation.dart';
import 'package:helacart_buyer_mobile_app/features/checkout/presentation/checkout_screen.dart';
import 'package:timezone/data/latest.dart' as tz;

import 'support/fakes.dart';
import 'support/buyer_fixture.dart';

Future<FakeAuth> openBuyer(
  WidgetTester tester,
  String route,
  BuyerFixture repo, {
  bool verified = true,
  double scale = 1,
}) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  tester.platformDispatcher.textScaleFactorTestValue = scale;
  final auth = FakeAuth(
    BuyerSession('buyer-a', 'kasun@example.test', verified),
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
        checkoutStoreProvider.overrideWithValue(MemoryCheckoutStore()),
      ],
      child: const HelaCartApp(),
    ),
  );
  await tester.pumpAndSettle();
  addTearDown(() async {
    await tester.pumpWidget(const SizedBox());
    auth.dispose();
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
    tester.platformDispatcher.clearTextScaleFactorTestValue();
  });
  return auth;
}

Future<void> tapReachable(WidgetTester tester, Finder finder) async {
  for (var i = 0; i < 20 && finder.evaluate().isEmpty; i++) {
    await tester.drag(find.byType(Scrollable).first, const Offset(0, -250));
    await tester.pumpAndSettle();
  }
  await Scrollable.ensureVisible(tester.element(finder.first), alignment: .4);
  await tester.pumpAndSettle();
  await tester.tap(finder.first);
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(tz.initializeTimeZones);
  testWidgets(
    'Bag checkout stays above navigation and opens focused checkout',
    (tester) async {
      final repo = BuyerFixture();
      await openBuyer(tester, '/cart', repo);
      final bar = find.byType(BuyerNavigationBar);
      final checkout = find.widgetWithText(
        FilledButton,
        'Continue to checkout',
      );
      expect(tester.widget<BuyerNavigationBar>(bar).selectedIndex, 2);
      expect(
        tester.getRect(checkout).bottom,
        lessThanOrEqualTo(tester.getRect(bar).top),
      );
      await tester.tap(checkout);
      await tester.pumpAndSettle();
      expect(find.byType(BuyerNavigationBar), findsNothing);
      expect(find.text('Kasun Perera'), findsOneWidget);
      expect(repo.writes, isEmpty);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'open drawer removes the prior identity while a new profile loads',
    (tester) async {
      final repo = BuyerFixture();
      final auth = await openBuyer(tester, '/', repo);
      await tester.tap(find.byTooltip('Open account menu'));
      await tester.pumpAndSettle();
      expect(find.text('Kasun Perera'), findsOneWidget);
      final pending = Completer<Object?>();
      repo.onRead = (path) =>
          path == '/auth/me' ? pending.future : repo.respond(path);
      auth.change(const BuyerSession('buyer-b', 'new@example.test', true));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.text('Kasun Perera'), findsNothing);
      expect(find.text('kasun@example.test'), findsNothing);
      pending.complete({
        'id': 'buyer-b',
        'name': 'New Buyer',
        'email': 'new@example.test',
      });
      await tester.pumpAndSettle();
      expect(find.text('New Buyer'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'two-shop COD checkout shows authoritative fees and submits once',
    (tester) async {
      final repo = BuyerFixture();
      await openBuyer(tester, '/checkout', repo);
      await tester.tap(find.text('Kasun Perera'));
      await tester.pumpAndSettle();
      await tapReachable(tester, find.text('Review order'));
      expect(find.text('Review & place order'), findsOneWidget);
      await tapReachable(tester, find.text('Place COD order · Rs. 13,180.00'));
      expect(find.text('Order placed'), findsOneWidget);
      expect(find.text('Payment successful'), findsNothing);
      final calls = repo.writes
          .where((w) => w.path == '/me/orders/checkout')
          .toList();
      expect(calls.length, 1);
      expect(object(calls.single.data)['addressId'], fixtureAddress);
      expect(object(calls.single.data)['checkoutKey'], isNotEmpty);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('unverified buyer cannot reach checkout writes', (tester) async {
    final repo = BuyerFixture();
    await openBuyer(tester, '/checkout', repo, verified: false);
    expect(find.text('Verify your email'), findsOneWidget);
    expect(repo.writes, isEmpty);
  });
  testWidgets(
    'favorite alerts start off and preserve version on explicit opt-in',
    (tester) async {
      final repo = BuyerFixture();
      await openBuyer(tester, '/favorites', repo);
      await tapReachable(tester, find.text('Alert settings'));
      expect(
        tester
            .widget<SwitchListTile>(
              find.widgetWithText(SwitchListTile, 'Price drops'),
            )
            .value,
        isFalse,
      );
      await tester.tap(find.text('Price drops'));
      await tester.pumpAndSettle();
      await tapReachable(tester, find.text('Save preferences'));
      final saved = repo.writes.single;
      expect(object(saved.data), {
        'version': 3,
        'priceAlerts': true,
        'restockAlerts': false,
      });
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('selected-item return submits only chosen purchased quantity', (
    tester,
  ) async {
    final repo = BuyerFixture();
    await openBuyer(tester, '/returns/new/$fixturePackage', repo);
    await tapReachable(tester, find.byTooltip('Return more'));
    await tapReachable(tester, find.text('Continue'));
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Reason for return'),
      'The delivered size does not match my selected option.',
    );
    await tapReachable(tester, find.text('Submit return request'));
    final call = repo.writes.single;
    expect(call.path, '/me/returns');
    expect(object(call.data)['items'], [
      {'orderItemId': fixtureItem, 'quantity': 1},
    ]);
    expect(object(call.data)['sellerOrderId'], fixturePackage);
    expect(tester.takeException(), isNull);
  });
  testWidgets('failed support reply keeps draft and reuses its request key', (
    tester,
  ) async {
    final repo = BuyerFixture();
    var fail = true;
    repo.onWrite = (p, m, d) async {
      if (fail) throw const AppFailure('Connection interrupted');
      return {'id': 'new-message'};
    };
    await openBuyer(tester, '/support/$fixtureCase', repo);
    await tester.enterText(
      find.widgetWithText(TextField, 'Your reply'),
      'Please confirm the courier reference.',
    );
    await tapReachable(tester, find.text('Send reply'));
    expect(find.text('Connection interrupted'), findsOneWidget);
    expect(find.text('Please confirm the courier reference.'), findsOneWidget);
    fail = false;
    await tapReachable(tester, find.text('Send reply'));
    expect(
      object(repo.writes.first.data)['requestKey'],
      object(repo.writes.last.data)['requestKey'],
    );
    expect(tester.takeException(), isNull);
  });
  testWidgets(
    'product review writes rating/comment/version without photo fields',
    (tester) async {
      final repo = BuyerFixture();
      await openBuyer(tester, '/products/preview-shirt/reviews', repo);
      await tapReachable(tester, find.byTooltip('4 out of 5 stars'));
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Your experience'),
        'Comfortable material and exactly the option I ordered.',
      );
      await tapReachable(tester, find.text('Publish review'));
      expect(object(repo.writes.single.data), {
        'version': 0,
        'rating': 4,
        'comment': 'Comfortable material and exactly the option I ordered.',
      });
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'account switch removes old private profile while replacement loads',
    (tester) async {
      final repo = BuyerFixture();
      final auth = await openBuyer(tester, '/account', repo);
      expect(find.text('Kasun Perera'), findsOneWidget);
      final pending = Completer<Object?>();
      repo.onRead = (p) => p == '/auth/me' ? pending.future : repo.respond(p);
      auth.change(const BuyerSession('buyer-b', 'buyer-b@example.test', true));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      expect(find.text('Kasun Perera'), findsNothing);
      pending.complete({
        'id': 'buyer-b',
        'name': 'Buyer B',
        'email': 'buyer-b@example.test',
        'hasPhoto': false,
      });
      await tester.pumpAndSettle();
      expect(find.text('Buyer B'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  for (final route in [
    '/cart',
    '/orders',
    '/orders/$fixtureOrder',
    '/orders/$fixtureOrder/tracking/package-b',
    '/account',
    '/account/profile',
    '/account/addresses',
    '/account/addresses/new',
    '/account/security',
    '/account/security/password',
    '/account/security/email',
    '/account/reviews',
    '/favorites',
    '/notifications',
    '/returns',
    '/refunds',
    '/support',
    '/support/new',
    '/support/$fixtureCase',
  ]) {
    testWidgets('authenticated layout $route renders without exceptions', (
      tester,
    ) async {
      await openBuyer(tester, route, BuyerFixture());
      expect(tester.takeException(), isNull);
    });
  }
  for (final route in [
    '/cart',
    '/account',
    '/account/profile',
    '/account/addresses/new',
    '/support/$fixtureCase',
    '/checkout',
  ]) {
    testWidgets('authenticated large text $route remains usable', (
      tester,
    ) async {
      await openBuyer(tester, route, BuyerFixture(), scale: 1.8);
      expect(tester.takeException(), isNull);
    });
  }
}
