import '../../../app/hc.dart';
import '../../catalog/presentation/product_widgets.dart';

class FavoritesScreen extends ConsumerStatefulWidget {
  const FavoritesScreen({super.key});
  @override
  ConsumerState<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends ConsumerState<FavoritesScreen> {
  int page = 1;
  @override
  Widget build(BuildContext context) => PageFrame(
    title: 'Your saved finds',
    child: Protected(
      verified: false,
      child: RemoteView(
        path: '/me/favorites?page=$page&limit=12',
        private: true,
        builder: (c, data) => ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text(
              'Keep the good finds.',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            verticalGap(8),
            Text('${integer(data['total'])} saved products'),
            verticalGap(20),
            if (objects(data['items']).isEmpty)
              EmptyState(
                title: 'A place for your favourites',
                message: 'Tap the heart on a product to save it for later.',
                icon: Icons.favorite_border,
                action: FilledButton(
                  onPressed: () => context.push('/products'),
                  child: const Text('Explore products'),
                ),
              ),
            for (final item in objects(data['items']))
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Panel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (item['product'] != null)
                        FavoriteProductRow(item: item)
                      else
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              string(item['title'], 'Unavailable product'),
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            Text(string(item['sellerName'])),
                            const Notice(
                              'This product is currently unavailable. You can keep it saved or remove it.',
                            ),
                          ],
                        ),
                      ResponsiveActions(
                        children: [
                          if (item['product'] != null)
                            OutlinedButton.icon(
                              onPressed: () => showModalBottomSheet<void>(
                                context: context,
                                isScrollControlled: true,
                                builder: (c) => FavoriteAlertsSheet(item: item),
                              ),
                              icon: const Icon(Icons.notifications_none),
                              label: const Text('Alert settings'),
                            ),
                          ActionButton(
                            label: 'Remove',
                            icon: Icons.delete_outline,
                            outlined: true,
                            action: () async {
                              await ref
                                  .read(repositoryProvider)
                                  .write(
                                    '/me/favorites/${item['id']}',
                                    'DELETE',
                                  );
                              ref.invalidate(resourceProvider);
                              ref.invalidate(favoriteIndexProvider);
                            },
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            Pager(
              page: page,
              pages: integer(data['pages'], 1),
              change: (v) => setState(() => page = v),
            ),
          ],
        ),
      ),
    ),
  );
}

class FavoriteProductRow extends ConsumerWidget {
  const FavoriteProductRow({super.key, required this.item});
  final Json item;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = Product.fromJson(object(item['product']));
    final variant = p.availableVariant;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 90,
              height: 90,
              child: ProductPhoto(p.imageUrls.firstOrNull),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    p.shopName,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  InkWell(
                    onTap: () => context.push('/products/${p.id}'),
                    child: Text(
                      p.title,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                  verticalGap(6),
                  Text(
                    money(p.displayPrice),
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      color: HelaColors.teal,
                    ),
                  ),
                  Text(
                    variant == null ? 'Sold out' : 'In stock',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ],
        ),
        verticalGap(),
        if (p.variants.length > 1 || variant == null)
          FilledButton(
            onPressed: () => context.push('/products/${p.id}'),
            child: Text(variant == null ? 'View product' : 'Choose options'),
          )
        else
          ActionButton(
            label: 'Add to cart',
            action: () => addProduct(context, ref, p, variant, 1),
          ),
        verticalGap(8),
      ],
    );
  }
}

class FavoriteAlertsSheet extends ConsumerStatefulWidget {
  const FavoriteAlertsSheet({super.key, required this.item});
  final Json item;
  @override
  ConsumerState<FavoriteAlertsSheet> createState() =>
      _FavoriteAlertsSheetState();
}

class _FavoriteAlertsSheetState extends ConsumerState<FavoriteAlertsSheet> {
  late bool price = boolean(widget.item['priceAlerts']),
      stock = boolean(widget.item['restockAlerts']);
  @override
  Widget build(BuildContext context) => SafeArea(
    child: SingleChildScrollView(
      padding: const EdgeInsets.all(HelaSpacing.screen),
      child: Protected(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Alerts for this find',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            verticalGap(10),
            Text(string(widget.item['title'])),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Price drops'),
              value: price,
              onChanged: (v) => setState(() => price = v),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Back in stock'),
              value: stock,
              onChanged: (v) => setState(() => stock = v),
            ),
            const Text(
              'Alerts appear in your HelaCart inbox. They concern the product’s cheapest available option or any option returning to stock, rather than a particular size.',
              style: TextStyle(fontSize: 12, color: HelaColors.muted),
            ),
            verticalGap(20),
            ActionButton(
              label: 'Save preferences',
              action: () async {
                await ref.read(repositoryProvider).write(
                  '/me/favorites/${widget.item['id']}/alerts',
                  'PATCH',
                  {
                    'version': integer(widget.item['alertVersion']),
                    'priceAlerts': price,
                    'restockAlerts': stock,
                  },
                );
                ref.invalidate(resourceProvider);
                if (context.mounted) Navigator.pop(context);
              },
            ),
          ],
        ),
      ),
    ),
  );
}
