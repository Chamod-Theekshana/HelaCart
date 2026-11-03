import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:helacart_buyer_mobile_app/app/hc.dart';
import 'package:helacart_buyer_mobile_app/features/catalog/presentation/home_widgets.dart';
import 'package:timezone/data/latest.dart' as tz;

import 'buyer_flows_test.dart' show openBuyer, tapReachable;
import 'support/buyer_fixture.dart';
import 'support/real_fonts.dart';

int lineCount(RenderParagraph paragraph) {
  final text = paragraph.text.toPlainText();
  if (text.isEmpty) return 0;
  return paragraph
      .getBoxesForSelection(
        TextSelection(baseOffset: 0, extentOffset: text.length),
      )
      .map((box) => box.top.round())
      .toSet()
      .length;
}

void expectReadableControls(WidgetTester tester, {required bool singleLine}) {
  if (singleLine) {
    for (final button
        in find.byWidgetPredicate((w) => w is ButtonStyleButton).evaluate()) {
      for (final label
          in find
              .descendant(
                of: find.byElementPredicate((element) => element == button),
                matching: find.byType(RichText),
              )
              .evaluate()) {
        final paragraph = label.renderObject! as RenderParagraph;
        if (paragraph.text.toPlainText().trim().isEmpty) continue;
        expect(
          lineCount(paragraph),
          lessThanOrEqualTo(1),
          reason: 'Button label wraps: ${paragraph.text.toPlainText()}',
        );
        expect(
          paragraph.didExceedMaxLines,
          isFalse,
          reason: 'Button label was truncated: ${paragraph.text.toPlainText()}',
        );
      }
    }
  }
  expect(tester.takeException(), isNull);
}

Future<void> reviewPage(WidgetTester tester, {required bool singleLine}) async {
  expectReadableControls(tester, singleLine: singleLine);
  final lists = find.byType(Scrollable).evaluate().where((element) {
    final scrollable = element.widget as Scrollable;
    return scrollable.axisDirection == AxisDirection.down;
  });
  if (lists.isEmpty) return;
  final position = (lists.first as StatefulElement).state as ScrollableState;
  for (var step = 0; step < 16; step++) {
    final scroll = position.position;
    if (scroll.pixels >= scroll.maxScrollExtent) break;
    scroll.jumpTo((scroll.pixels + 450).clamp(0, scroll.maxScrollExtent));
    await tester.pumpAndSettle();
    expectReadableControls(tester, singleLine: singleLine);
  }
}

void main() {
  setUpAll(() async {
    tz.initializeTimeZones();
    await loadAppFonts();
  });

  const routes = [
    '/',
    '/categories',
    '/products',
    '/offers',
    '/search',
    '/products/preview-shirt',
    '/products/preview-shirt/reviews',
    '/shops',
    '/shops/ceylon-threads',
    '/cart',
    '/checkout',
    '/favorites',
    '/orders',
    '/orders/$fixtureOrder',
    '/account',
    '/account/profile',
    '/account/addresses',
    '/account/addresses/new',
    '/account/addresses/$fixtureAddress/edit',
    '/account/phone',
    '/notifications',
    '/returns',
    '/refunds',
    '/returns/new/$fixturePackage',
    '/support',
    '/support/new',
    '/support/$fixtureCase',
    '/auth',
    '/help',
  ];
  for (final config in [
    (width: 320.0, scale: 1.0, language: 'en'),
    (width: 360.0, scale: 1.0, language: 'en'),
    (width: 390.0, scale: 1.0, language: 'en'),
    (width: 360.0, scale: 1.8, language: 'en'),
    (width: 360.0, scale: 1.0, language: 'si'),
    (width: 360.0, scale: 1.0, language: 'ta'),
  ]) {
    for (final route in routes) {
      testWidgets(
        'real fonts $route ${config.width}px ${config.scale}x ${config.language}',
        (tester) async {
          await openBuyer(
            tester,
            route,
            BuyerFixture(),
            width: config.width,
            scale: config.scale,
            locale: Locale(config.language),
          );
          await reviewPage(
            tester,
            singleLine: config.scale == 1 && config.language == 'en',
          );
        },
      );
    }
  }

  testWidgets(
    'district picker stays usable above the keyboard on a short screen',
    (tester) async {
      await openBuyer(
        tester,
        '/account/addresses/new',
        BuyerFixture(),
        width: 320,
        height: 568,
      );
      final district = find.byKey(const ValueKey('address-district'));
      await tester.ensureVisible(district);
      await tester.tap(district);
      await tester.pumpAndSettle();
      tester.view.viewInsets = const FakeViewPadding(bottom: 280);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await tester.enterText(
        find.widgetWithText(TextField, 'Search Sri Lankan districts'),
        'col',
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Colombo'));
      await tester.pumpAndSettle();
      expect(find.text('Colombo'), findsOneWidget);
      expect(tester.takeException(), isNull);
      tester.view.resetViewInsets();
    },
  );

  testWidgets(
    'section action moves below the complete heading when space is tight',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: helacartTheme(),
          home: Scaffold(
            body: Center(
              child: SizedBox(
                width: 280,
                child: SectionTitle(
                  'Find your everyday',
                  more: 'Browse all categories',
                  onMore: () {},
                ),
              ),
            ),
          ),
        ),
      );
      final heading = find.text('Find your everyday');
      final action = find.text('Browse all categories');
      expect(lineCount(tester.renderObject<RenderParagraph>(heading)), 1);
      expect(lineCount(tester.renderObject<RenderParagraph>(action)), 1);
      expect(
        tester.getTopLeft(action).dy,
        greaterThan(tester.getBottomLeft(heading).dy),
      );
      expect(tester.takeException(), isNull);
    },
  );

  for (final scale in [1.0, 1.8]) {
    testWidgets('home shop tiles share one size at ${scale}x text', (
      tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: helacartTheme(),
          home: MediaQuery(
            data: MediaQueryData(
              size: const Size(360, 800),
              textScaler: TextScaler.linear(scale),
            ),
            child: Scaffold(
              body: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final shop in [
                    {
                      'name': 'Ceylon Threads and Handloom Collective of Kandy',
                      'slug': 'ceylon-threads',
                      'publicLocation': 'Kandy, Central Province',
                      'isVerified': true,
                    },
                    {'name': 'Clay', 'slug': 'clay'},
                  ])
                    SizedBox(width: 160, child: LocalShopTile(shop)),
                ],
              ),
            ),
          ),
        ),
      );
      final tiles = find.byType(LocalShopTile);
      expect(tester.getSize(tiles.first), tester.getSize(tiles.last));
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('compact button surfaces preserve full touch targets', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: helacartTheme(),
        home: Scaffold(
          body: Column(
            children: [
              FilledButton(onPressed: () {}, child: const Text('Save address')),
              OutlinedButton(onPressed: () {}, child: const Text('View order')),
            ],
          ),
        ),
      ),
    );
    for (final entry in [(FilledButton, 44.0), (OutlinedButton, 40.0)]) {
      final button = find.byType(entry.$1);
      final surface = find
          .descendant(of: button, matching: find.byType(Material))
          .first;
      expect(tester.getSize(surface).height, entry.$2);
      expect(tester.getSize(button).height, greaterThanOrEqualTo(48));
    }
  });

  testWidgets('return status resets when switching to refund records', (
    tester,
  ) async {
    await openBuyer(tester, '/returns', BuyerFixture());
    await tester.tap(find.text('All').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Resolved').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Refunds'));
    await tester.pumpAndSettle();
    expect(find.text('All statuses'), findsOneWidget);
    expect(find.text('Resolved'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  for (final config in [
    (width: 320.0, scale: 1.0),
    (width: 360.0, scale: 1.8),
  ]) {
    testWidgets('checkout review fits ${config.width}px ${config.scale}x', (
      tester,
    ) async {
      final repository = BuyerFixture();
      await openBuyer(
        tester,
        '/checkout',
        repository,
        width: config.width,
        scale: config.scale,
      );
      await tester.tap(find.text('Kasun Perera'));
      await tester.pumpAndSettle();
      await tapReachable(tester, find.text('Review order'));
      await reviewPage(tester, singleLine: config.scale == 1);
      expect(find.text('Place COD order'), findsOneWidget);
      expect(find.text('Rs. 13,180.00'), findsOneWidget);
      expect(repository.writes, isEmpty);
    });
  }
}
