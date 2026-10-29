import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:helacart_buyer_mobile_app/app/router.dart';
import 'package:helacart_buyer_mobile_app/core/data/format.dart';
import 'package:helacart_buyer_mobile_app/core/data/json.dart';
import 'package:helacart_buyer_mobile_app/core/data/models.dart';
import 'package:helacart_buyer_mobile_app/core/data/preview_repository.dart';
import 'package:helacart_buyer_mobile_app/features/auth/presentation/auth_screen.dart';
import 'package:helacart_buyer_mobile_app/features/notifications/presentation/notifications_screen.dart';
import 'package:timezone/data/latest.dart' as tz;

void main() {
  setUpAll(tz.initializeTimeZones);
  test('listing price selects cheapest available variant', () {
    const p = Product(
      id: 'p',
      title: 'T',
      variants: [
        Variant(id: 'sold', priceLkrMinor: 1),
        Variant(id: 'b', priceLkrMinor: 200, availableQuantity: 4),
        Variant(id: 'a', priceLkrMinor: 100, availableQuantity: 2),
      ],
    );
    expect(p.availableVariant!.id, 'a');
    expect(p.displayPrice, 100);
  });
  test('generated models round-trip JSON and preserve option prices', () {
    final p = PreviewRepository.productRows.first;
    final result = Product.fromJson(object(jsonDecode(jsonEncode(p.toJson()))));
    expect(result, p);
    expect(result.variants.first.originalPriceLkrMinor, 485000);
  });
  test('preview shop listing is decodable JSON, not model instances', () async {
    final data = object(
      await PreviewRepository().read('/shops/ceylon-threads/products'),
    );
    expect(
      Product.fromJson(objects(data['items']).first).title,
      contains('Linen'),
    );
  });
  test(
    'preview search and offers honor filters without inventing rows',
    () async {
      final repo = PreviewRepository();
      expect((await repo.products('q=does-not-exist')).items, isEmpty);
      expect((await repo.products('deals=true')).items.length, 1);
    },
  );
  test('minor parsing is exact and rejects malformed prices', () {
    expect(parseMinor('4365.05'), 436505);
    expect(parseMinor('0.01'), 1);
    for (final s in ['-1', '2.001', '1e3', 'NaN', '10000000.01']) {
      expect(parseMinor(s), isNull, reason: s);
    }
  });
  test('money and dates use Sri Lankan formatting', () {
    expect(money(1318000), 'Rs. 13,180.00');
    expect(dateText('2026-10-28T20:00:00Z'), '29 Oct 2026');
  });
  test('sign-in destinations cannot escape buyer routes', () {
    for (final s in [
      'https://evil.test',
      '//evil.test',
      '/admin',
      '/seller',
      '/\\evil',
      '/auth',
      '/checkout\n',
    ]) {
      expect(safeDestination(s), '/');
    }
    expect(safeDestination('/products/a?x=1'), '/products/a?x=1');
  });
  test('catalog URL input is validated before constructing requests', () {
    expect(
      cleanCatalogQuery({
        'minPrice': '-1',
        'sort': 'hacked',
        'deals': 'true',
        'unknown': '1',
      }),
      {'deals': 'true', 'sort': 'newest'},
    );
    expect(
      cleanCatalogQuery({'inStock': 'true', 'sort': 'relevance'}, shop: true),
      {'sort': 'newest'},
    );
  });
  test(
    'buyer notification links exclude other workspaces and external links',
    () {
      for (final href in [
        '/admin/refunds',
        '/seller/orders',
        'https://evil.test',
        '//evil.test',
      ]) {
        expect(buyerNoticeTarget({'href': href}), isNull);
      }
      expect(
        buyerNoticeTarget({'href': '/account/support?case=abc'}),
        '/support/abc',
      );
      expect(buyerNoticeTarget({'href': '/orders?order=abc'}), '/orders/abc');
    },
  );
}
