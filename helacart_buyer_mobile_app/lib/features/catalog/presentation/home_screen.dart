import '../../../app/hc.dart';
import 'product_widgets.dart';
import 'home_widgets.dart';
import '../../../core/ui/buyer_navigation.dart';
import '../../account/presentation/account_screen.dart';

class ShoppingActions extends ConsumerWidget {
  const ShoppingActions({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final count = ref.watch(cartProvider).value?.count ?? 0;
    final user = ref.watch(sessionProvider).value;
    final inbox = user == null
        ? null
        : ref
              .watch(
                resourceProvider((
                  path: '/me/notifications/inbox',
                  private: true,
                )),
              )
              .value;
    final unread = integer(object(inbox)['unreadCount']);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          tooltip: 'Search',
          onPressed: () => context.push('/search'),
          icon: const Icon(Icons.search),
        ),
        IconButton(
          tooltip: 'Notifications',
          onPressed: () => context.push('/notifications'),
          icon: Badge(
            isLabelVisible: unread > 0,
            label: Text('$unread'),
            child: const Icon(Icons.notifications_none),
          ),
        ),
        IconButton(
          tooltip: 'Cart',
          onPressed: () => context.push('/cart'),
          icon: Badge(
            isLabelVisible: count > 0,
            label: Text('$count'),
            child: const Icon(Icons.shopping_bag_outlined),
          ),
        ),
      ],
    );
  }
}

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileProvider).asData?.value;
    return PageFrame(
      title: 'HelaCart',
      brand: true,
      leading: Builder(
        builder: (c) => Padding(
          padding: const EdgeInsets.only(left: 8),
          child: IconButton(
            tooltip: 'Open account menu',
            onPressed: () => BuyerAccountMenuScope.openMenu(c),
            icon: profile == null
                ? const CircleAvatar(
                    radius: 18,
                    backgroundColor: HelaColors.mint,
                    child: Icon(Icons.person_outline, color: HelaColors.teal),
                  )
                : BuyerAvatar(profile: profile, radius: 18),
          ),
        ),
      ),
      actions: const [HomeNotifications()],
      child: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(categoriesProvider);
          ref.invalidate(productsProvider);
          ref.invalidate(resourceProvider);
          await Future.wait([
            ref
                .read(categoriesProvider.future)
                .then<void>((_) {}, onError: (Object e) {}),
            ref
                .read(productsProvider('sort=newest&limit=4').future)
                .then<void>((_) {}, onError: (Object e) {}),
          ]);
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
          children: [
            if (ref.watch(configProvider).preview)
              const Notice('DESIGN PREVIEW · Sample products and shops.'),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                style: TextButton.styleFrom(
                  padding: EdgeInsets.zero,
                  foregroundColor: HelaColors.muted,
                ),
                onPressed: () => context.push('/account/addresses'),
                icon: const Icon(Icons.location_on_outlined, size: 16),
                label: const Text(
                  'Delivery in Sri Lanka  ⌄',
                  style: TextStyle(fontSize: 12),
                ),
              ),
            ),
            const DiscoverySearchBar(),
            verticalGap(16),
            RemoteView(
              path: '/storefront/hero',
              builder: (context, hero) => StorefrontHero(
                hero,
                onExplore: () =>
                    context.push(safeHeroTarget(hero['buttonHref'])),
              ),
            ),
            SectionTitle(
              'Find your everyday',
              more: 'View all',
              onMore: () => context.go('/categories'),
            ),
            ref
                .watch(categoriesProvider)
                .when(
                  data: (rows) => CategoryTiles(rows, compact: true),
                  loading: () => const LoadingBlocks(),
                  error: (e, _) => ErrorState(
                    e,
                    retry: () => ref.invalidate(categoriesProvider),
                  ),
                ),
            SectionTitle(
              'New & noteworthy',
              more: 'See all',
              onMore: () => context.push('/products?sort=newest'),
            ),
            ref
                .watch(productsProvider('sort=newest&limit=4'))
                .when(
                  data: (page) => page.items.isEmpty
                      ? const EmptyState(
                          title: 'New finds are on their way',
                          message:
                              'Check back soon for products from local shops.',
                        )
                      : ProductGrid(page.items),
                  loading: () => const LoadingBlocks(),
                  error: (e, _) => ErrorState(
                    e,
                    retry: () =>
                        ref.invalidate(productsProvider('sort=newest&limit=4')),
                  ),
                ),
            const DeliveryTrustStrip(),
            Material(
              color: HelaColors.mint,
              borderRadius: BorderRadius.circular(15),
              child: InkWell(
                borderRadius: BorderRadius.circular(15),
                onTap: () => context.push('/offers'),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.local_offer_outlined,
                        color: HelaColors.teal,
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'A good find, for a little less.',
                              style: Theme.of(context).textTheme.titleSmall,
                            ),
                            verticalGap(4),
                            const Text(
                              'Explore offers from independent shops',
                              style: TextStyle(
                                fontSize: 12,
                                color: HelaColors.muted,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Icon(
                        Icons.chevron_right,
                        color: HelaColors.teal,
                        size: 20,
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const RecommendationsSection(),
            SectionTitle(
              'Meet the local shops',
              more: 'Discover',
              onMore: () => context.push('/shops'),
            ),
            RemoteView(
              path: '/shops?limit=3',
              builder: (context, data) {
                final shops = objects(data['items']);
                if (shops.isEmpty) {
                  return const Text(
                    'Local shops will appear here.',
                    style: TextStyle(color: HelaColors.muted),
                  );
                }
                return SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (final shop in shops)
                        SizedBox(
                          width: 272,
                          child: Padding(
                            padding: const EdgeInsets.only(right: 12),
                            child: LocalShopTile(shop),
                          ),
                        ),
                    ],
                  ),
                );
              },
            ),
            verticalGap(24),
            const Text(
              'A little local. A lot to love.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: HelaColors.muted),
            ),
            TextButton(
              onPressed: () => context.push('/help'),
              child: const Text('How HelaCart works'),
            ),
          ],
        ),
      ),
    );
  }
}

String safeHeroTarget(Object? value) {
  final path = string(value);
  if (path == '/shops') return '/shops';
  if (path.startsWith('/products') &&
      !path.contains('://') &&
      !path.contains('\\')) {
    return path;
  }
  return '/products';
}

class CategoryTiles extends StatelessWidget {
  const CategoryTiles(this.rows, {super.key, this.compact = false});
  final List<Json> rows;
  final bool compact;
  Widget tile(BuildContext context, Json row) {
    final image = row['asset'] != null
        ? 'asset:${row['asset']}'
        : string(row['imageUrl']);
    return SizedBox(
      width: compact ? 76 : null,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () => context.push(
            '/products?category=${Uri.encodeQueryComponent(string(row['slug']))}',
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(compact ? 40 : 14),
                  child: Container(
                    color: HelaColors.image,
                    width: compact ? 60 : double.infinity,
                    height: compact ? 60 : 120,
                    child: image.isEmpty
                        ? const Icon(
                            Icons.category_outlined,
                            color: HelaColors.teal,
                          )
                        : ProductPhoto(image),
                  ),
                ),
                verticalGap(8),
                Text(
                  string(row['name']),
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: compact ? 11 : 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) {
      return const Text(
        'Categories will appear here.',
        style: TextStyle(color: HelaColors.muted),
      );
    }
    if (compact) {
      return SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final row in rows)
              Padding(
                padding: const EdgeInsets.only(right: 12),
                child: tile(context, row),
              ),
          ],
        ),
      );
    }
    return LayoutBuilder(
      builder: (context, box) => Wrap(
        spacing: 14,
        runSpacing: 18,
        children: [
          for (final row in rows)
            SizedBox(width: (box.maxWidth - 14) / 2, child: tile(context, row)),
        ],
      ),
    );
  }
}

class CategoriesScreen extends ConsumerWidget {
  const CategoriesScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => PageFrame(
    title: 'Categories',
    actions: const [ShoppingActions()],
    child: ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          'Find your everyday favourites.',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        verticalGap(20),
        ref
            .watch(categoriesProvider)
            .when(
              data: (rows) => CategoryTiles(rows),
              loading: () => const LoadingBlocks(),
              error: (e, _) => ErrorState(
                e,
                retry: () => ref.invalidate(categoriesProvider),
              ),
            ),
        for (final item in [
          ('All products', '/products'),
          ('New arrivals', '/products?sort=newest'),
          ('Offers', '/offers'),
          ('Discover shops', '/shops'),
        ])
          ListTile(
            title: Text(item.$1),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push(item.$2),
          ),
      ],
    ),
  );
}

class RecommendationsSection extends ConsumerWidget {
  const RecommendationsSection({super.key, this.productId});
  final String? productId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final personal =
        productId == null && ref.watch(sessionProvider).value != null;
    final path = productId != null
        ? '/discovery/recommendations?productId=$productId&limit=4'
        : personal
        ? '/me/recommendations?limit=4'
        : '/discovery/recommendations?limit=4';
    return RemoteView(
      path: path,
      private: personal,
      builder: (c, data) {
        final rows = objects(data['items']);
        if (rows.isEmpty) return const SizedBox.shrink();
        return Column(
          children: [
            SectionTitle(
              productId != null
                  ? 'You may also like'
                  : data['basis'] == 'YOUR_FAVORITE_CATEGORIES'
                  ? 'Inspired by your favorites'
                  : 'Discover more',
            ),
            ProductGrid(rows.map(Product.fromJson).toList()),
          ],
        );
      },
    );
  }
}
