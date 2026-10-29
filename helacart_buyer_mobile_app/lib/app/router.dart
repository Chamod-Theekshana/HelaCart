import 'dart:async';

import 'package:shared_preferences/shared_preferences.dart';

import 'hc.dart';
import '../core/ui/buyer_navigation.dart';
import '../features/account/presentation/account_screen.dart';
import '../features/account/presentation/addresses_screen.dart';
import '../features/account/presentation/help_screen.dart';
import '../features/after_sales/presentation/returns_screen.dart';
import '../features/auth/presentation/auth_screen.dart';
import '../features/cart/presentation/cart_screen.dart';
import '../features/catalog/presentation/catalog_screen.dart';
import '../features/catalog/presentation/home_screen.dart';
import '../features/catalog/presentation/product_details_screen.dart';
import '../features/catalog/presentation/search_screen.dart';
import '../features/checkout/presentation/checkout_screen.dart';
import '../features/favorites/presentation/favorites_screen.dart';
import '../features/notifications/presentation/notifications_screen.dart';
import '../features/orders/presentation/orders_screen.dart';
import '../features/reviews/presentation/reviews_screen.dart';
import '../features/shops/presentation/shops_screen.dart';
import '../features/support/presentation/support_screen.dart';

final initialLocationProvider = Provider<String>((ref) => '/');
final routerProvider = Provider<GoRouter>((ref) {
  final router = GoRouter(
    initialLocation: ref.read(initialLocationProvider),
    routes: [
      StatefulShellRoute.indexedStack(
        builder: (c, s, navigation) => BuyerShell(navigation: navigation),
        branches: [
          StatefulShellBranch(
            routes: [GoRoute(path: '/', builder: (c, s) => const HomeScreen())],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/categories',
                builder: (c, s) => const CategoriesScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: '/cart', builder: (c, s) => const CartScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/favorites',
                builder: (c, s) => const FavoritesScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: '/orders', builder: (c, s) => const OrdersScreen()),
            ],
          ),
        ],
      ),
      GoRoute(path: '/welcome', builder: (c, s) => const FirstVisitScreen()),
      GoRoute(
        path: '/auth',
        builder: (c, s) => AuthScreen(
          next: s.uri.queryParameters['next'],
          favorite: s.uri.queryParameters['favorite'],
        ),
      ),
      GoRoute(
        path: '/auth/:mode',
        builder: (c, s) => AuthScreen(
          mode: s.pathParameters['mode']!,
          next: s.uri.queryParameters['next'],
          favorite: s.uri.queryParameters['favorite'],
        ),
      ),
      GoRoute(
        path: '/verify',
        builder: (c, s) =>
            VerifyEmailScreen(next: s.uri.queryParameters['next']),
      ),
      GoRoute(
        path: '/products',
        builder: (c, s) => CatalogScreen(
          key: ValueKey(s.uri.toString()),
          initial: cleanCatalogQuery(s.uri.queryParameters),
          openFilters: s.uri.queryParameters['filters'] == 'true',
        ),
      ),
      GoRoute(
        path: '/offers',
        builder: (c, s) =>
            const CatalogScreen(initial: {'deals': 'true', 'sort': 'newest'}),
      ),
      GoRoute(path: '/search', builder: (c, s) => const SearchScreen()),
      GoRoute(
        path: '/products/:id',
        builder: (c, s) => ProductDetailsScreen(id: s.pathParameters['id']!),
      ),
      GoRoute(
        path: '/products/:id/reviews',
        builder: (c, s) => ReviewsScreen(id: s.pathParameters['id']!),
      ),
      GoRoute(
        path: '/gallery/:id',
        builder: (c, s) => ProductGalleryScreen(
          id: s.pathParameters['id']!,
          initial: int.tryParse(s.uri.queryParameters['image'] ?? '') ?? 0,
        ),
      ),
      GoRoute(path: '/shops', builder: (c, s) => const ShopsScreen()),
      GoRoute(
        path: '/shops/:slug',
        builder: (c, s) => ShopProfileScreen(slug: s.pathParameters['slug']!),
      ),
      GoRoute(
        path: '/shops/:slug/products',
        builder: (c, s) => CatalogScreen(
          shopSlug: s.pathParameters['slug']!,
          initial: cleanCatalogQuery(s.uri.queryParameters, shop: true),
        ),
      ),
      GoRoute(
        path: '/shops/:slug/reviews',
        builder: (c, s) =>
            ReviewsScreen(id: s.pathParameters['slug']!, shop: true),
      ),
      GoRoute(
        path: '/review-photo',
        builder: (c, s) {
          final path = s.uri.queryParameters['path'] ?? '';
          return RegExp(r'^/shops/[^/]+/reviews/[a-f0-9-]+/photos/[a-f0-9-]+$')
                  .hasMatch(path)
              ? ReviewPhotoScreen(path: path)
              : const PageFrame(
                  title: 'Photo unavailable',
                  child: EmptyState(
                    title: 'This photo is unavailable',
                    message: 'Open a photo from a published shop review.',
                  ),
                );
        },
      ),
      GoRoute(path: '/account', builder: (c, s) => const AccountScreen()),
      GoRoute(path: '/checkout', builder: (c, s) => const CheckoutScreen()),
      GoRoute(
        path: '/order-success/:id',
        builder: (c, s) => OrderSuccessScreen(id: s.pathParameters['id']!),
      ),
      GoRoute(
        path: '/orders/:id',
        builder: (c, s) => OrderDetailsScreen(id: s.pathParameters['id']!),
      ),
      GoRoute(
        path: '/orders/:id/tracking/:package',
        builder: (c, s) => OrderDetailsScreen(
          id: s.pathParameters['id']!,
          packageId: s.pathParameters['package'],
        ),
      ),
      GoRoute(path: '/returns', builder: (c, s) => const AfterSalesScreen()),
      GoRoute(
        path: '/refunds',
        builder: (c, s) => const AfterSalesScreen(refunds: true),
      ),
      GoRoute(
        path: '/returns/new/:package',
        builder: (c, s) =>
            ReturnRequestScreen(packageId: s.pathParameters['package']!),
      ),
      GoRoute(path: '/support', builder: (c, s) => const SupportScreen()),
      GoRoute(
        path: '/support/new',
        builder: (c, s) =>
            NewSupportScreen(order: s.uri.queryParameters['order']),
      ),
      GoRoute(
        path: '/support/:id',
        builder: (c, s) =>
            SupportConversationScreen(id: s.pathParameters['id']!),
      ),
      GoRoute(
        path: '/account/profile',
        builder: (c, s) => const ProfileScreen(),
      ),
      GoRoute(
        path: '/account/addresses',
        builder: (c, s) => const AddressesScreen(),
      ),
      GoRoute(
        path: '/account/addresses/new',
        builder: (c, s) => const AddAddressScreen(),
      ),
      GoRoute(
        path: '/account/security',
        builder: (c, s) => const SecurityScreen(),
      ),
      GoRoute(
        path: '/account/security/password',
        builder: (c, s) => const SecurityFormScreen(),
      ),
      GoRoute(
        path: '/account/security/email',
        builder: (c, s) => const SecurityFormScreen(email: true),
      ),
      GoRoute(
        path: '/account/reviews',
        builder: (c, s) => const MyReviewsScreen(),
      ),
      GoRoute(
        path: '/notifications',
        builder: (c, s) => const NotificationsScreen(),
      ),
      GoRoute(path: '/help', builder: (c, s) => const HelpScreen()),
    ],
    errorBuilder: (c, s) => PageFrame(
      title: 'Page unavailable',
      child: EmptyState(
        title: 'Let’s find your way back',
        message: 'This destination is not available in the buyer app.',
        action: FilledButton(
          onPressed: () => c.go('/'),
          child: const Text('Back to Home'),
        ),
      ),
    ),
  );
  ref.onDispose(router.dispose);
  return router;
});
Map<String, String> cleanCatalogQuery(
  Map<String, String> query, {
  bool shop = false,
}) {
  final result = <String, String>{};
  for (final entry in query.entries) {
    if (['q', 'category'].contains(entry.key) && entry.value.isNotEmpty) {
      result[entry.key] = entry.value.substring(
        0,
        entry.value.length.clamp(0, 80),
      );
    }
    if (['minPrice', 'maxPrice'].contains(entry.key)) {
      final value = int.tryParse(entry.value);
      if (value != null && value >= 0 && value <= 1000000000) {
        result[entry.key] = '$value';
      }
    }
    if (!shop &&
        ['deals', 'inStock'].contains(entry.key) &&
        entry.value == 'true') {
      result[entry.key] = 'true';
    }
    if (entry.key == 'sort' &&
        [
          'newest',
          'price-asc',
          'price-desc',
          'name',
          if (!shop) 'relevance',
        ].contains(entry.value)) {
      result['sort'] = entry.value;
    }
  }
  result.putIfAbsent(
    'sort',
    () => result['q'] != null && !shop ? 'relevance' : 'newest',
  );
  return result;
}

class BuyerShell extends ConsumerStatefulWidget {
  const BuyerShell({super.key, required this.navigation});
  final StatefulNavigationShell navigation;
  @override
  ConsumerState<BuyerShell> createState() => _BuyerShellState();
}

class _BuyerShellState extends ConsumerState<BuyerShell> {
  Timer? timer;
  bool foreground = true;
  late final AppLifecycleListener lifecycle;
  @override
  void initState() {
    super.initState();
    lifecycle = AppLifecycleListener(
      onStateChange: (state) {
        foreground = state == AppLifecycleState.resumed;
        if (foreground && mounted) {
          ref.invalidate(
            resourceProvider((path: '/me/notifications/inbox', private: true)),
          );
          ref.invalidate(cartProvider);
        }
      },
    );
    timer = Timer.periodic(const Duration(seconds: 60), (_) {
      if (mounted && foreground && ref.read(sessionProvider).value != null) {
        ref.invalidate(
          resourceProvider((path: '/me/notifications/inbox', private: true)),
        );
      }
    });
  }

  @override
  void dispose() {
    timer?.cancel();
    lifecycle.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    drawer: const BuyerAccountDrawer(),
    body: Builder(
      builder: (shellContext) => BuyerAccountMenuScope(
        open: () => Scaffold.of(shellContext).openDrawer(),
        child: widget.navigation,
      ),
    ),
    bottomNavigationBar: BuyerNavigationBar(
      selectedIndex: widget.navigation.currentIndex,
      bagCount: ref.watch(cartProvider).value?.count ?? 0,
      onSelected: (i) => widget.navigation.goBranch(
        i,
        initialLocation: i == widget.navigation.currentIndex,
      ),
    ),
  );
}

class FirstVisitScreen extends StatelessWidget {
  const FirstVisitScreen({super.key});
  @override
  Widget build(BuildContext context) => PageFrame(
    title: 'Welcome to HelaCart',
    child: ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const Brand(),
        verticalGap(24),
        ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: Image.asset(
            'assets/images/hero.jpg',
            height: 260,
            fit: BoxFit.cover,
          ),
        ),
        verticalGap(28),
        Text(
          'Good finds.\nLocal roots.',
          style: Theme.of(context).textTheme.headlineLarge,
        ),
        verticalGap(),
        const Text(
          'Discover everyday favourites from independent shops across Sri Lanka. Pay when your order arrives.',
        ),
        verticalGap(28),
        ActionButton(
          label: 'Start exploring',
          action: () async {
            await SharedPreferencesAsync().setBool('helacart.welcomed', true);
            if (context.mounted) context.go('/');
          },
        ),
        TextButton(
          onPressed: () => context.go('/'),
          child: const Text('Skip for now'),
        ),
        TextButton(
          onPressed: () => context.push('/auth'),
          child: const Text('Sign in'),
        ),
      ],
    ),
  );
}
