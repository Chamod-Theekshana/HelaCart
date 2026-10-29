// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_Product _$ProductFromJson(Map<String, dynamic> json) => _Product(
  id: json['id'] as String,
  title: json['title'] as String,
  description: json['description'] as String?,
  brand: json['brand'] as String?,
  warranty: json['warranty'] as String?,
  imageUrls:
      (json['imageUrls'] as List<dynamic>?)?.map((e) => e as String).toList() ??
      const [],
  priceLkrMinor: (json['priceLkrMinor'] as num?)?.toInt() ?? 0,
  listingPriceLkrMinor: (json['listingPriceLkrMinor'] as num?)?.toInt(),
  originalPriceLkrMinor: (json['originalPriceLkrMinor'] as num?)?.toInt(),
  category: json['category'] as Map<String, dynamic>? ?? const {},
  seller: json['seller'] as Map<String, dynamic>? ?? const {},
  variants:
      (json['variants'] as List<dynamic>?)
          ?.map((e) => Variant.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
  specifications:
      (json['specifications'] as List<dynamic>?)
          ?.map((e) => e as Map<String, dynamic>)
          .toList() ??
      const [],
  promotion: json['promotion'] as Map<String, dynamic>?,
);

Map<String, dynamic> _$ProductToJson(_Product instance) => <String, dynamic>{
  'id': instance.id,
  'title': instance.title,
  'description': instance.description,
  'brand': instance.brand,
  'warranty': instance.warranty,
  'imageUrls': instance.imageUrls,
  'priceLkrMinor': instance.priceLkrMinor,
  'listingPriceLkrMinor': instance.listingPriceLkrMinor,
  'originalPriceLkrMinor': instance.originalPriceLkrMinor,
  'category': instance.category,
  'seller': instance.seller,
  'variants': instance.variants,
  'specifications': instance.specifications,
  'promotion': instance.promotion,
};

_Variant _$VariantFromJson(Map<String, dynamic> json) => _Variant(
  id: json['id'] as String,
  sku: json['sku'] as String? ?? '',
  optionValues:
      (json['optionValues'] as Map<String, dynamic>?)?.map(
        (k, e) => MapEntry(k, e as String),
      ) ??
      const {},
  priceLkrMinor: (json['priceLkrMinor'] as num?)?.toInt() ?? 0,
  originalPriceLkrMinor: (json['originalPriceLkrMinor'] as num?)?.toInt(),
  availableQuantity: (json['availableQuantity'] as num?)?.toInt() ?? 0,
);

Map<String, dynamic> _$VariantToJson(_Variant instance) => <String, dynamic>{
  'id': instance.id,
  'sku': instance.sku,
  'optionValues': instance.optionValues,
  'priceLkrMinor': instance.priceLkrMinor,
  'originalPriceLkrMinor': instance.originalPriceLkrMinor,
  'availableQuantity': instance.availableQuantity,
};

_BuyerAddress _$BuyerAddressFromJson(Map<String, dynamic> json) =>
    _BuyerAddress(
      id: json['id'] as String,
      recipient: json['recipient'] as String,
      phone: json['phone'] as String,
      line1: json['line1'] as String,
      line2: json['line2'] as String?,
      city: json['city'] as String,
      district: json['district'] as String,
      postalCode: json['postalCode'] as String,
    );

Map<String, dynamic> _$BuyerAddressToJson(_BuyerAddress instance) =>
    <String, dynamic>{
      'id': instance.id,
      'recipient': instance.recipient,
      'phone': instance.phone,
      'line1': instance.line1,
      'line2': instance.line2,
      'city': instance.city,
      'district': instance.district,
      'postalCode': instance.postalCode,
    };

_CartData _$CartDataFromJson(Map<String, dynamic> json) => _CartData(
  items:
      (json['items'] as List<dynamic>?)
          ?.map((e) => e as Map<String, dynamic>)
          .toList() ??
      const [],
  subtotalLkrMinor: (json['subtotalLkrMinor'] as num?)?.toInt() ?? 0,
  shippingLkrMinor: (json['shippingLkrMinor'] as num?)?.toInt() ?? 0,
  totalLkrMinor: (json['totalLkrMinor'] as num?)?.toInt() ?? 0,
  canCheckout: json['canCheckout'] as bool? ?? false,
  checkoutQuote: json['checkoutQuote'] as String?,
  addressId: json['addressId'] as String?,
  deliveryQuoted: json['deliveryQuoted'] as bool? ?? false,
  deliveryBySeller:
      (json['deliveryBySeller'] as List<dynamic>?)
          ?.map((e) => e as Map<String, dynamic>)
          .toList() ??
      const [],
);

Map<String, dynamic> _$CartDataToJson(_CartData instance) => <String, dynamic>{
  'items': instance.items,
  'subtotalLkrMinor': instance.subtotalLkrMinor,
  'shippingLkrMinor': instance.shippingLkrMinor,
  'totalLkrMinor': instance.totalLkrMinor,
  'canCheckout': instance.canCheckout,
  'checkoutQuote': instance.checkoutQuote,
  'addressId': instance.addressId,
  'deliveryQuoted': instance.deliveryQuoted,
  'deliveryBySeller': instance.deliveryBySeller,
};
