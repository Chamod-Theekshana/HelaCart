import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/data/buyer_repository.dart';
import '../../../core/data/json.dart';
import '../../../core/network/api_client.dart';

final cartActionsProvider = Provider<CartActions>((ref) {
  final auth = ref.watch(authServiceProvider);
  return CartActions(ref.watch(repositoryProvider), () => auth.session?.uid);
});

class CartActions {
  CartActions(this.repository, this.identity);
  final BuyerRepository repository;
  final String? Function() identity;
  Future<void> _tail = Future.value();
  Future<void> _serialized(Future<void> Function() action) {
    final owner = identity();
    final result = _tail.then((_) async {
      if (owner == null || owner != identity()) {
        throw const AppFailure('Sign in again before changing your cart.');
      }
      await action();
    });
    _tail = result.then<void>((_) {}, onError: (Object _, StackTrace _) {});
    return result;
  }

  Future<void> add(String variantId, int amount, int stock) => _serialized(
    () async {
      final owner = identity();
      final cart = await repository.cart();
      final existing = cart.items
          .where((r) => r['variantId'] == variantId)
          .firstOrNull;
      final quantity = integer(existing?['quantity']) + amount;
      if (quantity < 1 || quantity > stock || quantity > 100) {
        throw const AppFailure(
          'Your cart quantity would exceed current availability. Review your cart.',
        );
      }
      if (owner != identity()) throw const AppFailure('Your account changed.');
      await repository.write('/me/cart/items/$variantId', 'PUT', {
        'quantity': quantity,
      });
    },
  );
  Future<void> set(String variantId, int quantity) => _serialized(() async {
    if (quantity < 1 || quantity > 100) {
      throw const AppFailure('Choose a quantity from 1 to 100.');
    }
    await repository.write('/me/cart/items/$variantId', 'PUT', {
      'quantity': quantity,
    });
  });
  Future<void> remove(String variantId) => _serialized(() async {
    await repository.write('/me/cart/items/$variantId', 'DELETE');
  });
}
