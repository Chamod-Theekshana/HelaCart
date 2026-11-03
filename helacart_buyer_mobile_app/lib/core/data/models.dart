import 'package:freezed_annotation/freezed_annotation.dart';

import 'json.dart';
part 'models.freezed.dart';
part 'models.g.dart';

@freezed
abstract class Product with _$Product {
  const Product._();
  const factory Product({
    required String id,
    required String title,
    String? description,
    String? brand,
    String? warranty,
    @Default([]) List<String> imageUrls,
    @Default(0) int priceLkrMinor,
    int? listingPriceLkrMinor,
    int? originalPriceLkrMinor,
    @Default({}) Json category,
    @Default({}) Json seller,
    @Default([]) List<Variant> variants,
    @Default([]) List<Json> specifications,
    Json? promotion,
  }) = _Product;
  factory Product.fromJson(Json json) => _$ProductFromJson(json);
  Variant? get availableVariant {
    final available = variants.where((v) => v.availableQuantity > 0).toList()
      ..sort((a, b) => a.priceLkrMinor.compareTo(b.priceLkrMinor));
    return available.firstOrNull;
  }

  int get displayPrice =>
      listingPriceLkrMinor ??
      availableVariant?.priceLkrMinor ??
      variants.firstOrNull?.priceLkrMinor ??
      priceLkrMinor;
  String get shopName => string(seller['name']);
  String get shopSlug => string(seller['slug']);
}

@freezed
abstract class Variant with _$Variant {
  const Variant._();
  const factory Variant({
    required String id,
    @Default('') String sku,
    @Default({}) Map<String, String> optionValues,
    @Default(0) int priceLkrMinor,
    int? originalPriceLkrMinor,
    @Default(0) int availableQuantity,
  }) = _Variant;
  factory Variant.fromJson(Json json) => _$VariantFromJson(json);
  String get optionLabel =>
      optionValues.isEmpty ? sku : optionValues.values.join(' / ');
}

@freezed
abstract class BuyerAddress with _$BuyerAddress {
  const BuyerAddress._();
  const factory BuyerAddress({
    required String id,
    required String recipient,
    required String phone,
    required String line1,
    String? line2,
    required String city,
    required String district,
    required String postalCode,
  }) = _BuyerAddress;
  factory BuyerAddress.fromJson(Json json) => _$BuyerAddressFromJson(json);
  String get formatted => [
    line1,
    if (line2?.isNotEmpty == true) line2!,
    city,
    district,
    postalCode,
  ].join(', ');
}

@freezed
abstract class CartData with _$CartData {
  const CartData._();
  const factory CartData({
    @Default([]) List<Json> items,
    @Default(0) int subtotalLkrMinor,
    @Default(0) int shippingLkrMinor,
    @Default(0) int totalLkrMinor,
    @Default(false) bool canCheckout,
    String? checkoutQuote,
    String? addressId,
    @Default(false) bool deliveryQuoted,
    @Default([]) List<Json> deliveryBySeller,
  }) = _CartData;
  factory CartData.fromJson(Json json) => _$CartDataFromJson(json);
  int get count =>
      items.fold(0, (sum, item) => sum + integer(item['quantity']));
  Map<String, List<Json>> get groups {
    final result = <String, List<Json>>{};
    for (final item in items) {
      (result[string(item['sellerId'])] ??= []).add(item);
    }
    return result;
  }
}

class PageData<T> {
  const PageData(this.items, {this.page = 1, this.pages = 1, this.total = 0});
  final List<T> items;
  final int page, pages, total;
  factory PageData.fromJson(Object? value, T Function(Json) decode) {
    final data = object(value);
    return PageData(
      objects(data['items']).map(decode).toList(growable: false),
      page: integer(data['page'], 1),
      pages: integer(data['pages'], 1),
      total: integer(data['total']),
    );
  }
}
