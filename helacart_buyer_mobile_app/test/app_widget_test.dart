import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:helacart_buyer_mobile_app/app/config.dart';
import 'package:helacart_buyer_mobile_app/app/helacart_app.dart';
import 'package:helacart_buyer_mobile_app/app/providers.dart';
import 'package:helacart_buyer_mobile_app/app/router.dart';
import 'package:helacart_buyer_mobile_app/core/data/preview_repository.dart';
import 'package:helacart_buyer_mobile_app/core/ui/buyer_navigation.dart';
import 'package:timezone/data/latest.dart' as tz;

import 'support/fakes.dart';

Future<void> openApp(
  WidgetTester tester,
  String route, {
  double width = 390,
  double scale = 1,
}) async {
  tester.view.physicalSize = Size(width, 844);
  tester.view.devicePixelRatio = 1;
  tester.platformDispatcher.textScaleFactorTestValue = scale;
  final auth = FakeAuth();
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        configProvider.overrideWithValue(
          const AppConfig(apiUrl: 'https://example.test/api/v1', preview: true),
        ),
        authServiceProvider.overrideWithValue(auth),
        repositoryProvider.overrideWithValue(PreviewRepository()),
        initialLocationProvider.overrideWithValue(route),
      ],
      child: MediaQuery(
        data: MediaQueryData(
          size: Size(width, 844),
          textScaler: TextScaler.linear(scale),
        ),
        child: const HelaCartApp(),
      ),
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
}

void main() {
  setUpAll(tz.initializeTimeZones);
  testWidgets(
    'five tabs select the matching destination including persistent Bag',
    (tester) async {
      await openApp(tester, '/');
      for (final i in [1, 2, 3, 4, 0]) {
        await tester.tap(find.text(BuyerNavigationBar.labels[i]).last);
        await tester.pumpAndSettle();
        expect(
          tester
              .widget<BuyerNavigationBar>(find.byType(BuyerNavigationBar))
              .selectedIndex,
          i,
        );
        expect(find.text('Account'), findsNothing);
        if (i == 2) {
          expect(find.text('Your cart'), findsOneWidget);
          expect(find.text('Sign in'), findsOneWidget);
        }
        expect(tester.takeException(), isNull);
      }
    },
  );
  testWidgets('profile drawer closes with Escape, swipe and backdrop', (
    tester,
  ) async {
    await openApp(tester, '/');
    Future<void> open() async {
      await tester.tap(find.byTooltip('Open account menu'));
      await tester.pumpAndSettle();
      expect(find.text('YOUR SHOPPING'), findsOneWidget);
      expect(find.text('Sign in / Create account'), findsOneWidget);
    }

    await open();
    await tester.sendKeyEvent(LogicalKeyboardKey.escape);
    await tester.pumpAndSettle();
    expect(find.text('YOUR SHOPPING'), findsNothing);
    await open();
    await tester.drag(find.byType(Drawer), const Offset(-340, 0));
    await tester.pumpAndSettle();
    expect(find.text('YOUR SHOPPING'), findsNothing);
    await open();
    await tester.tapAt(const Offset(380, 400));
    await tester.pumpAndSettle();
    expect(find.text('YOUR SHOPPING'), findsNothing);
    expect(tester.takeException(), isNull);
  });
  testWidgets('Home filter opens the existing catalog filter sheet', (
    tester,
  ) async {
    await openApp(tester, '/');
    await tester.tap(find.byTooltip('Filter products'));
    await tester.pumpAndSettle();
    expect(find.text('Apply filters'), findsOneWidget);
    expect(find.byType(BuyerNavigationBar), findsNothing);
    expect(tester.takeException(), isNull);
  });
  testWidgets('profile drawer remains scrollable with large text at 360px', (
    tester,
  ) async {
    await openApp(tester, '/', width: 360, scale: 1.8);
    await tester.tap(find.byTooltip('Open account menu'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Shopping help'),
      200,
      scrollable: find
          .descendant(
            of: find.byType(Drawer),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    expect(tester.takeException(), isNull);
  });
  testWidgets('home exposes real shopping navigation and labelled preview', (
    tester,
  ) async {
    await openApp(tester, '/');
    expect(find.textContaining('DESIGN PREVIEW'), findsOneWidget);
    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Categories'), findsOneWidget);
    expect(find.textContaining('Good finds.'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.tap(find.text('Categories').last);
    await tester.pumpAndSettle();
    expect(find.text('Find your everyday favourites.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets('guest cart action leads to sign in instead of a pretend cart', (
    tester,
  ) async {
    await openApp(tester, '/cart');
    expect(find.text('Sign in'), findsOneWidget);
    await tester.tap(find.text('Sign in'));
    await tester.pumpAndSettle();
    expect(find.text('Email address'), findsOneWidget);
    expect(find.text('Password'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets('catalog filters validate incorrect price range', (tester) async {
    await openApp(tester, '/products');
    await tester.tap(find.text('Filter'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextField, 'Min price (Rs.)'),
      '5000',
    );
    await tester.enterText(
      find.widgetWithText(TextField, 'Max price (Rs.)'),
      '1000',
    );
    await tester.tap(find.text('Apply filters'));
    await tester.pumpAndSettle();
    expect(
      find.textContaining('minimum must not exceed maximum'),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });
  testWidgets(
    'product selection marks sold out variant and disables purchase',
    (tester) async {
      await openApp(tester, '/products/preview-shirt');
      await tester.scrollUntilVisible(
        find.widgetWithText(ChoiceChip, 'Natural / L · Sold out'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Natural / L · Sold out'));
      await tester.pumpAndSettle();
      expect(find.text('Currently sold out'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  for (final width in [360.0, 390.0]) {
    for (final route in [
      '/',
      '/categories',
      '/products',
      '/offers',
      '/search',
      '/products/preview-shirt',
      '/products/preview-shirt/reviews',
      '/gallery/preview-shirt',
      '/shops',
      '/shops/ceylon-threads',
      '/shops/ceylon-threads/products',
      '/shops/ceylon-threads/reviews',
      '/favorites',
      '/orders',
      '/account',
      '/cart',
      '/checkout',
      '/notifications',
      '/returns',
      '/refunds',
      '/support',
      '/support/new',
      '/account/profile',
      '/account/addresses',
      '/account/addresses/new',
      '/account/security',
      '/account/security/password',
      '/account/security/email',
      '/account/reviews',
      '/auth',
      '/auth/register',
      '/auth/reset',
      '/verify',
      '/help',
      '/welcome',
    ]) {
      testWidgets('screen $route fits ${width.toInt()}px', (tester) async {
        await openApp(tester, route, width: width);
        expect(tester.takeException(), isNull, reason: route);
      });
    }
  }
  for (final route in [
    '/',
    '/products',
    '/products/preview-shirt',
    '/auth',
    '/help',
    '/shops/ceylon-threads',
    '/shops/ceylon-threads/products',
    '/shops/ceylon-threads/reviews',
    '/gallery/preview-shirt',
  ]) {
    testWidgets('large text $route fits 360px', (tester) async {
      await openApp(tester, route, width: 360, scale: 1.8);
      final failure = tester.takeException();
      expect(
        failure,
        isNull,
        reason: failure is FlutterError ? failure.toStringDeep() : route,
      );
    });
  }
  testWidgets('product options sheet keeps sold-out variants unavailable', (
    tester,
  ) async {
    await openApp(tester, '/products/preview-shirt');
    await tester.tap(find.textContaining('Choose options ·'));
    // The originating action remains busy until the options sheet closes.
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('Add to cart'), findsOneWidget);
    final unavailable = find
        .widgetWithText(ChoiceChip, 'Natural / L · Sold out')
        .last;
    await tester.tap(unavailable);
    await tester.pump(const Duration(milliseconds: 300));
    expect(
      tester
          .widget<FilledButton>(
            find.widgetWithText(FilledButton, 'Add to cart'),
          )
          .onPressed,
      isNull,
    );
    expect(tester.takeException(), isNull);
    Navigator.of(tester.element(unavailable)).pop();
    await tester.pumpAndSettle();
  });
}
