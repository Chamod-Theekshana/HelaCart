import 'dart:async';

import 'package:helacart_buyer_mobile_app/core/data/buyer_repository.dart';
import 'package:helacart_buyer_mobile_app/core/data/json.dart';
import 'package:helacart_buyer_mobile_app/core/data/models.dart';
import 'package:helacart_buyer_mobile_app/features/auth/data/auth_service.dart';
import 'package:helacart_buyer_mobile_app/features/checkout/application/checkout_coordinator.dart';

class MemoryCheckoutStore implements CheckoutStore {
  final values = <String, CheckoutIntent>{};
  bool failSave = false;
  @override
  Future<CheckoutIntent?> read(String owner) async => values[owner];
  @override
  Future<void> save(CheckoutIntent intent) async {
    if (failSave) throw StateError('Storage unavailable');
    values[intent.owner] = intent;
  }

  @override
  Future<void> clear(String owner) async {
    values.remove(owner);
  }
}

class FakeRepository implements BuyerRepository {
  final writes = <({String path, String method, Object? data})>[];
  Future<Object?> Function(String, String, Object?)? onWrite;
  Future<Object?> Function(String)? onRead;
  Future<CartData> Function(String?)? onCart;
  CartData cartValue = const CartData();
  @override
  Future<Object?> write(String path, String method, [Object? data]) async {
    writes.add((path: path, method: method, data: data));
    return onWrite == null
        ? {'id': 'order-confirmed'}
        : await onWrite!(path, method, data);
  }

  @override
  Future<Object?> read(String path, {bool private = false}) async =>
      onRead == null ? <String, dynamic>{} : await onRead!(path);
  @override
  Future<CartData> cart([String? addressId]) async =>
      onCart == null ? cartValue : await onCart!(addressId);
  @override
  Future<List<BuyerAddress>> addresses() async => const [];
  @override
  Future<List<Json>> categories() async => const [];
  @override
  Future<Product> product(String id) async => throw UnimplementedError();
  @override
  Future<PageData<Product>> products(String query) async => const PageData([]);
}

class FakeAuth extends AuthService {
  FakeAuth([this.active]) : super(null);
  BuyerSession? active;
  final updates = StreamController<BuyerSession?>.broadcast();
  @override
  bool get configured => true;
  @override
  BuyerSession? get session => active;
  @override
  Stream<BuyerSession?> get states async* {
    yield active;
    yield* updates.stream;
  }

  void change(BuyerSession? next) {
    active = next;
    updates.add(next);
  }

  @override
  Future<String?> token(bool refresh) async =>
      active == null ? null : 'test-token';
  @override
  Future<void> reload() async {
    updates.add(active);
  }

  @override
  Future<void> signOut() async {
    change(null);
  }

  @override
  void dispose() {
    updates.close();
    super.dispose();
  }
}
