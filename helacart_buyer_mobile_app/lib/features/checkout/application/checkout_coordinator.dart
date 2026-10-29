import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

import '../../../core/data/buyer_repository.dart';
import '../../../core/data/json.dart';
import '../../../core/network/api_client.dart';

class CheckoutIntent {
  const CheckoutIntent({
    required this.owner,
    required this.key,
    required this.addressId,
    required this.quote,
  });
  final String owner, key, addressId, quote;
  Json toJson() => {
    'owner': owner,
    'checkoutKey': key,
    'addressId': addressId,
    'quote': quote,
  };
  factory CheckoutIntent.fromJson(Json json) {
    final key = string(json['checkoutKey']),
        owner = string(json['owner']),
        address = string(json['addressId']),
        quote = string(json['quote']);
    if (owner.isEmpty ||
        !Uuid.isValidUUID(fromString: key) ||
        !Uuid.isValidUUID(fromString: address) ||
        !RegExp(r'^[a-f0-9]{64}$').hasMatch(quote)) {
      throw const AppFailure(
        'Could not recover this checkout attempt. Contact HelaCart support before starting another attempt.',
      );
    }
    return CheckoutIntent(
      owner: owner,
      key: key,
      addressId: address,
      quote: quote,
    );
  }
}

abstract class CheckoutStore {
  Future<CheckoutIntent?> read(String owner);
  Future<void> save(CheckoutIntent intent);
  Future<void> clear(String owner);
}

class SecureCheckoutStore implements CheckoutStore {
  const SecureCheckoutStore(this.storage);
  final FlutterSecureStorage storage;
  String key(String owner) => 'helacart.checkout.${Uri.encodeComponent(owner)}';
  @override
  Future<CheckoutIntent?> read(String owner) async {
    final saved = await storage.read(key: key(owner));
    if (saved == null) return null;
    try {
      final result = CheckoutIntent.fromJson(object(jsonDecode(saved)));
      if (result.owner != owner) throw const FormatException();
      return result;
    } catch (_) {
      throw const AppFailure(
        'Checkout recovery data needs attention. Contact support before placing another order.',
      );
    }
  }

  @override
  Future<void> save(CheckoutIntent intent) =>
      storage.write(key: key(intent.owner), value: jsonEncode(intent.toJson()));
  @override
  Future<void> clear(String owner) => storage.delete(key: key(owner));
}

class CheckoutCoordinator {
  CheckoutCoordinator(this.repository, this.store, this.identity);
  final BuyerRepository repository;
  final CheckoutStore store;
  final String? Function() identity;
  bool _busy = false;
  Future<Json> place({
    required String owner,
    String? addressId,
    String? quote,
  }) async {
    if (_busy) throw const AppFailure('An order check is already in progress.');
    _busy = true;
    try {
      if (identity() != owner) {
        throw const AppFailure('Sign in again to continue your checkout.');
      }
      var intent = await store.read(owner);
      if (intent == null) {
        if (addressId == null || quote == null) {
          throw const AppFailure(
            'Choose an address and refresh your delivery quote.',
          );
        }
        intent = CheckoutIntent(
          owner: owner,
          key: const Uuid().v4(),
          addressId: addressId,
          quote: quote,
        );
        await store.save(intent);
      }
      if (identity() != owner) throw const AppFailure('Your account changed.');
      try {
        final result = object(
          await repository.write('/me/orders/checkout', 'POST', {
            'addressId': intent.addressId,
            'checkoutKey': intent.key,
            'quote': intent.quote,
          }),
        );
        if (identity() != owner) {
          throw const AppFailure('Your account changed.');
        }
        if (string(result['id']).isEmpty) {
          throw const AppFailure(
            'Your order response was interrupted. Recheck this same attempt.',
          );
        }
        await store.clear(owner);
        return result;
      } on AppFailure catch (error) {
        if (error.definitiveCheckoutRejection) await store.clear(owner);
        rethrow;
      }
    } finally {
      _busy = false;
    }
  }
}
