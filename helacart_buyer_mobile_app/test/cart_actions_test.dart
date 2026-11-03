import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:helacart_buyer_mobile_app/core/data/json.dart';
import 'package:helacart_buyer_mobile_app/core/data/models.dart';
import 'package:helacart_buyer_mobile_app/core/network/api_client.dart';
import 'package:helacart_buyer_mobile_app/features/cart/application/cart_actions.dart';

import 'support/fakes.dart';

void main() {
  late FakeRepository repo;
  late CartActions actions;
  String? owner;
  setUp(() {
    owner = 'a';
    repo = FakeRepository();
    actions = CartActions(repo, () => owner);
  });
  test('add increments existing quantity instead of replacing it', () async {
    repo.cartValue = const CartData(
      items: [
        {'variantId': 'v', 'quantity': 2},
      ],
    );
    await actions.add('v', 1, 6);
    expect(object(repo.writes.single.data)['quantity'], 3);
  });
  test('rapid additions are serialized against fresh cart state', () async {
    var quantity = 0;
    repo.onCart = (_) async => CartData(
      items: [
        {'variantId': 'v', 'quantity': quantity},
      ],
    );
    repo.onWrite = (p, m, d) async {
      await Future<void>.delayed(const Duration(milliseconds: 2));
      quantity = integer(object(d)['quantity']);
      return {};
    };
    await Future.wait([actions.add('v', 1, 6), actions.add('v', 2, 6)]);
    expect(quantity, 3);
  });
  test('stock limit rejects without a write', () async {
    repo.cartValue = const CartData(
      items: [
        {'variantId': 'v', 'quantity': 6},
      ],
    );
    await expectLater(actions.add('v', 1, 6), throwsA(isA<AppFailure>()));
    expect(repo.writes, isEmpty);
  });
  test('failed mutation does not poison subsequent queued work', () async {
    await expectLater(actions.set('v', 101), throwsA(isA<AppFailure>()));
    await actions.set('v', 2);
    expect(repo.writes.length, 1);
  });
  test(
    'account change while cart read is pending blocks the mutation',
    () async {
      final result = Completer<CartData>();
      repo.onCart = (_) => result.future;
      final work = actions.add('v', 1, 5);
      await Future<void>.delayed(Duration.zero);
      owner = 'b';
      result.complete(const CartData());
      await expectLater(work, throwsA(isA<AppFailure>()));
      expect(repo.writes, isEmpty);
    },
  );
}
