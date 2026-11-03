import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../app/hc.dart';
import '../application/checkout_coordinator.dart';

final addressesProvider = FutureProvider.autoDispose<List<SavedAddress>>((ref) {
  ref.watch(sessionProvider);
  return ref.watch(repositoryProvider).savedAddresses();
}, retry: (c, e) => null);
final quoteProvider = FutureProvider.autoDispose.family<CartQuote, String>((
  ref,
  id,
) {
  ref.watch(sessionProvider);
  return ref.watch(repositoryProvider).cartQuote(id);
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

/// l10n key for a §3.2 checkout code, or `null` for unknown codes.
String? checkoutCodeKey(String? code) =>
    checkoutBlockerCodes.contains(code) ? 'checkout.code.$code' : null;

/// Confirms "Start over". The old attempt may already be an order, so the
/// dialog offers My orders first. Returns true only for an explicit restart.
Future<bool> confirmStartOver(BuildContext context) async {
  final result = await promptDialog<String>(
    context: context,
    builder: (c) => AlertDialog(
      scrollable: true,
      title: Text(c.tr('checkout.startOverTitle')),
      content: Text(c.tr('checkout.startOverBody')),
      actions: [
        TextButton(
          key: const ValueKey('start-over-orders'),
          onPressed: () => Navigator.pop(c, 'orders'),
          child: Text(c.tr('checkout.viewOrders')),
        ),
        TextButton(
          onPressed: () => Navigator.pop(c, 'back'),
          child: Text(c.tr('common.goBack')),
        ),
        FilledButton(
          key: const ValueKey('start-over-confirm'),
          onPressed: () => Navigator.pop(c, 'restart'),
          child: Text(c.tr('checkout.startOver')),
        ),
      ],
    ),
  );
  if (result == 'orders' && context.mounted) context.go('/orders');
  return result == 'restart';
}

class CheckoutScreen extends StatelessWidget {
  const CheckoutScreen({super.key});
  @override
  Widget build(BuildContext context) => PageFrame(
    title: context.tr('checkout.title'),
    child: const Protected(child: CheckoutFlow()),
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

  /// Last §3.2 code returned by `POST /me/orders/checkout`.
  String? lastCode;
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
          recoveryError = null;
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

  /// Clears the saved attempt (also when it cannot be read) after the buyer
  /// confirms, then starts a fresh checkout.
  Future<void> startOver() async {
    if (!await confirmStartOver(context) || !mounted) return;
    final owner = ref.read(authServiceProvider).session?.uid;
    if (owner == null) {
      throw AppFailure(AppStrings.current.t('common.protectedMessage'));
    }
    await ref.read(checkoutCoordinatorProvider).abandon(owner);
    ref.invalidate(cartProvider);
    if (addressId != null) ref.invalidate(quoteProvider(addressId!));
    if (!mounted) return;
    setState(() {
      pending = null;
      recoveryError = null;
      review = false;
      lastCode = null;
      checking = true;
    });
    await load();
  }

  Future<void> verifyPhone(SavedAddress? address) async {
    await context.push<bool>(
      '/account/phone${address == null ? '' : '?phone=${Uri.encodeQueryComponent(address.address.phone)}'}',
    );
    ref.invalidate(addressesProvider);
    if (addressId != null) ref.invalidate(quoteProvider(addressId!));
    if (mounted) setState(() => lastCode = null);
  }

  Future<void> place(CartQuote? quote) async {
    final strings = AppStrings.of(context);
    await ref.read(authServiceProvider).reload();
    final user = ref.read(authServiceProvider).session;
    if (user?.verified != true) {
      throw AppFailure(strings.t('checkout.verifyEmailFirst'));
    }
    try {
      final result = await ref
          .read(checkoutCoordinatorProvider)
          .place(
            owner: user!.uid,
            addressId: addressId,
            quote: quote?.cart.checkoutQuote,
          );
      ref.invalidate(cartProvider);
      ref.invalidate(resourceProvider);
      if (mounted) context.go('/order-success/${result['id']}');
    } catch (e) {
      if (e is AppFailure && e.definitiveCheckoutRejection) {
        if (addressId != null) ref.invalidate(quoteProvider(addressId!));
        ref.invalidate(cartProvider);
        if (mounted) {
          setState(() {
            review = false;
            lastCode = e.code;
          });
        }
      }
      await load();
      final key = e is AppFailure ? checkoutCodeKey(e.code) : null;
      if (e is AppFailure && key != null) {
        throw AppFailure(strings.t(key), status: e.status, code: e.code);
      }
      rethrow;
    }
  }

  Widget startOverActions() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      ActionButton(
        key: const ValueKey('checkout-start-over'),
        label: context.tr('checkout.startOver'),
        outlined: true,
        icon: Icons.restart_alt,
        action: startOver,
      ),
      TextButton(
        onPressed: () => context.go('/orders'),
        child: Text(context.tr('checkout.viewOrders')),
      ),
    ],
  );

  @override
  Widget build(BuildContext context) {
    if (checking) return const LoadingBlocks();
    if (recoveryError != null) {
      return ListView(
        padding: const EdgeInsets.all(20),
        children: [
          ErrorState(
            AppFailure(recoveryError!),
            retry: () {
              setState(() => checking = true);
              load();
            },
          ),
          Notice(context.tr('checkout.recoveryFailed'), error: true),
          Text(
            context.tr('checkout.recoveryHelp'),
            style: Theme.of(context).textTheme.bodySmall,
          ),
          verticalGap(),
          startOverActions(),
        ],
      );
    }
    if (pending != null) {
      return ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Notice(context.tr('checkout.pendingNotice')),
          ActionButton(
            label: context.tr('checkout.checkOrder'),
            action: () => place(null),
          ),
          verticalGap(),
          startOverActions(),
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
          data: (addresses) {
            final selected = addresses
                .where((a) => a.id == addressId)
                .firstOrNull;
            return ListView(
              controller: scroll,
              padding: const EdgeInsets.all(20),
              children: [
                Text(
                  context.tr(
                    review ? 'checkout.reviewTitle' : 'checkout.addressTitle',
                  ),
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                Text(
                  context.tr(review ? 'checkout.step2' : 'checkout.step1'),
                  style: const TextStyle(color: HelaColors.teal, fontSize: 12),
                ),
                verticalGap(20),
                if (addresses.isEmpty)
                  EmptyState(
                    title: context.tr('checkout.noAddressTitle'),
                    message: context.tr('checkout.noAddressMessage'),
                    icon: Icons.location_on_outlined,
                  ),
                RadioGroup<String>(
                  groupValue: addressId,
                  onChanged: (value) {
                    if (!review) {
                      setState(() {
                        addressId = value;
                        lastCode = null;
                      });
                    }
                  },
                  child: Column(
                    children: [
                      for (final saved in addresses.where(
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
                                    title: Text(saved.address.recipient),
                                    subtitle: AddressSummary(saved),
                                  )
                                : RadioListTile<String>(
                                    contentPadding: EdgeInsets.zero,
                                    value: saved.id,
                                    enabled: !review,
                                    title: Text(saved.address.recipient),
                                    subtitle: AddressSummary(saved),
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
                    label: Text(context.tr('checkout.addAddress')),
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
                          retry: () =>
                              ref.invalidate(quoteProvider(addressId!)),
                        ),
                        data: (result) =>
                            quoteDetails(context, result, selected),
                      ),
                verticalGap(24),
              ],
            );
          },
        );
  }

  Widget quoteDetails(
    BuildContext context,
    CartQuote result,
    SavedAddress? address,
  ) {
    final quote = result.cart;
    final blockers = {
      ...result.checkoutBlockers,
      if (lastCode != null && checkoutCodeKey(lastCode) != null) lastCode!,
    };
    final valid =
        quote.canCheckout &&
        quote.deliveryQuoted &&
        quote.addressId == addressId &&
        quote.checkoutQuote != null &&
        quote.items.isNotEmpty &&
        result.checkoutBlockers.isEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final group in quote.groups.entries) ...[
          SectionTitle(
            string(
              group.value.first['sellerName'],
              context.tr('common.localShop'),
            ),
          ),
          Panel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final item in group.value)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Text(
                      '${item['quantity']} × ${item['title']}\n${money(integer(item['priceLkrMinor']) * integer(item['quantity']))}',
                    ),
                  ),
                for (final delivery in quote.deliveryBySeller.where(
                  (d) => d['sellerId'] == group.key,
                )) ...[
                  if (delivery['available'] != true)
                    Notice(
                      string(
                        delivery['reason'],
                        context.tr('checkout.cannotDeliver'),
                      ),
                      error: true,
                    )
                  else
                    MoneyRow(
                      context.tr(
                        boolean(delivery['freeDelivery'])
                            ? 'checkout.deliveryFree'
                            : 'checkout.delivery',
                      ),
                      integer(delivery['feeMinor']),
                    ),
                  if (delivery['minDays'] != null &&
                      delivery['maxDays'] != null)
                    Text(
                      context.tr('checkout.estimate', {
                        'min': delivery['minDays'],
                        'max': delivery['maxDays'],
                      }),
                      style: Theme.of(context).textTheme.bodySmall,
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
              Text(
                context.tr('checkout.cod'),
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
              Text(context.tr('checkout.codBody')),
              verticalGap(),
              MoneyRow(context.tr('checkout.subtotal'), quote.subtotalLkrMinor),
              MoneyRow(context.tr('checkout.delivery'), quote.shippingLkrMinor),
              MoneyRow(
                context.tr('checkout.total'),
                quote.totalLkrMinor,
                strong: true,
              ),
            ],
          ),
        ),
        for (final code in blockers)
          if (checkoutCodeKey(code) != null)
            Notice(
              key: ValueKey('checkout-blocker-$code'),
              context.tr(checkoutCodeKey(code)!),
              error: true,
            ),
        if (blockers.contains('PHONE_NOT_VERIFIED'))
          OutlinedButton.icon(
            key: const ValueKey('checkout-verify-phone'),
            onPressed: () => verifyPhone(address),
            icon: const Icon(Icons.verified_user_outlined),
            label: Text(context.tr('checkout.verifyPhone')),
          ),
        if (!valid && blockers.isEmpty)
          Notice(context.tr('checkout.invalid'), error: true),
        verticalGap(20),
        if (review) ...[
          ActionButton(
            label: context.tr('checkout.place', {
              'amount': money(quote.totalLkrMinor),
            }),
            enabled: valid,
            action: () => place(result),
          ),
          TextButton(
            onPressed: () => changeStep(false),
            child: Text(context.tr('checkout.changeAddress')),
          ),
        ] else
          FilledButton(
            onPressed: valid ? () => changeStep(true) : null,
            child: Text(context.tr('checkout.review')),
          ),
      ],
    );
  }
}

/// Phone, address and the §3.1 phone-verification badge.
class AddressSummary extends StatelessWidget {
  const AddressSummary(this.saved, {super.key});
  final SavedAddress saved;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text('${saved.address.phone}\n${saved.address.formatted}'),
      const SizedBox(height: 4),
      Wrap(
        spacing: 6,
        runSpacing: 4,
        children: [
          PhoneBadge(verified: saved.phoneVerified),
          if (saved.isDefault) MiniTag(context.tr('addresses.default')),
        ],
      ),
    ],
  );
}

class PhoneBadge extends StatelessWidget {
  const PhoneBadge({super.key, required this.verified});
  final bool verified;
  @override
  Widget build(BuildContext context) => MiniTag(
    context.tr(
      verified ? 'addresses.phoneVerified' : 'addresses.phoneNotVerified',
    ),
    icon: verified ? Icons.verified_outlined : Icons.info_outline,
    warn: !verified,
  );
}

class MiniTag extends StatelessWidget {
  const MiniTag(this.text, {super.key, this.icon, this.warn = false});
  final String text;
  final IconData? icon;
  final bool warn;
  @override
  Widget build(BuildContext context) {
    final color = warn ? HelaColors.muted : HelaColors.teal;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: warn ? HelaColors.wash : HelaColors.mint,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 13, color: color),
            const SizedBox(width: 4),
          ],
          Flexible(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
          ),
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
    title: context.tr('checkout.successTitle'),
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
              context.tr('checkout.placed'),
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            verticalGap(),
            Text(
              context.tr('orders.ref', {
                'ref': id.substring(0, id.length.clamp(0, 8)).toUpperCase(),
              }),
              textAlign: TextAlign.center,
            ),
            verticalGap(20),
            Panel(
              child: Column(
                children: [
                  Text(context.tr('checkout.codArrives')),
                  MoneyRow(
                    context.tr('checkout.due'),
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
                subtitle: Text(
                  context.tr(
                    'status.${string(shop['status'])}',
                    const {},
                    label(string(shop['status'])),
                  ),
                ),
                trailing: Text(money(integer(shop['totalLkrMinor']))),
              ),
            Notice(context.tr('checkout.eachShop')),
            FilledButton(
              onPressed: () => context.go('/orders/$id'),
              child: Text(context.tr('checkout.viewOrder')),
            ),
            TextButton(
              onPressed: () => context.go('/'),
              child: Text(context.tr('checkout.continueShopping')),
            ),
          ],
        ),
      ),
    ),
  );
}
