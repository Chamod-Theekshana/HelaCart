import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:helacart_buyer_mobile_app/core/data/json.dart';
import 'package:helacart_buyer_mobile_app/core/network/api_client.dart';
import 'package:helacart_buyer_mobile_app/features/checkout/application/checkout_coordinator.dart';

import 'support/fakes.dart';

const address = 'ef59222a-a72b-4dfb-80fd-464b1002e500';
final quote = List.filled(64, 'a').join();
void main() {
  late FakeRepository repo;
  late MemoryCheckoutStore store;
  late CheckoutCoordinator checkout;
  String? owner;
  setUp(() {
    owner = 'buyer-a';
    repo = FakeRepository();
    store = MemoryCheckoutStore();
    checkout = CheckoutCoordinator(repo, store, () => owner);
  });
  Future<Json> place() =>
      checkout.place(owner: 'buyer-a', addressId: address, quote: quote);
  test(
    'persists before dispatch and clears only after confirmed order',
    () async {
      repo.onWrite = (p, m, d) async {
        expect(store.values['buyer-a'], isNotNull);
        return {'id': 'confirmed'};
      };
      expect((await place())['id'], 'confirmed');
      expect(store.values, isEmpty);
      expect(repo.writes.single.method, 'POST');
    },
  );
  test(
    'timeout survives a new coordinator and reuses identical checkout key',
    () async {
      repo.onWrite = (p, m, d) async => throw const AppFailure('Timed out');
      await expectLater(place(), throwsA(isA<AppFailure>()));
      final first = object(repo.writes.first.data);
      repo.onWrite = (p, m, d) async => {'id': 'recovered'};
      final restarted = CheckoutCoordinator(repo, store, () => owner);
      await restarted.place(owner: 'buyer-a');
      expect(object(repo.writes.last.data), first);
      expect(store.values, isEmpty);
    },
  );
  for (final status in [400, 404, 409]) {
    test(
      'definitive $status rejection clears old quote before another attempt',
      () async {
        repo.onWrite = (p, m, d) async =>
            throw AppFailure('Changed', status: status);
        await expectLater(place(), throwsA(isA<AppFailure>()));
        expect(store.values, isEmpty);
        final key = object(repo.writes.single.data)['checkoutKey'];
        repo.onWrite = (p, m, d) async => {'id': 'new'};
        await place();
        expect(object(repo.writes.last.data)['checkoutKey'], isNot(key));
      },
    );
  }
  for (final status in [401, 403, 429, 500]) {
    test(
      'uncertain/auth $status response preserves original attempt',
      () async {
        repo.onWrite = (p, m, d) async =>
            throw AppFailure('Try later', status: status);
        await expectLater(place(), throwsA(isA<AppFailure>()));
        expect(store.values['buyer-a'], isNotNull);
      },
    );
  }
  test('prevents concurrent checkout requests', () async {
    final complete = Completer<Object?>();
    repo.onWrite = (p, m, d) => complete.future;
    final first = place();
    await Future<void>.delayed(Duration.zero);
    await expectLater(place(), throwsA(isA<AppFailure>()));
    expect(repo.writes.length, 1);
    complete.complete({'id': 'done'});
    await first;
  });
  test('storage failure prevents dispatch', () async {
    store.failSave = true;
    await expectLater(place(), throwsStateError);
    expect(repo.writes, isEmpty);
  });
  test('changed account cannot dispatch an old checkout', () async {
    owner = 'buyer-b';
    await expectLater(place(), throwsA(isA<AppFailure>()));
    expect(repo.writes, isEmpty);
  });
  test('other account cannot reuse saved private intent', () async {
    await store.save(
      CheckoutIntent(
        owner: 'buyer-a',
        key: 'e0e6a8ed-3f1f-4e04-a9e4-e944572c1e6b',
        addressId: address,
        quote: quote,
      ),
    );
    owner = 'buyer-b';
    await checkout.place(owner: 'buyer-b', addressId: address, quote: quote);
    expect(
      object(repo.writes.single.data)['checkoutKey'],
      isNot(store.values['buyer-a']!.key),
    );
    expect(store.values['buyer-a'], isNotNull);
  });
  test('malformed success response retains pending attempt', () async {
    repo.onWrite = (p, m, d) async => {};
    await expectLater(place(), throwsA(isA<AppFailure>()));
    expect(store.values, isNotEmpty);
  });
  test(
    'account change during response never confirms for the new owner',
    () async {
      repo.onWrite = (p, m, d) async {
        owner = 'buyer-b';
        return {'id': 'old-order'};
      };
      await expectLater(place(), throwsA(isA<AppFailure>()));
      expect(store.values['buyer-a'], isNotNull);
    },
  );
  test('invalid recovered intent is rejected', () {
    expect(
      () => CheckoutIntent.fromJson({
        'owner': 'buyer-a',
        'checkoutKey': 'bad',
        'addressId': address,
        'quote': quote,
      }),
      throwsA(isA<AppFailure>()),
    );
  });
}
