import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../app/hc.dart';
import '../application/checkout_coordinator.dart';

final addressesProvider = FutureProvider.autoDispose<List<BuyerAddress>>((ref) {
  ref.watch(sessionProvider);
  return ref.watch(repositoryProvider).addresses();
}, retry: (c, e) => null);
final quoteProvider = FutureProvider.autoDispose.family<CartData, String>((
  ref,
  id,
) {
  ref.watch(sessionProvider);
  return ref.watch(repositoryProvider).cart(id);
}, retry: (c, e) => null);
final checkoutStoreProvider = Provider<CheckoutStore>(
  (ref) => const SecureCheckoutStore(FlutterSecureStorage()),
);
final checkoutCoordinatorProvider = Provider<CheckoutCoordinator>((ref) {
  final auth = ref.watch(authServiceProvider);
  return CheckoutCoordinator(
    ref.watch(repositoryProvider),
    ref.watch(checkoutStoreProvider),
    () => auth.session?.uid,
  );
});

class CheckoutScreen extends StatelessWidget {
  const CheckoutScreen({super.key});
  @override
  Widget build(BuildContext context) => const PageFrame(
    title: 'Checkout',
    child: Protected(child: CheckoutFlow()),
  );
}

class CheckoutFlow extends ConsumerStatefulWidget {
  const CheckoutFlow({super.key});
  @override
  ConsumerState<CheckoutFlow> createState() => _CheckoutFlowState();
}

class _CheckoutFlowState extends ConsumerState<CheckoutFlow> {
  final scroll = ScrollController();
  String? addressId;
  bool review = false, checking = true;
  CheckoutIntent? pending;
  String? recoveryError;
  @override
  void dispose() {
    scroll.dispose();
    super.dispose();
  }

  void changeStep(bool next) {
    setState(() => review = next);
    if (scroll.hasClients) scroll.jumpTo(0);
  }

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final owner = ref.read(authServiceProvider).session!.uid;
      final saved = await ref.read(checkoutStoreProvider).read(owner);
      if (mounted) {
        setState(() {
          pending = saved;
          checking = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          recoveryError = friendlyError(e);
          checking = false;
        });
      }
    }
  }

  Future<void> place(CartData? quote) async {
    await ref.read(authServiceProvider).reload();
    final user = ref.read(authServiceProvider).session;
    if (user?.verified != true) {
      throw const AppFailure('Verify your email before ordering.');
    }
    try {
      final result = await ref
          .read(checkoutCoordinatorProvider)
          .place(
            owner: user!.uid,
            addressId: addressId,
            quote: quote?.checkoutQuote,
          );
      ref.invalidate(cartProvider);
      ref.invalidate(resourceProvider);
      if (mounted) context.go('/order-success/${result['id']}');
    } catch (e) {
      if (e is AppFailure && e.definitiveCheckoutRejection) {
        if (addressId != null) ref.invalidate(quoteProvider(addressId!));
        ref.invalidate(cartProvider);
        if (mounted) setState(() => review = false);
      }
      await load();
      rethrow;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (checking) return const LoadingBlocks();
    if (recoveryError != null) {
      return ErrorState(
        AppFailure(recoveryError!),
        retry: () {
          setState(() => checking = true);
          load();
        },
      );
    }
    if (pending != null) {
      return ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Notice(
            'Your previous checkout needs confirmation. Recheck the same attempt before changing the cart or placing another order.',
          ),
          ActionButton(label: 'Check my order', action: () => place(null)),
        ],
      );
    }
    return ref
        .watch(addressesProvider)
        .when(
          skipLoadingOnRefresh: false,
          skipLoadingOnReload: false,
          loading: () => const LoadingBlocks(),
          error: (e, _) =>
              ErrorState(e, retry: () => ref.invalidate(addressesProvider)),
          data: (addresses) => ListView(
            controller: scroll,
            padding: const EdgeInsets.all(20),
            children: [
              Text(
                review ? 'Review & place order' : 'Choose a delivery address',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              Text(
                review ? 'Step 2 of 2 · Review' : 'Step 1 of 2 · Address',
                style: const TextStyle(color: HelaColors.teal, fontSize: 12),
              ),
              verticalGap(20),
              if (addresses.isEmpty)
                const EmptyState(
                  title: 'Where should we deliver?',
                  message: 'Add an address to see each shop’s delivery fee.',
                  icon: Icons.location_on_outlined,
                ),
              RadioGroup<String>(
                groupValue: addressId,
                onChanged: (value) {
                  if (!review) setState(() => addressId = value);
                },
                child: Column(
                  children: [
                    for (final address in addresses.where(
                      (a) => !review || a.id == addressId,
                    ))
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Panel(
                          child: review
                              ? ListTile(
                                  contentPadding: EdgeInsets.zero,
                                  leading: const Icon(
                                    Icons.check_circle_outline,
                                    color: HelaColors.teal,
                                  ),
                                  title: Text(address.recipient),
                                  subtitle: Text(
                                    '${address.phone}\n${address.formatted}',
                                  ),
                                )
                              : RadioListTile<String>(
                                  contentPadding: EdgeInsets.zero,
                                  value: address.id,
                                  enabled: !review,
                                  title: Text(address.recipient),
                                  subtitle: Text(
                                    '${address.phone}\n${address.formatted}',
                                  ),
                                ),
                        ),
                      ),
                  ],
                ),
              ),
              if (!review)
                OutlinedButton.icon(
                  onPressed: () async {
                    final saved = await context.push<String>(
                      '/account/addresses/new',
                    );
                    ref.invalidate(addressesProvider);
                    if (saved != null && mounted) {
                      setState(() => addressId = saved);
                    }
                  },
                  icon: const Icon(Icons.add),
                  label: const Text('Add new address'),
                ),
              verticalGap(review ? 0 : 16),
              if (addressId != null)
                ref
                    .watch(quoteProvider(addressId!))
                    .when(
                      skipLoadingOnRefresh: false,
                      skipLoadingOnReload: false,
                      loading: () => const LoadingBlocks(),
                      error: (e, _) => ErrorState(
                        e,
                        retry: () => ref.invalidate(quoteProvider(addressId!)),
                      ),
                      data: (quote) {
                        final valid =
                            quote.canCheckout &&
                            quote.deliveryQuoted &&
                            quote.addressId == addressId &&
                            quote.checkoutQuote != null &&
                            quote.items.isNotEmpty;
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            for (final group in quote.groups.entries) ...[
                              SectionTitle(
                                string(
                                  group.value.first['sellerName'],
                                  'Local shop',
                                ),
                              ),
                              Panel(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    for (final item in group.value)
                                      Padding(
                                        padding: const EdgeInsets.symmetric(
                                          vertical: 6,
                                        ),
                                        child: Text(
                                          '${item['quantity']} × ${item['title']}\n${money(integer(item['priceLkrMinor']) * integer(item['quantity']))}',
                                        ),
                                      ),
                                    for (final delivery
                                        in quote.deliveryBySeller.where(
                                          (d) => d['sellerId'] == group.key,
                                        )) ...[
                                      if (delivery['available'] != true)
                                        Notice(
                                          string(
                                            delivery['reason'],
                                            'This shop cannot deliver to your address.',
                                          ),
                                          error: true,
                                        )
                                      else
                                        MoneyRow(
                                          boolean(delivery['freeDelivery'])
                                              ? 'Delivery · free'
                                              : 'Delivery',
                                          integer(delivery['feeMinor']),
                                        ),
                                      if (delivery['minDays'] != null &&
                                          delivery['maxDays'] != null)
                                        Text(
                                          'Estimated ${delivery['minDays']}–${delivery['maxDays']} calendar days after dispatch.',
                                          style: Theme.of(context)
                                              .textTheme
                                              .bodySmall,
                                        ),
                                    ],
                                  ],
                                ),
                              ),
                            ],
                            verticalGap(20),
                            Panel(
                              color: HelaColors.mint,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'Cash on delivery',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                  const Text(
                                    'Pay when each shop’s package arrives.',
                                  ),
                                  verticalGap(),
                                  MoneyRow(
                                    'Items subtotal',
                                    quote.subtotalLkrMinor,
                                  ),
                                  MoneyRow('Delivery', quote.shippingLkrMinor),
                                  MoneyRow(
                                    'Total due on delivery',
                                    quote.totalLkrMinor,
                                    strong: true,
                                  ),
                                ],
                              ),
                            ),
                            if (!valid)
                              const Notice(
                                'Resolve unavailable items or delivery restrictions, then refresh your quote.',
                                error: true,
                              ),
                            verticalGap(20),
                            if (review) ...[
                              ActionButton(
                                label:
                                    'Place COD order · ${money(quote.totalLkrMinor)}',
                                enabled: valid,
                                action: () => place(quote),
                              ),
                              TextButton(
                                onPressed: () => changeStep(false),
                                child: const Text('Change address'),
                              ),
                            ] else
                              FilledButton(
                                onPressed: valid
                                    ? () => changeStep(true)
                                    : null,
                                child: const Text('Review order'),
                              ),
                          ],
                        );
                      },
                    ),
              verticalGap(24),
            ],
          ),
        );
  }
}

class OrderSuccessScreen extends StatelessWidget {
  const OrderSuccessScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context) => PageFrame(
    title: 'Order confirmation',
    child: Protected(
      child: RemoteView(
        path: '/me/orders/$id',
        private: true,
        builder: (c, order) => ListView(
          padding: const EdgeInsets.all(HelaSpacing.screen),
          children: [
            const Icon(
              Icons.check_circle_outline,
              size: 72,
              color: HelaColors.teal,
            ),
            verticalGap(20),
            Text(
              'Order placed',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            verticalGap(),
            Text(
              'Order #${id.substring(0, id.length.clamp(0, 8)).toUpperCase()}',
              textAlign: TextAlign.center,
            ),
            verticalGap(20),
            Panel(
              child: Column(
                children: [
                  const Text('Cash on delivery · pay when your order arrives'),
                  MoneyRow(
                    'Due on delivery',
                    integer(order['totalLkrMinor']),
                    strong: true,
                  ),
                ],
              ),
            ),
            verticalGap(),
            for (final shop in objects(order['sellerOrders']))
              ListTile(
                leading: const Icon(Icons.inventory_2_outlined),
                title: Text(string(object(shop['seller'])['name'])),
                subtitle: Text(label(string(shop['status']))),
                trailing: Text(money(integer(shop['totalLkrMinor']))),
              ),
            const Notice('Each shop fulfills and delivers its own package.'),
            FilledButton(
              onPressed: () => context.go('/orders/$id'),
              child: const Text('View order'),
            ),
            TextButton(
              onPressed: () => context.go('/'),
              child: const Text('Continue shopping'),
            ),
          ],
        ),
      ),
    ),
  );
}
