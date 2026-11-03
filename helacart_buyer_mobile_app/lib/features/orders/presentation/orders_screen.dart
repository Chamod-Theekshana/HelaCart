import 'package:flutter/services.dart';

import '../../../app/hc.dart';

/// Every buyer-visible seller-order status (§1.1), in filter order.
const sellerOrderStatuses = [
  'PLACED',
  'ACCEPTED',
  'PACKED',
  'SHIPPED',
  'DELIVERY_FAILED',
  'DELIVERED',
  'CANCELLED',
  'RETURNED_TO_SELLER',
];

/// Buyers may cancel only before the shop accepts (§1.3).
bool canCancelPackage(String status) => status == 'PLACED';

/// "I received this order" is allowed only from SHIPPED (§1.4).
bool canConfirmReceipt(String status) => status == 'SHIPPED';

/// Runs a buyer status change. A 409 `ORDER_TRANSITION_NOT_ALLOWED` (the
/// package moved on meanwhile) refreshes the order and shows a clear message.
Future<void> changePackageStatus(
  WidgetRef ref,
  AppStrings strings,
  Future<Object?> Function() request,
) async {
  try {
    await request();
  } on AppFailure catch (e) {
    if (e.code != 'ORDER_TRANSITION_NOT_ALLOWED') rethrow;
    ref.invalidate(resourceProvider);
    throw AppFailure(
      strings.t('orders.transitionNotAllowed'),
      status: e.status,
      code: e.code,
    );
  }
  ref.invalidate(resourceProvider);
}

class OrdersScreen extends ConsumerStatefulWidget {
  const OrdersScreen({super.key});
  @override
  ConsumerState<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends ConsumerState<OrdersScreen> {
  int page = 1;
  String query = '', status = '';
  String get path =>
      '/workspace/me/orders?page=$page&q=${Uri.encodeQueryComponent(query)}${status.isEmpty ? '' : '&status=$status'}';
  @override
  Widget build(BuildContext context) => PageFrame(
    title: context.tr('orders.title'),
    actions: [
      IconButton(
        tooltip: context.tr('orders.refresh'),
        onPressed: () => ref.invalidate(resourceProvider),
        icon: const Icon(Icons.refresh),
      ),
    ],
    child: Protected(
      child: RefreshIndicator(
        onRefresh: () => refreshResource(ref, path, private: true),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(20),
          children: [
            TextField(
              maxLength: 80,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                counterText: '',
                labelText: context.tr('orders.search'),
                prefixIcon: const Icon(Icons.search),
              ),
              onSubmitted: (v) => setState(() {
                query = v.trim();
                page = 1;
              }),
            ),
            verticalGap(),
            DropdownButtonFormField<String>(
              initialValue: status,
              decoration: InputDecoration(
                labelText: context.tr('orders.status'),
              ),
              isExpanded: true,
              items: [
                DropdownMenuItem(
                  value: '',
                  child: Text(context.tr('orders.allStatuses')),
                ),
                for (final s in sellerOrderStatuses)
                  DropdownMenuItem(
                    value: s,
                    child: Text(context.tr('status.$s', const {}, label(s))),
                  ),
              ],
              onChanged: (v) => setState(() {
                status = v!;
                page = 1;
              }),
            ),
            verticalGap(),
            RemoteView(
              path: path,
              private: true,
              builder: (c, data) => Column(
                children: [
                  if (objects(data['items']).isEmpty)
                    EmptyState(
                      title: c.tr(
                        query.isEmpty && status.isEmpty
                            ? 'orders.emptyTitle'
                            : 'orders.noMatch',
                      ),
                      message: c.tr('orders.emptyMessage'),
                      action: FilledButton(
                        onPressed: () => context.push('/products'),
                        child: Text(c.tr('common.exploreProducts')),
                      ),
                    ),
                  for (final row in objects(data['items']))
                    Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: Panel(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              c.tr('orders.ref', {'ref': shortRef(row['id'])}),
                              style: Theme.of(c).textTheme.titleMedium,
                            ),
                            Text(
                              dateText(row['createdAt']),
                              style: Theme.of(c).textTheme.bodySmall,
                            ),
                            MoneyRow(
                              c.tr('orders.originalTotal'),
                              integer(row['totalLkrMinor']),
                            ),
                            for (final shop in objects(row['sellerOrders']))
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 6,
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    OverflowBar(
                                      alignment: MainAxisAlignment.spaceBetween,
                                      spacing: 12,
                                      overflowSpacing: 6,
                                      overflowAlignment:
                                          OverflowBarAlignment.start,
                                      children: [
                                        Text(
                                          string(
                                            object(shop['seller'])['name'],
                                          ),
                                        ),
                                        StatusPill(string(shop['status'])),
                                      ],
                                    ),
                                    StatusReason(shop['statusReason']),
                                  ],
                                ),
                              ),
                            verticalGap(8),
                            OutlinedButton(
                              onPressed: () =>
                                  context.push('/orders/${row['id']}'),
                              child: Text(c.tr('orders.view')),
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
          ],
        ),
      ),
    ),
  );
}

String shortRef(Object? value) {
  final s = string(value);
  return s.substring(0, s.length < 8 ? s.length : 8).toUpperCase();
}

/// `statusReason` (§1.1) shown under a package status when present.
class StatusReason extends StatelessWidget {
  const StatusReason(this.reason, {super.key});
  final Object? reason;
  @override
  Widget build(BuildContext context) {
    final text = string(reason).trim();
    if (text.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Text(
        context.tr('orders.reason', {'reason': text}),
        style: Theme.of(context).textTheme.bodySmall,
      ),
    );
  }
}

/// Optional cancellation reason (§1.3, 5–500 characters). Returns `null` when
/// the buyer goes back, otherwise the trimmed reason (possibly empty).
class CancelPackageDialog extends StatefulWidget {
  const CancelPackageDialog({super.key, required this.shop});
  final String shop;
  @override
  State<CancelPackageDialog> createState() => _CancelPackageDialogState();
}

class _CancelPackageDialogState extends State<CancelPackageDialog> {
  final reason = TextEditingController();
  String? error;
  @override
  void dispose() {
    reason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    scrollable: true,
    title: Text(context.tr('orders.cancelTitle')),
    content: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(context.tr('orders.cancelBody', {'shop': widget.shop})),
        verticalGap(),
        TextField(
          key: const ValueKey('cancel-reason'),
          controller: reason,
          maxLength: 500,
          minLines: 1,
          maxLines: 3,
          decoration: InputDecoration(
            labelText: context.tr('orders.cancelReason'),
            hintText: context.tr('orders.cancelReasonHint'),
            errorText: error,
          ),
        ),
      ],
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: Text(context.tr('common.goBack')),
      ),
      FilledButton(
        key: const ValueKey('cancel-confirm'),
        onPressed: () {
          final text = reason.text.trim();
          if (text.isNotEmpty && (text.length < 5 || text.length > 500)) {
            setState(() => error = context.tr('orders.cancelReasonLength'));
            return;
          }
          Navigator.pop(context, text);
        },
        child: Text(context.tr('orders.cancelConfirm')),
      ),
    ],
  );
}

class OrderDetailsScreen extends ConsumerWidget {
  const OrderDetailsScreen({super.key, required this.id, this.packageId});
  final String id;
  final String? packageId;
  String get path => '/me/orders/$id';
  @override
  Widget build(BuildContext context, WidgetRef ref) => PageFrame(
    title: context.tr(
      packageId == null ? 'orders.detailsTitle' : 'orders.trackingTitle',
    ),
    actions: [
      IconButton(
        tooltip: context.tr('orders.refreshOrder'),
        onPressed: () =>
            ref.invalidate(resourceProvider((path: path, private: true))),
        icon: const Icon(Icons.refresh),
      ),
    ],
    child: Protected(
      child: RefreshIndicator(
        onRefresh: () => refreshResource(ref, path, private: true),
        child: RemoteView(
          path: path,
          private: true,
          builder: (c, order) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(20),
            children: [
              Text(
                c.tr('orders.ref', {'ref': shortRef(id)}),
                style: Theme.of(c).textTheme.headlineSmall,
              ),
              Text(
                dateText(order['createdAt']),
                style: Theme.of(c).textTheme.bodySmall,
              ),
              verticalGap(),
              Panel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      c.tr('orders.deliveryAddress'),
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    verticalGap(8),
                    Text(
                      '${string(order['recipient'])}\n${string(order['phone'])}\n${string(order['line1'])}${string(order['line2']).isEmpty ? '' : ', ${order['line2']}'}\n${string(order['city'])}, ${string(order['district'])} ${string(order['postalCode'])}',
                    ),
                  ],
                ),
              ),
              for (final shop in objects(
                order['sellerOrders'],
              ).where((p) => packageId == null || p['id'] == packageId))
                PackageSection(
                  key: ValueKey('package-${shop['id']}'),
                  orderId: id,
                  package: shop,
                  showTrackingLink: packageId == null,
                ),
              verticalGap(20),
              Panel(
                color: HelaColors.mint,
                child: Column(
                  children: [
                    Text(c.tr('orders.cod')),
                    MoneyRow(
                      c.tr('orders.orderTotal'),
                      integer(order['totalLkrMinor']),
                      strong: true,
                    ),
                    Text(
                      c.tr('orders.totalsNote'),
                      style: const TextStyle(fontSize: 12),
                    ),
                  ],
                ),
              ),
              verticalGap(24),
            ],
          ),
        ),
      ),
    ),
  );
}

/// One shop package with items, totals, timeline and buyer actions.
class PackageSection extends ConsumerWidget {
  const PackageSection({
    super.key,
    required this.orderId,
    required this.package,
    this.showTrackingLink = true,
  });
  final String orderId;
  final Json package;
  final bool showTrackingLink;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final shop = package;
    final status = string(shop['status']);
    final shopName = string(object(shop['seller'])['name']);
    final base = '/me/orders/$orderId/seller-orders/${shop['id']}';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionTitle(shopName),
        Panel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              StatusPill(status),
              StatusReason(shop['statusReason']),
              verticalGap(),
              for (final item in objects(shop['items']))
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        string(item['productTitle']),
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      Text(
                        context.tr('orders.qty', {
                          'options': object(item['optionValues']).values
                              .join(' / '),
                          'quantity': item['quantity'],
                        }),
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      MoneyRow(
                        context.tr('orders.itemValue'),
                        integer(item['lineLkrMinor']),
                      ),
                      if (status == 'DELIVERED' &&
                          object(item['variant'])['productId'] != null)
                        TextButton(
                          onPressed: () => context.push(
                            '/products/${object(item['variant'])['productId']}/reviews',
                          ),
                          child: Text(context.tr('orders.reviewProduct')),
                        ),
                    ],
                  ),
                ),
              MoneyRow(
                context.tr('orders.delivery'),
                integer(shop['shippingLkrMinor']),
              ),
              MoneyRow(
                context.tr('orders.packageTotal'),
                integer(shop['totalLkrMinor']),
                strong: true,
              ),
              verticalGap(),
              ShipmentTimeline(package: shop),
              if (showTrackingLink)
                OutlinedButton(
                  onPressed: () =>
                      context.push('/orders/$orderId/tracking/${shop['id']}'),
                  child: Text(context.tr('orders.tracking')),
                ),
              if (canConfirmReceipt(status)) ...[
                verticalGap(8),
                ActionButton(
                  key: ValueKey('confirm-receipt-${shop['id']}'),
                  label: context.tr('orders.receive'),
                  icon: Icons.inventory_outlined,
                  action: () async {
                    final strings = AppStrings.of(context);
                    if (!await confirm(
                      context,
                      title: strings.t('orders.receiveTitle'),
                      message: strings.t('orders.receiveBody', {
                        'shop': shopName,
                      }),
                      action: strings.t('orders.receiveConfirm'),
                    )) {
                      return;
                    }
                    await changePackageStatus(
                      ref,
                      strings,
                      () => ref
                          .read(repositoryProvider)
                          .write('$base/confirm-receipt', 'POST', {}),
                    );
                    if (context.mounted) {
                      toast(context, strings.t('orders.received'));
                    }
                  },
                ),
              ],
              if (canCancelPackage(status)) ...[
                verticalGap(8),
                ActionButton(
                  key: ValueKey('cancel-package-${shop['id']}'),
                  label: context.tr('orders.cancel'),
                  outlined: true,
                  action: () async {
                    final strings = AppStrings.of(context);
                    final reason = await promptDialog<String>(
                      context: context,
                      builder: (c) => CancelPackageDialog(shop: shopName),
                    );
                    if (reason == null) return;
                    await changePackageStatus(
                      ref,
                      strings,
                      () => ref
                          .read(repositoryProvider)
                          .write(
                            '$base/cancel',
                            'PATCH',
                            reason.isEmpty ? null : {'reason': reason},
                          ),
                    );
                  },
                ),
              ],
              if (status == 'DELIVERED') ...[
                OutlinedButton(
                  onPressed: () => context.push('/returns/new/${shop['id']}'),
                  child: Text(context.tr('orders.returnItems')),
                ),
                if (object(shop['seller'])['slug'] != null)
                  TextButton(
                    onPressed: () => context.push(
                      '/shops/${object(shop['seller'])['slug']}/reviews',
                    ),
                    child: Text(context.tr('orders.reviewShop')),
                  ),
              ],
              TextButton(
                onPressed: () =>
                    context.push('/support/new?order=${shop['id']}'),
                child: Text(context.tr('orders.support')),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class ShipmentTimeline extends StatelessWidget {
  const ShipmentTimeline({super.key, required this.package});
  final Json package;
  @override
  Widget build(BuildContext context) {
    final shipment = object(package['shipment']);
    final status = string(package['status']);
    final events = objects(package['events']);
    final min = integer(package['deliveryMinDays']),
        max = integer(package['deliveryMaxDays']);
    final dispatched = DateTime.tryParse(string(shipment['shippedAt']));
    final failed =
        status == 'DELIVERY_FAILED' ||
        events.any((e) => e['toStatus'] == 'DELIVERY_FAILED');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          context.tr('timeline.title'),
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        verticalGap(10),
        if (status == 'CANCELLED')
          Notice(context.tr('orders.cancelled'))
        else if (status == 'RETURNED_TO_SELLER')
          Notice(context.tr('orders.returnedToSeller'), error: true)
        else ...[
          if (status == 'DELIVERY_FAILED')
            Notice(context.tr('orders.deliveryFailed'), error: true),
          if (shipment.isNotEmpty) ...[
            Text(
              string(shipment['courierName']),
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            if (string(shipment['trackingNumber']).isNotEmpty)
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(string(shipment['trackingNumber'])),
                subtitle: Text(context.tr('timeline.courierRef')),
                trailing: IconButton(
                  tooltip: context.tr('timeline.copy'),
                  onPressed: () async {
                    final copied = context.tr('timeline.copied');
                    await Clipboard.setData(
                      ClipboardData(text: string(shipment['trackingNumber'])),
                    );
                    if (context.mounted) toast(context, copied);
                  },
                  icon: const Icon(Icons.copy),
                ),
              ),
            Text(
              context.tr('timeline.dispatched', {
                'date': dateText(shipment['shippedAt']),
              }),
            ),
          ],
          if (dispatched != null && min > 0 && max > 0 && status != 'DELIVERED')
            Notice(
              context.tr('timeline.estimatedRange', {
                'from': dateText(
                  dispatched.add(Duration(days: min)).toIso8601String(),
                ),
                'to': dateText(
                  dispatched.add(Duration(days: max)).toIso8601String(),
                ),
              }),
            )
          else if (min > 0 && max > 0 && shipment.isEmpty)
            Notice(context.tr('checkout.estimate', {'min': min, 'max': max})),
          if (shipment.isEmpty)
            Text(
              context.tr('timeline.courierLater'),
              style: const TextStyle(color: HelaColors.muted, fontSize: 12),
            ),
          for (final state in [
            'PLACED',
            'ACCEPTED',
            'PACKED',
            'SHIPPED',
            if (failed) 'DELIVERY_FAILED',
            'DELIVERED',
          ]) ...[
            for (final event in events.where((e) => e['toStatus'] == state))
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(
                  state == 'DELIVERY_FAILED'
                      ? Icons.error_outline
                      : Icons.check_circle_outline,
                  color: state == 'DELIVERY_FAILED'
                      ? HelaColors.danger
                      : HelaColors.teal,
                ),
                title: Text(
                  context.tr('status.$state', const {}, label(state)),
                ),
                subtitle: Text(
                  [
                    dateText(event['createdAt'], time: true),
                    if (string(event['reason']).isNotEmpty)
                      string(event['reason']),
                  ].join('\n'),
                ),
              ),
            if (!events.any((e) => e['toStatus'] == state))
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(
                  status == state
                      ? Icons.radio_button_checked
                      : Icons.radio_button_unchecked,
                  color: status == state ? HelaColors.teal : HelaColors.muted,
                ),
                title: Text(
                  context.tr('status.$state', const {}, label(state)),
                ),
              ),
          ],
          Text(
            context.tr('timeline.shopUpdates'),
            style: const TextStyle(fontSize: 12, color: HelaColors.muted),
          ),
        ],
      ],
    );
  }
}
