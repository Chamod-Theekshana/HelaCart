import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:timezone/data/latest.dart' as tz;

import '../test/app_widget_test.dart' as public_app;
import '../test/buyer_flows_test.dart' as buyer_app;
import '../test/support/buyer_fixture.dart';

Future<void> assets(WidgetTester tester) async {
  await tester.runAsync(() async {
    final context = tester.element(find.byType(MaterialApp));
    final manifest = await AssetManifest.loadFromAssetBundle(rootBundle);
    for (final path in manifest.listAssets().where(
      (p) =>
          p.startsWith('assets/') && (p.endsWith('.jpg') || p.endsWith('.png')),
    )) {
      await precacheImage(AssetImage(path), context);
    }
  });
  await tester.pumpAndSettle();
}

Future<void> capture(WidgetTester tester, String name) async {
  await tester.pumpAndSettle();
  final boundary = tester.renderObject<RenderRepaintBoundary>(
    find.byType(RepaintBoundary).first,
  );
  await tester.runAsync(() async {
    final image = await boundary.toImage(pixelRatio: 2);
    final png = await image.toByteData(format: ui.ImageByteFormat.png);
    await File('docs/ui-review/$name.png')
        .writeAsBytes(png!.buffer.asUint8List());
    image.dispose();
  });
  expect(tester.takeException(), isNull);
}

void main() {
  setUpAll(() async {
    tz.initializeTimeZones();
    for (final font in {
      'Inter': 'assets/fonts/Inter.ttf',
      'PlusJakartaSans': 'assets/fonts/PlusJakartaSans.ttf',
      'MaterialIcons': 'fonts/MaterialIcons-Regular.otf',
    }.entries) {
      await (FontLoader(font.key)..addFont(rootBundle.load(font.value))).load();
    }
  });
  for (final route in [
    ('/', 'home-390'),
    ('/categories', 'categories-390'),
    ('/products', 'products-390'),
    ('/products/preview-shirt', 'details-390'),
    ('/auth', 'sign-in-390'),
    ('/shops', 'shops-390'),
    ('/support/new', 'guest-support-390'),
  ]) {
    testWidgets('visual review ${route.$1}', (tester) async {
      await public_app.openApp(tester, route.$1);
      await assets(tester);
      await capture(tester, route.$2);
      if (route.$1 == '/') {
        await tester.tap(find.byTooltip('Open account menu'));
        await tester.pumpAndSettle();
        await capture(tester, 'drawer-390');
      }
    });
  }
  for (final route in [
    ('/cart', 'bag-fixture-390'),
    ('/checkout', 'checkout-fixture-390'),
    ('/favorites', 'favorites-fixture-390'),
    ('/orders', 'orders-fixture-390'),
    ('/account/profile', 'profile-fixture-390'),
    ('/account/addresses/new', 'address-form-fixture-390'),
    ('/notifications', 'notifications-fixture-390'),
  ]) {
    testWidgets('visual review fixture ${route.$1}', (tester) async {
      await buyer_app.openBuyer(tester, route.$1, BuyerFixture());
      await assets(tester);
      await capture(tester, route.$2);
      if (route.$1 == '/checkout') {
        await tester.tap(find.text('Kasun Perera'));
        await tester.pumpAndSettle();
        await capture(tester, 'checkout-quote-fixture-390');
        await buyer_app.tapReachable(tester, find.text('Review order'));
        await capture(tester, 'checkout-review-fixture-390');
      }
    });
  }
  for (final route in ['/favorites', '/notifications', '/orders']) {
    testWidgets('large text visual review fixture $route', (tester) async {
      await buyer_app.openBuyer(tester, route, BuyerFixture(), scale: 1.8);
      await assets(tester);
      await capture(tester, '${route.substring(1)}-fixture-large-text');
    });
  }
  testWidgets('visual review narrow large text', (tester) async {
    await public_app.openApp(tester, '/products', width: 360, scale: 1.8);
    await assets(tester);
    await capture(tester, 'catalog-360-large-text');
  });
}
