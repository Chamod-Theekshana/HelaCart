import 'package:dio/dio.dart';

import 'json.dart';
import 'models.dart';
import '../network/api_client.dart';

abstract class BuyerRepository {
  Future<Object?> read(String path, {bool private = false});
  Future<Object?> write(String path, String method, [Object? data]);
  Future<List<Json>> categories();
  Future<PageData<Product>> products(String query);
  Future<Product> product(String id);
  Future<CartData> cart([String? addressId]);
  Future<List<BuyerAddress>> addresses();
}

class ApiBuyerRepository implements BuyerRepository {
  const ApiBuyerRepository(this.api);
  final ApiClient api;
  @override
  Future<Object?> read(String path, {bool private = false}) =>
      api.request(path, private: private);
  @override
  Future<Object?> write(String path, String method, [Object? data]) =>
      api.request(path, method: method, data: data, private: true);
  @override
  Future<List<Json>> categories() async => objects(await read('/categories'));
  @override
  Future<PageData<Product>> products(String query) async => PageData.fromJson(
    await read('/catalog/products?$query'),
    Product.fromJson,
  );
  @override
  Future<Product> product(String id) async => Product.fromJson(
    object(await read('/products/${Uri.encodeComponent(id)}')),
  );
  @override
  Future<CartData> cart([String? addressId]) async => CartData.fromJson(
    object(
      await read(
        '/me/cart${addressId == null ? '' : '?addressId=${Uri.encodeQueryComponent(addressId)}'}',
        private: true,
      ),
    ),
  );
  @override
  Future<List<BuyerAddress>> addresses() async =>
      objects(await read('/me/addresses', private: true))
          .map(BuyerAddress.fromJson)
          .toList();
}

Future<MultipartFile> photoPart(String path, List<int> bytes) async {
  if (bytes.isEmpty) {
    throw const AppFailure('This photo is empty. Choose another image.');
  }
  final jpeg = bytes.length > 2 && bytes[0] == 0xff && bytes[1] == 0xd8;
  final png = bytes.length > 8 && bytes[0] == 0x89 && bytes[1] == 0x50;
  final webp =
      bytes.length > 12 &&
      String.fromCharCodes(bytes.sublist(0, 4)) == 'RIFF' &&
      String.fromCharCodes(bytes.sublist(8, 12)) == 'WEBP';
  if (!jpeg && !png && !webp) {
    throw const AppFailure('Choose a JPEG, PNG or WebP photo.');
  }
  final extension = jpeg
      ? 'jpg'
      : png
      ? 'png'
      : 'webp';
  return MultipartFile.fromBytes(
    bytes,
    filename: 'photo.$extension',
    contentType: DioMediaType('image', jpeg ? 'jpeg' : extension),
  );
}
