// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$Product {

 String get id; String get title; String? get description; String? get brand; String? get warranty; List<String> get imageUrls; int get priceLkrMinor; int? get listingPriceLkrMinor; int? get originalPriceLkrMinor; Json get category; Json get seller; List<Variant> get variants; List<Json> get specifications; Json? get promotion;
/// Create a copy of Product
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ProductCopyWith<Product> get copyWith => _$ProductCopyWithImpl<Product>(this as Product, _$identity);

  /// Serializes this Product to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as Product;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Product&&(identical(other.id, _this.id) || other.id == _this.id)&&(identical(other.title, _this.title) || other.title == _this.title)&&(identical(other.description, _this.description) || other.description == _this.description)&&(identical(other.brand, _this.brand) || other.brand == _this.brand)&&(identical(other.warranty, _this.warranty) || other.warranty == _this.warranty)&&const DeepCollectionEquality().equals(other.imageUrls, _this.imageUrls)&&(identical(other.priceLkrMinor, _this.priceLkrMinor) || other.priceLkrMinor == _this.priceLkrMinor)&&(identical(other.listingPriceLkrMinor, _this.listingPriceLkrMinor) || other.listingPriceLkrMinor == _this.listingPriceLkrMinor)&&(identical(other.originalPriceLkrMinor, _this.originalPriceLkrMinor) || other.originalPriceLkrMinor == _this.originalPriceLkrMinor)&&const DeepCollectionEquality().equals(other.category, _this.category)&&const DeepCollectionEquality().equals(other.seller, _this.seller)&&const DeepCollectionEquality().equals(other.variants, _this.variants)&&const DeepCollectionEquality().equals(other.specifications, _this.specifications)&&const DeepCollectionEquality().equals(other.promotion, _this.promotion));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as Product;
  return Object.hash(runtimeType,_this.id,_this.title,_this.description,_this.brand,_this.warranty,const DeepCollectionEquality().hash(_this.imageUrls),_this.priceLkrMinor,_this.listingPriceLkrMinor,_this.originalPriceLkrMinor,const DeepCollectionEquality().hash(_this.category),const DeepCollectionEquality().hash(_this.seller),const DeepCollectionEquality().hash(_this.variants),const DeepCollectionEquality().hash(_this.specifications),const DeepCollectionEquality().hash(_this.promotion));
}

@override
String toString() {
  final _this = this as Product;
  return 'Product(id: ${_this.id}, title: ${_this.title}, description: ${_this.description}, brand: ${_this.brand}, warranty: ${_this.warranty}, imageUrls: ${_this.imageUrls}, priceLkrMinor: ${_this.priceLkrMinor}, listingPriceLkrMinor: ${_this.listingPriceLkrMinor}, originalPriceLkrMinor: ${_this.originalPriceLkrMinor}, category: ${_this.category}, seller: ${_this.seller}, variants: ${_this.variants}, specifications: ${_this.specifications}, promotion: ${_this.promotion})';
}


}

/// @nodoc
abstract mixin class $ProductCopyWith<$Res>  {
  factory $ProductCopyWith(Product value, $Res Function(Product) _then) = _$ProductCopyWithImpl;
@useResult
$Res call({
 String id, String title, String? description, String? brand, String? warranty, List<String> imageUrls, int priceLkrMinor, int? listingPriceLkrMinor, int? originalPriceLkrMinor, Json category, Json seller, List<Variant> variants, List<Json> specifications, Json? promotion
});




}
/// @nodoc
class _$ProductCopyWithImpl<$Res>
    implements $ProductCopyWith<$Res> {
  _$ProductCopyWithImpl(this._self, this._then);

  final Product _self;
  final $Res Function(Product) _then;

/// Create a copy of Product
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? title = null,Object? description = freezed,Object? brand = freezed,Object? warranty = freezed,Object? imageUrls = null,Object? priceLkrMinor = null,Object? listingPriceLkrMinor = freezed,Object? originalPriceLkrMinor = freezed,Object? category = null,Object? seller = null,Object? variants = null,Object? specifications = null,Object? promotion = freezed,}) {
  return _then(Product(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,brand: freezed == brand ? _self.brand : brand // ignore: cast_nullable_to_non_nullable
as String?,warranty: freezed == warranty ? _self.warranty : warranty // ignore: cast_nullable_to_non_nullable
as String?,imageUrls: null == imageUrls ? _self.imageUrls : imageUrls // ignore: cast_nullable_to_non_nullable
as List<String>,priceLkrMinor: null == priceLkrMinor ? _self.priceLkrMinor : priceLkrMinor // ignore: cast_nullable_to_non_nullable
as int,listingPriceLkrMinor: freezed == listingPriceLkrMinor ? _self.listingPriceLkrMinor : listingPriceLkrMinor // ignore: cast_nullable_to_non_nullable
as int?,originalPriceLkrMinor: freezed == originalPriceLkrMinor ? _self.originalPriceLkrMinor : originalPriceLkrMinor // ignore: cast_nullable_to_non_nullable
as int?,category: null == category ? _self.category : category // ignore: cast_nullable_to_non_nullable
as Json,seller: null == seller ? _self.seller : seller // ignore: cast_nullable_to_non_nullable
as Json,variants: null == variants ? _self.variants : variants // ignore: cast_nullable_to_non_nullable
as List<Variant>,specifications: null == specifications ? _self.specifications : specifications // ignore: cast_nullable_to_non_nullable
as List<Json>,promotion: freezed == promotion ? _self.promotion : promotion // ignore: cast_nullable_to_non_nullable
as Json?,
  ));
}

}


/// Adds pattern-matching-related methods to [Product].
extension ProductPatterns on Product {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Product value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Product() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Product value)  $default,){
final _that = this;
switch (_that) {
case _Product():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Product value)?  $default,){
final _that = this;
switch (_that) {
case _Product() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String title,  String? description,  String? brand,  String? warranty,  List<String> imageUrls,  int priceLkrMinor,  int? listingPriceLkrMinor,  int? originalPriceLkrMinor,  Json category,  Json seller,  List<Variant> variants,  List<Json> specifications,  Json? promotion)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Product() when $default != null:
return $default(_that.id,_that.title,_that.description,_that.brand,_that.warranty,_that.imageUrls,_that.priceLkrMinor,_that.listingPriceLkrMinor,_that.originalPriceLkrMinor,_that.category,_that.seller,_that.variants,_that.specifications,_that.promotion);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String title,  String? description,  String? brand,  String? warranty,  List<String> imageUrls,  int priceLkrMinor,  int? listingPriceLkrMinor,  int? originalPriceLkrMinor,  Json category,  Json seller,  List<Variant> variants,  List<Json> specifications,  Json? promotion)  $default,) {final _that = this;
switch (_that) {
case _Product():
return $default(_that.id,_that.title,_that.description,_that.brand,_that.warranty,_that.imageUrls,_that.priceLkrMinor,_that.listingPriceLkrMinor,_that.originalPriceLkrMinor,_that.category,_that.seller,_that.variants,_that.specifications,_that.promotion);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String title,  String? description,  String? brand,  String? warranty,  List<String> imageUrls,  int priceLkrMinor,  int? listingPriceLkrMinor,  int? originalPriceLkrMinor,  Json category,  Json seller,  List<Variant> variants,  List<Json> specifications,  Json? promotion)?  $default,) {final _that = this;
switch (_that) {
case _Product() when $default != null:
return $default(_that.id,_that.title,_that.description,_that.brand,_that.warranty,_that.imageUrls,_that.priceLkrMinor,_that.listingPriceLkrMinor,_that.originalPriceLkrMinor,_that.category,_that.seller,_that.variants,_that.specifications,_that.promotion);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _Product extends Product {
  const _Product({required this.id, required this.title, this.description, this.brand, this.warranty,  List<String> imageUrls = const [], this.priceLkrMinor = 0, this.listingPriceLkrMinor, this.originalPriceLkrMinor,  Json category = const {},  Json seller = const {},  List<Variant> variants = const [],  List<Json> specifications = const [],  Json? promotion}): _imageUrls = imageUrls,_category = category,_seller = seller,_variants = variants,_specifications = specifications,_promotion = promotion,super._();
  factory _Product.fromJson(Map<String, dynamic> json) => _$ProductFromJson(json);

@override final  String id;
@override final  String title;
@override final  String? description;
@override final  String? brand;
@override final  String? warranty;
 final  List<String> _imageUrls;
@override@JsonKey() List<String> get imageUrls {
  if (_imageUrls is EqualUnmodifiableListView) return _imageUrls;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_imageUrls);
}

@override@JsonKey() final  int priceLkrMinor;
@override final  int? listingPriceLkrMinor;
@override final  int? originalPriceLkrMinor;
 final  Json _category;
@override@JsonKey() Json get category {
  if (_category is EqualUnmodifiableMapView) return _category;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(_category);
}

 final  Json _seller;
@override@JsonKey() Json get seller {
  if (_seller is EqualUnmodifiableMapView) return _seller;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(_seller);
}

 final  List<Variant> _variants;
@override@JsonKey() List<Variant> get variants {
  if (_variants is EqualUnmodifiableListView) return _variants;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_variants);
}

 final  List<Json> _specifications;
@override@JsonKey() List<Json> get specifications {
  if (_specifications is EqualUnmodifiableListView) return _specifications;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_specifications);
}

 final  Json? _promotion;
@override Json? get promotion {
  final value = _promotion;
  if (value == null) return null;
  if (_promotion is EqualUnmodifiableMapView) return _promotion;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(value);
}


/// Create a copy of Product
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ProductCopyWith<_Product> get copyWith => __$ProductCopyWithImpl<_Product>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ProductToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _Product&&(identical(other.id, id) || other.id == id)&&(identical(other.title, title) || other.title == title)&&(identical(other.description, description) || other.description == description)&&(identical(other.brand, brand) || other.brand == brand)&&(identical(other.warranty, warranty) || other.warranty == warranty)&&const DeepCollectionEquality().equals(other.imageUrls, _imageUrls)&&(identical(other.priceLkrMinor, priceLkrMinor) || other.priceLkrMinor == priceLkrMinor)&&(identical(other.listingPriceLkrMinor, listingPriceLkrMinor) || other.listingPriceLkrMinor == listingPriceLkrMinor)&&(identical(other.originalPriceLkrMinor, originalPriceLkrMinor) || other.originalPriceLkrMinor == originalPriceLkrMinor)&&const DeepCollectionEquality().equals(other.category, _category)&&const DeepCollectionEquality().equals(other.seller, _seller)&&const DeepCollectionEquality().equals(other.variants, _variants)&&const DeepCollectionEquality().equals(other.specifications, _specifications)&&const DeepCollectionEquality().equals(other.promotion, _promotion));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,id,title,description,brand,warranty,const DeepCollectionEquality().hash(_imageUrls),priceLkrMinor,listingPriceLkrMinor,originalPriceLkrMinor,const DeepCollectionEquality().hash(_category),const DeepCollectionEquality().hash(_seller),const DeepCollectionEquality().hash(_variants),const DeepCollectionEquality().hash(_specifications),const DeepCollectionEquality().hash(_promotion));
}

@override
String toString() {
    return 'Product(id: $id, title: $title, description: $description, brand: $brand, warranty: $warranty, imageUrls: $imageUrls, priceLkrMinor: $priceLkrMinor, listingPriceLkrMinor: $listingPriceLkrMinor, originalPriceLkrMinor: $originalPriceLkrMinor, category: $category, seller: $seller, variants: $variants, specifications: $specifications, promotion: $promotion)';
}


}

/// @nodoc
abstract mixin class _$ProductCopyWith<$Res> implements $ProductCopyWith<$Res> {
  factory _$ProductCopyWith(_Product value, $Res Function(_Product) _then) = __$ProductCopyWithImpl;
@override @useResult
$Res call({
 String id, String title, String? description, String? brand, String? warranty, List<String> imageUrls, int priceLkrMinor, int? listingPriceLkrMinor, int? originalPriceLkrMinor, Json category, Json seller, List<Variant> variants, List<Json> specifications, Json? promotion
});




}
/// @nodoc
class __$ProductCopyWithImpl<$Res>
    implements _$ProductCopyWith<$Res> {
  __$ProductCopyWithImpl(this._self, this._then);

  final _Product _self;
  final $Res Function(_Product) _then;

/// Create a copy of Product
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? title = null,Object? description = freezed,Object? brand = freezed,Object? warranty = freezed,Object? imageUrls = null,Object? priceLkrMinor = null,Object? listingPriceLkrMinor = freezed,Object? originalPriceLkrMinor = freezed,Object? category = null,Object? seller = null,Object? variants = null,Object? specifications = null,Object? promotion = freezed,}) {
  return _then(_Product(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,brand: freezed == brand ? _self.brand : brand // ignore: cast_nullable_to_non_nullable
as String?,warranty: freezed == warranty ? _self.warranty : warranty // ignore: cast_nullable_to_non_nullable
as String?,imageUrls: null == imageUrls ? _self._imageUrls : imageUrls // ignore: cast_nullable_to_non_nullable
as List<String>,priceLkrMinor: null == priceLkrMinor ? _self.priceLkrMinor : priceLkrMinor // ignore: cast_nullable_to_non_nullable
as int,listingPriceLkrMinor: freezed == listingPriceLkrMinor ? _self.listingPriceLkrMinor : listingPriceLkrMinor // ignore: cast_nullable_to_non_nullable
as int?,originalPriceLkrMinor: freezed == originalPriceLkrMinor ? _self.originalPriceLkrMinor : originalPriceLkrMinor // ignore: cast_nullable_to_non_nullable
as int?,category: null == category ? _self._category : category // ignore: cast_nullable_to_non_nullable
as Json,seller: null == seller ? _self._seller : seller // ignore: cast_nullable_to_non_nullable
as Json,variants: null == variants ? _self._variants : variants // ignore: cast_nullable_to_non_nullable
as List<Variant>,specifications: null == specifications ? _self._specifications : specifications // ignore: cast_nullable_to_non_nullable
as List<Json>,promotion: freezed == promotion ? _self._promotion : promotion // ignore: cast_nullable_to_non_nullable
as Json?,
  ));
}


}


/// @nodoc
mixin _$Variant {

 String get id; String get sku; Map<String, String> get optionValues; int get priceLkrMinor; int? get originalPriceLkrMinor; int get availableQuantity;
/// Create a copy of Variant
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$VariantCopyWith<Variant> get copyWith => _$VariantCopyWithImpl<Variant>(this as Variant, _$identity);

  /// Serializes this Variant to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as Variant;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Variant&&(identical(other.id, _this.id) || other.id == _this.id)&&(identical(other.sku, _this.sku) || other.sku == _this.sku)&&const DeepCollectionEquality().equals(other.optionValues, _this.optionValues)&&(identical(other.priceLkrMinor, _this.priceLkrMinor) || other.priceLkrMinor == _this.priceLkrMinor)&&(identical(other.originalPriceLkrMinor, _this.originalPriceLkrMinor) || other.originalPriceLkrMinor == _this.originalPriceLkrMinor)&&(identical(other.availableQuantity, _this.availableQuantity) || other.availableQuantity == _this.availableQuantity));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as Variant;
  return Object.hash(runtimeType,_this.id,_this.sku,const DeepCollectionEquality().hash(_this.optionValues),_this.priceLkrMinor,_this.originalPriceLkrMinor,_this.availableQuantity);
}

@override
String toString() {
  final _this = this as Variant;
  return 'Variant(id: ${_this.id}, sku: ${_this.sku}, optionValues: ${_this.optionValues}, priceLkrMinor: ${_this.priceLkrMinor}, originalPriceLkrMinor: ${_this.originalPriceLkrMinor}, availableQuantity: ${_this.availableQuantity})';
}


}

/// @nodoc
abstract mixin class $VariantCopyWith<$Res>  {
  factory $VariantCopyWith(Variant value, $Res Function(Variant) _then) = _$VariantCopyWithImpl;
@useResult
$Res call({
 String id, String sku, Map<String, String> optionValues, int priceLkrMinor, int? originalPriceLkrMinor, int availableQuantity
});




}
/// @nodoc
class _$VariantCopyWithImpl<$Res>
    implements $VariantCopyWith<$Res> {
  _$VariantCopyWithImpl(this._self, this._then);

  final Variant _self;
  final $Res Function(Variant) _then;

/// Create a copy of Variant
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? sku = null,Object? optionValues = null,Object? priceLkrMinor = null,Object? originalPriceLkrMinor = freezed,Object? availableQuantity = null,}) {
  return _then(Variant(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,sku: null == sku ? _self.sku : sku // ignore: cast_nullable_to_non_nullable
as String,optionValues: null == optionValues ? _self.optionValues : optionValues // ignore: cast_nullable_to_non_nullable
as Map<String, String>,priceLkrMinor: null == priceLkrMinor ? _self.priceLkrMinor : priceLkrMinor // ignore: cast_nullable_to_non_nullable
as int,originalPriceLkrMinor: freezed == originalPriceLkrMinor ? _self.originalPriceLkrMinor : originalPriceLkrMinor // ignore: cast_nullable_to_non_nullable
as int?,availableQuantity: null == availableQuantity ? _self.availableQuantity : availableQuantity // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [Variant].
extension VariantPatterns on Variant {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Variant value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Variant() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Variant value)  $default,){
final _that = this;
switch (_that) {
case _Variant():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Variant value)?  $default,){
final _that = this;
switch (_that) {
case _Variant() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String sku,  Map<String, String> optionValues,  int priceLkrMinor,  int? originalPriceLkrMinor,  int availableQuantity)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Variant() when $default != null:
return $default(_that.id,_that.sku,_that.optionValues,_that.priceLkrMinor,_that.originalPriceLkrMinor,_that.availableQuantity);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String sku,  Map<String, String> optionValues,  int priceLkrMinor,  int? originalPriceLkrMinor,  int availableQuantity)  $default,) {final _that = this;
switch (_that) {
case _Variant():
return $default(_that.id,_that.sku,_that.optionValues,_that.priceLkrMinor,_that.originalPriceLkrMinor,_that.availableQuantity);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String sku,  Map<String, String> optionValues,  int priceLkrMinor,  int? originalPriceLkrMinor,  int availableQuantity)?  $default,) {final _that = this;
switch (_that) {
case _Variant() when $default != null:
return $default(_that.id,_that.sku,_that.optionValues,_that.priceLkrMinor,_that.originalPriceLkrMinor,_that.availableQuantity);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _Variant extends Variant {
  const _Variant({required this.id, this.sku = '',  Map<String, String> optionValues = const {}, this.priceLkrMinor = 0, this.originalPriceLkrMinor, this.availableQuantity = 0}): _optionValues = optionValues,super._();
  factory _Variant.fromJson(Map<String, dynamic> json) => _$VariantFromJson(json);

@override final  String id;
@override@JsonKey() final  String sku;
 final  Map<String, String> _optionValues;
@override@JsonKey() Map<String, String> get optionValues {
  if (_optionValues is EqualUnmodifiableMapView) return _optionValues;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(_optionValues);
}

@override@JsonKey() final  int priceLkrMinor;
@override final  int? originalPriceLkrMinor;
@override@JsonKey() final  int availableQuantity;

/// Create a copy of Variant
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$VariantCopyWith<_Variant> get copyWith => __$VariantCopyWithImpl<_Variant>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$VariantToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _Variant&&(identical(other.id, id) || other.id == id)&&(identical(other.sku, sku) || other.sku == sku)&&const DeepCollectionEquality().equals(other.optionValues, _optionValues)&&(identical(other.priceLkrMinor, priceLkrMinor) || other.priceLkrMinor == priceLkrMinor)&&(identical(other.originalPriceLkrMinor, originalPriceLkrMinor) || other.originalPriceLkrMinor == originalPriceLkrMinor)&&(identical(other.availableQuantity, availableQuantity) || other.availableQuantity == availableQuantity));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,id,sku,const DeepCollectionEquality().hash(_optionValues),priceLkrMinor,originalPriceLkrMinor,availableQuantity);
}

@override
String toString() {
    return 'Variant(id: $id, sku: $sku, optionValues: $optionValues, priceLkrMinor: $priceLkrMinor, originalPriceLkrMinor: $originalPriceLkrMinor, availableQuantity: $availableQuantity)';
}


}

/// @nodoc
abstract mixin class _$VariantCopyWith<$Res> implements $VariantCopyWith<$Res> {
  factory _$VariantCopyWith(_Variant value, $Res Function(_Variant) _then) = __$VariantCopyWithImpl;
@override @useResult
$Res call({
 String id, String sku, Map<String, String> optionValues, int priceLkrMinor, int? originalPriceLkrMinor, int availableQuantity
});




}
/// @nodoc
class __$VariantCopyWithImpl<$Res>
    implements _$VariantCopyWith<$Res> {
  __$VariantCopyWithImpl(this._self, this._then);

  final _Variant _self;
  final $Res Function(_Variant) _then;

/// Create a copy of Variant
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? sku = null,Object? optionValues = null,Object? priceLkrMinor = null,Object? originalPriceLkrMinor = freezed,Object? availableQuantity = null,}) {
  return _then(_Variant(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,sku: null == sku ? _self.sku : sku // ignore: cast_nullable_to_non_nullable
as String,optionValues: null == optionValues ? _self._optionValues : optionValues // ignore: cast_nullable_to_non_nullable
as Map<String, String>,priceLkrMinor: null == priceLkrMinor ? _self.priceLkrMinor : priceLkrMinor // ignore: cast_nullable_to_non_nullable
as int,originalPriceLkrMinor: freezed == originalPriceLkrMinor ? _self.originalPriceLkrMinor : originalPriceLkrMinor // ignore: cast_nullable_to_non_nullable
as int?,availableQuantity: null == availableQuantity ? _self.availableQuantity : availableQuantity // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}


/// @nodoc
mixin _$BuyerAddress {

 String get id; String get recipient; String get phone; String get line1; String? get line2; String get city; String get district; String get postalCode;
/// Create a copy of BuyerAddress
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$BuyerAddressCopyWith<BuyerAddress> get copyWith => _$BuyerAddressCopyWithImpl<BuyerAddress>(this as BuyerAddress, _$identity);

  /// Serializes this BuyerAddress to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as BuyerAddress;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is BuyerAddress&&(identical(other.id, _this.id) || other.id == _this.id)&&(identical(other.recipient, _this.recipient) || other.recipient == _this.recipient)&&(identical(other.phone, _this.phone) || other.phone == _this.phone)&&(identical(other.line1, _this.line1) || other.line1 == _this.line1)&&(identical(other.line2, _this.line2) || other.line2 == _this.line2)&&(identical(other.city, _this.city) || other.city == _this.city)&&(identical(other.district, _this.district) || other.district == _this.district)&&(identical(other.postalCode, _this.postalCode) || other.postalCode == _this.postalCode));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as BuyerAddress;
  return Object.hash(runtimeType,_this.id,_this.recipient,_this.phone,_this.line1,_this.line2,_this.city,_this.district,_this.postalCode);
}

@override
String toString() {
  final _this = this as BuyerAddress;
  return 'BuyerAddress(id: ${_this.id}, recipient: ${_this.recipient}, phone: ${_this.phone}, line1: ${_this.line1}, line2: ${_this.line2}, city: ${_this.city}, district: ${_this.district}, postalCode: ${_this.postalCode})';
}


}

/// @nodoc
abstract mixin class $BuyerAddressCopyWith<$Res>  {
  factory $BuyerAddressCopyWith(BuyerAddress value, $Res Function(BuyerAddress) _then) = _$BuyerAddressCopyWithImpl;
@useResult
$Res call({
 String id, String recipient, String phone, String line1, String? line2, String city, String district, String postalCode
});




}
/// @nodoc
class _$BuyerAddressCopyWithImpl<$Res>
    implements $BuyerAddressCopyWith<$Res> {
  _$BuyerAddressCopyWithImpl(this._self, this._then);

  final BuyerAddress _self;
  final $Res Function(BuyerAddress) _then;

/// Create a copy of BuyerAddress
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? recipient = null,Object? phone = null,Object? line1 = null,Object? line2 = freezed,Object? city = null,Object? district = null,Object? postalCode = null,}) {
  return _then(BuyerAddress(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,recipient: null == recipient ? _self.recipient : recipient // ignore: cast_nullable_to_non_nullable
as String,phone: null == phone ? _self.phone : phone // ignore: cast_nullable_to_non_nullable
as String,line1: null == line1 ? _self.line1 : line1 // ignore: cast_nullable_to_non_nullable
as String,line2: freezed == line2 ? _self.line2 : line2 // ignore: cast_nullable_to_non_nullable
as String?,city: null == city ? _self.city : city // ignore: cast_nullable_to_non_nullable
as String,district: null == district ? _self.district : district // ignore: cast_nullable_to_non_nullable
as String,postalCode: null == postalCode ? _self.postalCode : postalCode // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [BuyerAddress].
extension BuyerAddressPatterns on BuyerAddress {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _BuyerAddress value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _BuyerAddress() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _BuyerAddress value)  $default,){
final _that = this;
switch (_that) {
case _BuyerAddress():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _BuyerAddress value)?  $default,){
final _that = this;
switch (_that) {
case _BuyerAddress() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String recipient,  String phone,  String line1,  String? line2,  String city,  String district,  String postalCode)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _BuyerAddress() when $default != null:
return $default(_that.id,_that.recipient,_that.phone,_that.line1,_that.line2,_that.city,_that.district,_that.postalCode);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String recipient,  String phone,  String line1,  String? line2,  String city,  String district,  String postalCode)  $default,) {final _that = this;
switch (_that) {
case _BuyerAddress():
return $default(_that.id,_that.recipient,_that.phone,_that.line1,_that.line2,_that.city,_that.district,_that.postalCode);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String recipient,  String phone,  String line1,  String? line2,  String city,  String district,  String postalCode)?  $default,) {final _that = this;
switch (_that) {
case _BuyerAddress() when $default != null:
return $default(_that.id,_that.recipient,_that.phone,_that.line1,_that.line2,_that.city,_that.district,_that.postalCode);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _BuyerAddress extends BuyerAddress {
  const _BuyerAddress({required this.id, required this.recipient, required this.phone, required this.line1, this.line2, required this.city, required this.district, required this.postalCode}): super._();
  factory _BuyerAddress.fromJson(Map<String, dynamic> json) => _$BuyerAddressFromJson(json);

@override final  String id;
@override final  String recipient;
@override final  String phone;
@override final  String line1;
@override final  String? line2;
@override final  String city;
@override final  String district;
@override final  String postalCode;

/// Create a copy of BuyerAddress
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$BuyerAddressCopyWith<_BuyerAddress> get copyWith => __$BuyerAddressCopyWithImpl<_BuyerAddress>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$BuyerAddressToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _BuyerAddress&&(identical(other.id, id) || other.id == id)&&(identical(other.recipient, recipient) || other.recipient == recipient)&&(identical(other.phone, phone) || other.phone == phone)&&(identical(other.line1, line1) || other.line1 == line1)&&(identical(other.line2, line2) || other.line2 == line2)&&(identical(other.city, city) || other.city == city)&&(identical(other.district, district) || other.district == district)&&(identical(other.postalCode, postalCode) || other.postalCode == postalCode));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,id,recipient,phone,line1,line2,city,district,postalCode);
}

@override
String toString() {
    return 'BuyerAddress(id: $id, recipient: $recipient, phone: $phone, line1: $line1, line2: $line2, city: $city, district: $district, postalCode: $postalCode)';
}


}

/// @nodoc
abstract mixin class _$BuyerAddressCopyWith<$Res> implements $BuyerAddressCopyWith<$Res> {
  factory _$BuyerAddressCopyWith(_BuyerAddress value, $Res Function(_BuyerAddress) _then) = __$BuyerAddressCopyWithImpl;
@override @useResult
$Res call({
 String id, String recipient, String phone, String line1, String? line2, String city, String district, String postalCode
});




}
/// @nodoc
class __$BuyerAddressCopyWithImpl<$Res>
    implements _$BuyerAddressCopyWith<$Res> {
  __$BuyerAddressCopyWithImpl(this._self, this._then);

  final _BuyerAddress _self;
  final $Res Function(_BuyerAddress) _then;

/// Create a copy of BuyerAddress
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? recipient = null,Object? phone = null,Object? line1 = null,Object? line2 = freezed,Object? city = null,Object? district = null,Object? postalCode = null,}) {
  return _then(_BuyerAddress(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,recipient: null == recipient ? _self.recipient : recipient // ignore: cast_nullable_to_non_nullable
as String,phone: null == phone ? _self.phone : phone // ignore: cast_nullable_to_non_nullable
as String,line1: null == line1 ? _self.line1 : line1 // ignore: cast_nullable_to_non_nullable
as String,line2: freezed == line2 ? _self.line2 : line2 // ignore: cast_nullable_to_non_nullable
as String?,city: null == city ? _self.city : city // ignore: cast_nullable_to_non_nullable
as String,district: null == district ? _self.district : district // ignore: cast_nullable_to_non_nullable
as String,postalCode: null == postalCode ? _self.postalCode : postalCode // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$CartData {

 List<Json> get items; int get subtotalLkrMinor; int get shippingLkrMinor; int get totalLkrMinor; bool get canCheckout; String? get checkoutQuote; String? get addressId; bool get deliveryQuoted; List<Json> get deliveryBySeller;
/// Create a copy of CartData
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CartDataCopyWith<CartData> get copyWith => _$CartDataCopyWithImpl<CartData>(this as CartData, _$identity);

  /// Serializes this CartData to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as CartData;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CartData&&const DeepCollectionEquality().equals(other.items, _this.items)&&(identical(other.subtotalLkrMinor, _this.subtotalLkrMinor) || other.subtotalLkrMinor == _this.subtotalLkrMinor)&&(identical(other.shippingLkrMinor, _this.shippingLkrMinor) || other.shippingLkrMinor == _this.shippingLkrMinor)&&(identical(other.totalLkrMinor, _this.totalLkrMinor) || other.totalLkrMinor == _this.totalLkrMinor)&&(identical(other.canCheckout, _this.canCheckout) || other.canCheckout == _this.canCheckout)&&(identical(other.checkoutQuote, _this.checkoutQuote) || other.checkoutQuote == _this.checkoutQuote)&&(identical(other.addressId, _this.addressId) || other.addressId == _this.addressId)&&(identical(other.deliveryQuoted, _this.deliveryQuoted) || other.deliveryQuoted == _this.deliveryQuoted)&&const DeepCollectionEquality().equals(other.deliveryBySeller, _this.deliveryBySeller));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as CartData;
  return Object.hash(runtimeType,const DeepCollectionEquality().hash(_this.items),_this.subtotalLkrMinor,_this.shippingLkrMinor,_this.totalLkrMinor,_this.canCheckout,_this.checkoutQuote,_this.addressId,_this.deliveryQuoted,const DeepCollectionEquality().hash(_this.deliveryBySeller));
}

@override
String toString() {
  final _this = this as CartData;
  return 'CartData(items: ${_this.items}, subtotalLkrMinor: ${_this.subtotalLkrMinor}, shippingLkrMinor: ${_this.shippingLkrMinor}, totalLkrMinor: ${_this.totalLkrMinor}, canCheckout: ${_this.canCheckout}, checkoutQuote: ${_this.checkoutQuote}, addressId: ${_this.addressId}, deliveryQuoted: ${_this.deliveryQuoted}, deliveryBySeller: ${_this.deliveryBySeller})';
}


}

/// @nodoc
abstract mixin class $CartDataCopyWith<$Res>  {
  factory $CartDataCopyWith(CartData value, $Res Function(CartData) _then) = _$CartDataCopyWithImpl;
@useResult
$Res call({
 List<Json> items, int subtotalLkrMinor, int shippingLkrMinor, int totalLkrMinor, bool canCheckout, String? checkoutQuote, String? addressId, bool deliveryQuoted, List<Json> deliveryBySeller
});




}
/// @nodoc
class _$CartDataCopyWithImpl<$Res>
    implements $CartDataCopyWith<$Res> {
  _$CartDataCopyWithImpl(this._self, this._then);

  final CartData _self;
  final $Res Function(CartData) _then;

/// Create a copy of CartData
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? items = null,Object? subtotalLkrMinor = null,Object? shippingLkrMinor = null,Object? totalLkrMinor = null,Object? canCheckout = null,Object? checkoutQuote = freezed,Object? addressId = freezed,Object? deliveryQuoted = null,Object? deliveryBySeller = null,}) {
  return _then(CartData(
items: null == items ? _self.items : items // ignore: cast_nullable_to_non_nullable
as List<Json>,subtotalLkrMinor: null == subtotalLkrMinor ? _self.subtotalLkrMinor : subtotalLkrMinor // ignore: cast_nullable_to_non_nullable
as int,shippingLkrMinor: null == shippingLkrMinor ? _self.shippingLkrMinor : shippingLkrMinor // ignore: cast_nullable_to_non_nullable
as int,totalLkrMinor: null == totalLkrMinor ? _self.totalLkrMinor : totalLkrMinor // ignore: cast_nullable_to_non_nullable
as int,canCheckout: null == canCheckout ? _self.canCheckout : canCheckout // ignore: cast_nullable_to_non_nullable
as bool,checkoutQuote: freezed == checkoutQuote ? _self.checkoutQuote : checkoutQuote // ignore: cast_nullable_to_non_nullable
as String?,addressId: freezed == addressId ? _self.addressId : addressId // ignore: cast_nullable_to_non_nullable
as String?,deliveryQuoted: null == deliveryQuoted ? _self.deliveryQuoted : deliveryQuoted // ignore: cast_nullable_to_non_nullable
as bool,deliveryBySeller: null == deliveryBySeller ? _self.deliveryBySeller : deliveryBySeller // ignore: cast_nullable_to_non_nullable
as List<Json>,
  ));
}

}


/// Adds pattern-matching-related methods to [CartData].
extension CartDataPatterns on CartData {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CartData value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CartData() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CartData value)  $default,){
final _that = this;
switch (_that) {
case _CartData():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CartData value)?  $default,){
final _that = this;
switch (_that) {
case _CartData() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<Json> items,  int subtotalLkrMinor,  int shippingLkrMinor,  int totalLkrMinor,  bool canCheckout,  String? checkoutQuote,  String? addressId,  bool deliveryQuoted,  List<Json> deliveryBySeller)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CartData() when $default != null:
return $default(_that.items,_that.subtotalLkrMinor,_that.shippingLkrMinor,_that.totalLkrMinor,_that.canCheckout,_that.checkoutQuote,_that.addressId,_that.deliveryQuoted,_that.deliveryBySeller);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<Json> items,  int subtotalLkrMinor,  int shippingLkrMinor,  int totalLkrMinor,  bool canCheckout,  String? checkoutQuote,  String? addressId,  bool deliveryQuoted,  List<Json> deliveryBySeller)  $default,) {final _that = this;
switch (_that) {
case _CartData():
return $default(_that.items,_that.subtotalLkrMinor,_that.shippingLkrMinor,_that.totalLkrMinor,_that.canCheckout,_that.checkoutQuote,_that.addressId,_that.deliveryQuoted,_that.deliveryBySeller);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<Json> items,  int subtotalLkrMinor,  int shippingLkrMinor,  int totalLkrMinor,  bool canCheckout,  String? checkoutQuote,  String? addressId,  bool deliveryQuoted,  List<Json> deliveryBySeller)?  $default,) {final _that = this;
switch (_that) {
case _CartData() when $default != null:
return $default(_that.items,_that.subtotalLkrMinor,_that.shippingLkrMinor,_that.totalLkrMinor,_that.canCheckout,_that.checkoutQuote,_that.addressId,_that.deliveryQuoted,_that.deliveryBySeller);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _CartData extends CartData {
  const _CartData({ List<Json> items = const [], this.subtotalLkrMinor = 0, this.shippingLkrMinor = 0, this.totalLkrMinor = 0, this.canCheckout = false, this.checkoutQuote, this.addressId, this.deliveryQuoted = false,  List<Json> deliveryBySeller = const []}): _items = items,_deliveryBySeller = deliveryBySeller,super._();
  factory _CartData.fromJson(Map<String, dynamic> json) => _$CartDataFromJson(json);

 final  List<Json> _items;
@override@JsonKey() List<Json> get items {
  if (_items is EqualUnmodifiableListView) return _items;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_items);
}

@override@JsonKey() final  int subtotalLkrMinor;
@override@JsonKey() final  int shippingLkrMinor;
@override@JsonKey() final  int totalLkrMinor;
@override@JsonKey() final  bool canCheckout;
@override final  String? checkoutQuote;
@override final  String? addressId;
@override@JsonKey() final  bool deliveryQuoted;
 final  List<Json> _deliveryBySeller;
@override@JsonKey() List<Json> get deliveryBySeller {
  if (_deliveryBySeller is EqualUnmodifiableListView) return _deliveryBySeller;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_deliveryBySeller);
}


/// Create a copy of CartData
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CartDataCopyWith<_CartData> get copyWith => __$CartDataCopyWithImpl<_CartData>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CartDataToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _CartData&&const DeepCollectionEquality().equals(other.items, _items)&&(identical(other.subtotalLkrMinor, subtotalLkrMinor) || other.subtotalLkrMinor == subtotalLkrMinor)&&(identical(other.shippingLkrMinor, shippingLkrMinor) || other.shippingLkrMinor == shippingLkrMinor)&&(identical(other.totalLkrMinor, totalLkrMinor) || other.totalLkrMinor == totalLkrMinor)&&(identical(other.canCheckout, canCheckout) || other.canCheckout == canCheckout)&&(identical(other.checkoutQuote, checkoutQuote) || other.checkoutQuote == checkoutQuote)&&(identical(other.addressId, addressId) || other.addressId == addressId)&&(identical(other.deliveryQuoted, deliveryQuoted) || other.deliveryQuoted == deliveryQuoted)&&const DeepCollectionEquality().equals(other.deliveryBySeller, _deliveryBySeller));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,const DeepCollectionEquality().hash(_items),subtotalLkrMinor,shippingLkrMinor,totalLkrMinor,canCheckout,checkoutQuote,addressId,deliveryQuoted,const DeepCollectionEquality().hash(_deliveryBySeller));
}

@override
String toString() {
    return 'CartData(items: $items, subtotalLkrMinor: $subtotalLkrMinor, shippingLkrMinor: $shippingLkrMinor, totalLkrMinor: $totalLkrMinor, canCheckout: $canCheckout, checkoutQuote: $checkoutQuote, addressId: $addressId, deliveryQuoted: $deliveryQuoted, deliveryBySeller: $deliveryBySeller)';
}


}

/// @nodoc
abstract mixin class _$CartDataCopyWith<$Res> implements $CartDataCopyWith<$Res> {
  factory _$CartDataCopyWith(_CartData value, $Res Function(_CartData) _then) = __$CartDataCopyWithImpl;
@override @useResult
$Res call({
 List<Json> items, int subtotalLkrMinor, int shippingLkrMinor, int totalLkrMinor, bool canCheckout, String? checkoutQuote, String? addressId, bool deliveryQuoted, List<Json> deliveryBySeller
});




}
/// @nodoc
class __$CartDataCopyWithImpl<$Res>
    implements _$CartDataCopyWith<$Res> {
  __$CartDataCopyWithImpl(this._self, this._then);

  final _CartData _self;
  final $Res Function(_CartData) _then;

/// Create a copy of CartData
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? items = null,Object? subtotalLkrMinor = null,Object? shippingLkrMinor = null,Object? totalLkrMinor = null,Object? canCheckout = null,Object? checkoutQuote = freezed,Object? addressId = freezed,Object? deliveryQuoted = null,Object? deliveryBySeller = null,}) {
  return _then(_CartData(
items: null == items ? _self._items : items // ignore: cast_nullable_to_non_nullable
as List<Json>,subtotalLkrMinor: null == subtotalLkrMinor ? _self.subtotalLkrMinor : subtotalLkrMinor // ignore: cast_nullable_to_non_nullable
as int,shippingLkrMinor: null == shippingLkrMinor ? _self.shippingLkrMinor : shippingLkrMinor // ignore: cast_nullable_to_non_nullable
as int,totalLkrMinor: null == totalLkrMinor ? _self.totalLkrMinor : totalLkrMinor // ignore: cast_nullable_to_non_nullable
as int,canCheckout: null == canCheckout ? _self.canCheckout : canCheckout // ignore: cast_nullable_to_non_nullable
as bool,checkoutQuote: freezed == checkoutQuote ? _self.checkoutQuote : checkoutQuote // ignore: cast_nullable_to_non_nullable
as String?,addressId: freezed == addressId ? _self.addressId : addressId // ignore: cast_nullable_to_non_nullable
as String?,deliveryQuoted: null == deliveryQuoted ? _self.deliveryQuoted : deliveryQuoted // ignore: cast_nullable_to_non_nullable
as bool,deliveryBySeller: null == deliveryBySeller ? _self._deliveryBySeller : deliveryBySeller // ignore: cast_nullable_to_non_nullable
as List<Json>,
  ));
}


}

// dart format on
