import '../../../app/hc.dart';
import '../application/cart_actions.dart';

class CartScreen extends ConsumerWidget {
  const CartScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.watch(cartProvider).asData?.value;
    return PageFrame(
      title: context.tr('cart.title'),
      bottom:
          ref.watch(sessionProvider).value?.verified == true &&
              cart != null &&
              cart.items.isNotEmpty
          ? FilledButton(
              onPressed: cart.canCheckout
                  ? () => context.push('/checkout')
                  : null,
              child: Text(context.tr('cart.continue')),
            )
          : null,
      actions: [
        IconButton(
          tooltip: context.tr('cart.refresh'),
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
                    title: context.tr('cart.emptyTitle'),
                    message: context.tr('cart.emptyMessage'),
                    action: FilledButton(
                      onPressed: () => context.go('/products'),
                      child: Text(context.tr('common.exploreProducts')),
                    ),
                  );
                }
                return ListView(
                  padding: const EdgeInsets.all(20),
                  children: [
                    Notice(context.tr('cart.notice')),
                    for (final group in cart.groups.entries) ...[
                      SectionTitle(
                        string(
                          group.value.first['sellerName'],
                          context.tr('common.localShop'),
                        ),
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
                          MoneyRow(
                            context.tr('cart.subtotal'),
                            cart.subtotalLkrMinor,
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(context.tr('cart.delivery')),
                                ),
                                Flexible(
                                  child: Text(
                                    context.tr('cart.deliveryLater'),
                                    textAlign: TextAlign.end,
                                    style: const TextStyle(
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
                      Notice(context.tr('cart.reviewIssues'), error: true),
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
                    context.tr('cart.each', {
                      'price': money(integer(item['priceLkrMinor'])),
                    }),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  if (item['available'] != true)
                    Notice(context.tr('cart.unavailable'), error: true),
                ],
              ),
            ),
          ],
        ),
        MoneyRow(
          context.tr('cart.itemTotal'),
          integer(item['priceLkrMinor']) * integer(item['quantity']),
        ),
        Row(
          children: [
            IconButton(
              tooltip: context.tr('product.decrease'),
              onPressed: integer(item['quantity']) > 1
                  ? () => change(context, ref, integer(item['quantity']) - 1)
                  : null,
              icon: const Icon(Icons.remove_circle_outline),
            ),
            Text('${item['quantity']}'),
            IconButton(
              tooltip: context.tr('product.increase'),
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
              child: Text(context.tr('cart.remove')),
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
