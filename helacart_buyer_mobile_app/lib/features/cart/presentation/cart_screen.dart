import '../../../app/hc.dart';
import '../application/cart_actions.dart';

class CartScreen extends ConsumerWidget {
  const CartScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.watch(cartProvider).asData?.value;
    return PageFrame(
      title: 'Your cart',
      bottom:
          ref.watch(sessionProvider).value?.verified == true &&
              cart != null &&
              cart.items.isNotEmpty
          ? FilledButton(
              onPressed: cart.canCheckout
                  ? () => context.push('/checkout')
                  : null,
              child: const Text('Continue to checkout'),
            )
          : null,
      actions: [
        IconButton(
          tooltip: 'Refresh cart',
          onPressed: () => ref.invalidate(cartProvider),
          icon: const Icon(Icons.refresh),
        ),
      ],
      child: Protected(
        child: ref
            .watch(cartProvider)
            .when(
              skipLoadingOnRefresh: false,
              skipLoadingOnReload: false,
              data: (cart) {
                if (cart == null || cart.items.isEmpty) {
                  return EmptyState(
                    title: 'Your cart is waiting',
                    message: 'Find something you’ll love from a local shop.',
                    action: FilledButton(
                      onPressed: () => context.go('/products'),
                      child: const Text('Explore products'),
                    ),
                  );
                }
                return ListView(
                  padding: const EdgeInsets.all(20),
                  children: [
                    const Notice(
                      'Each shop delivers separately. Final destination delivery fees are shown at checkout.',
                    ),
                    for (final group in cart.groups.entries) ...[
                      SectionTitle(
                        string(group.value.first['sellerName'], 'Local shop'),
                      ),
                      Panel(
                        child: Column(
                          children: [
                            for (var i = 0; i < group.value.length; i++) ...[
                              if (i > 0) const Divider(height: 24),
                              CartItemRow(item: group.value[i]),
                            ],
                          ],
                        ),
                      ),
                    ],
                    verticalGap(20),
                    Panel(
                      child: Column(
                        children: [
                          MoneyRow('Items subtotal', cart.subtotalLkrMinor),
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 8),
                            child: Row(
                              children: [
                                Expanded(child: Text('Delivery')),
                                Flexible(
                                  child: Text(
                                    'Calculated at checkout',
                                    textAlign: TextAlign.end,
                                    style: TextStyle(
                                      color: HelaColors.muted,
                                      fontSize: 12,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (!cart.canCheckout)
                      const Notice(
                        'Review unavailable items or shop delivery settings before checkout.',
                        error: true,
                      ),
                  ],
                );
              },
              loading: () => const LoadingBlocks(),
              error: (e, _) =>
                  ErrorState(e, retry: () => ref.invalidate(cartProvider)),
            ),
      ),
    );
  }
}

class CartItemRow extends ConsumerWidget {
  const CartItemRow({super.key, required this.item});
  final Json item;
  @override
  Widget build(BuildContext context, WidgetRef ref) => Padding(
    padding: EdgeInsets.zero,
    child: Column(
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 72,
              height: 72,
              child: ProductPhoto(string(item['imageUrl'])),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    string(item['title']),
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  Text(
                    object(item['optionValues']).values.join(' / '),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  Text(
                    '${money(integer(item['priceLkrMinor']))} each',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  if (item['available'] != true)
                    const Notice('Currently unavailable', error: true),
                ],
              ),
            ),
          ],
        ),
        MoneyRow(
          'Item total',
          integer(item['priceLkrMinor']) * integer(item['quantity']),
        ),
        Row(
          children: [
            IconButton(
              tooltip: 'Decrease quantity',
              onPressed: integer(item['quantity']) > 1
                  ? () => change(context, ref, integer(item['quantity']) - 1)
                  : null,
              icon: const Icon(Icons.remove_circle_outline),
            ),
            Text('${item['quantity']}'),
            IconButton(
              tooltip: 'Increase quantity',
              onPressed:
                  integer(item['quantity']) <
                          integer(item['availableQuantity']) &&
                      integer(item['quantity']) < 100
                  ? () => change(context, ref, integer(item['quantity']) + 1)
                  : null,
              icon: const Icon(Icons.add_circle_outline),
            ),
            const Spacer(),
            TextButton(
              onPressed: () async {
                try {
                  await ref
                      .read(cartActionsProvider)
                      .remove(string(item['variantId']));
                  ref.invalidate(cartProvider);
                } catch (e) {
                  if (context.mounted) toast(context, friendlyError(e));
                }
              },
              child: const Text('Remove'),
            ),
          ],
        ),
      ],
    ),
  );
  Future<void> change(BuildContext context, WidgetRef ref, int amount) async {
    try {
      await ref
          .read(cartActionsProvider)
          .set(string(item['variantId']), amount);
      ref.invalidate(cartProvider);
    } catch (e) {
      ref.invalidate(cartProvider);
      if (context.mounted) toast(context, friendlyError(e));
    }
  }
}
