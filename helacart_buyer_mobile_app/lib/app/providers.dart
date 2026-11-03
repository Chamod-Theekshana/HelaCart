import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/data/buyer_repository.dart';
import '../core/data/json.dart';
import '../core/data/models.dart';
import '../core/data/preview_repository.dart';
import '../core/network/api_client.dart';
import '../features/auth/data/auth_service.dart';
import 'config.dart';

final configProvider = Provider<AppConfig>((ref) => AppConfig.environment());
final authServiceProvider = Provider<AuthService>(
  (ref) => throw StateError('Auth service must be initialized at bootstrap.'),
);
final sessionProvider = StreamProvider<BuyerSession?>(
  (ref) => ref
      .watch(authServiceProvider)
      .states
      .distinct(
        (previous, next) =>
            previous?.uid == next?.uid &&
            previous?.email == next?.email &&
            previous?.verified == next?.verified,
      ),
);
final apiProvider = Provider<ApiClient>((ref) {
  final auth = ref.watch(authServiceProvider);
  final dio = Dio(
    BaseOptions(
      baseUrl: ref.watch(configProvider).apiUrl,
      connectTimeout: const Duration(seconds: 15),
      sendTimeout: const Duration(seconds: 30),
      headers: {'Accept': 'application/json'},
    ),
  );
  ref.onDispose(() => dio.close());
  return ApiClient(dio, token: auth.token, identity: () => auth.session?.uid);
});
final repositoryProvider = Provider<BuyerRepository>(
  (ref) => ref.watch(configProvider).preview
      ? PreviewRepository()
      : ApiBuyerRepository(ref.watch(apiProvider)),
);
final categoriesProvider = FutureProvider<List<Json>>(
  (ref) => ref.watch(repositoryProvider).categories(),
  retry: (count, error) => null,
);
final productsProvider = FutureProvider.autoDispose
    .family<PageData<Product>, String>(
      (ref, query) => ref.watch(repositoryProvider).products(query),
      retry: (count, error) => null,
    );
final productProvider = FutureProvider.autoDispose.family<Product, String>(
  (ref, id) => ref.watch(repositoryProvider).product(id),
  retry: (count, error) => null,
);
typedef ResourceKey = ({String path, bool private});
final resourceProvider = FutureProvider.autoDispose
    .family<Object?, ResourceKey>((ref, key) {
      if (key.private) {
        ref.watch(sessionProvider);
      }
      return ref.watch(repositoryProvider).read(key.path, private: key.private);
    }, retry: (count, error) => null);
final cartProvider = FutureProvider.autoDispose<CartData?>((ref) {
  final user = ref.watch(sessionProvider).value;
  return user?.verified == true ? ref.watch(repositoryProvider).cart() : null;
}, retry: (count, error) => null);
final profileProvider = FutureProvider.autoDispose<Json?>((ref) async {
  final user = ref.watch(sessionProvider).value;
  return user == null
      ? null
      : object(
          await ref.watch(repositoryProvider).read('/auth/me', private: true),
        );
}, retry: (count, error) => null);
final favoriteIndexProvider = FutureProvider.autoDispose<Map<String, String>>((
  ref,
) async {
  if (ref.watch(sessionProvider).value == null) return {};
  final data = object(
    await ref
        .watch(repositoryProvider)
        .read('/me/favorites/summary', private: true),
  );
  return {
    for (final row in objects(data['items']))
      if (row['productId'] != null) string(row['productId']): string(row['id']),
  };
}, retry: (count, error) => null);

void refreshBuyer(WidgetRef ref) {
  ref.invalidate(cartProvider);
  ref.invalidate(profileProvider);
  ref.invalidate(favoriteIndexProvider);
  ref.invalidate(resourceProvider);
}
