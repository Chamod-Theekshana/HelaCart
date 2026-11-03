import 'dart:io';

import 'package:dio/dio.dart';
import 'package:helacart_buyer_mobile_app/core/data/buyer_repository.dart';
import 'package:helacart_buyer_mobile_app/core/data/json.dart';
import 'package:helacart_buyer_mobile_app/core/data/models.dart';
import 'package:helacart_buyer_mobile_app/core/network/api_client.dart';

/// Read-only contract smoke check. Never authenticates or writes customer data.
Future<void> main(List<String> args) async {
  final base = args.firstOrNull ?? 'http://localhost:4000/api/v1';
  final dio = Dio(
    BaseOptions(
      baseUrl: base,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 45),
    ),
  );
  final api = ApiClient(dio, token: (_) async => null, identity: () => null);
  final repo = ApiBuyerRepository(api);
  var checks = 0;
  try {
    final categories = await repo.categories();
    checks++;
    stdout.writeln('Categories: ${categories.length}');
    final page = await repo.products('limit=2&sort=newest');
    checks++;
    stdout.writeln('Catalog models: ${page.items.length}');
    if (page.items.isNotEmpty) {
      final detail = await repo.product(page.items.first.id);
      if (detail.id != page.items.first.id) {
        throw StateError('Product identity mismatch');
      }
      checks++;
      final reviews = object(
        await repo.read('/products/${detail.id}/customer-reviews'),
      );
      if (reviews['summary'] is! Map) {
        throw StateError('Review summary missing');
      }
      checks++;
      final recommendations = object(
        await repo.read(
          '/discovery/recommendations?productId=${detail.id}&limit=2',
        ),
      );
      for (final row in objects(recommendations['items'])) {
        Product.fromJson(row);
      }
      checks++;
    }
    final shops = object(await repo.read('/shops?limit=1'));
    checks++;
    for (final row in objects(shops['items'])) {
      final slug = Uri.encodeComponent(string(row['slug']));
      await repo.read('/shops/$slug');
      final products = object(await repo.read('/shops/$slug/products?limit=2'));
      for (final p in objects(products['items'])) {
        Product.fromJson(p);
      }
      checks += 2;
    }
    try {
      await dio.get<Object?>('/me/cart');
      throw StateError('Anonymous cart access succeeded');
    } on DioException catch (e) {
      if (e.response?.statusCode != 401) rethrow;
      checks++;
    }
    stdout.writeln(
      'PASS: $checks read-only contract checks; no customer writes.',
    );
  } catch (e) {
    stderr.writeln(
      'Contract check failed: ${e is AppFailure ? e.message : e.runtimeType}',
    );
    exitCode = 1;
  } finally {
    dio.close();
  }
}
