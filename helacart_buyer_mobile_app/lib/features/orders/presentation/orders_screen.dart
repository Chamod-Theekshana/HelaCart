import 'package:flutter/services.dart';

import '../../../app/hc.dart';

class OrdersScreen extends ConsumerStatefulWidget {
  const OrdersScreen({super.key});
  @override
  ConsumerState<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends ConsumerState<OrdersScreen> {
  int page = 1;
  String query = '', status = '';
  @override
  Widget build(BuildContext context) => PageFrame(
    title: 'Your orders',
    actions: [
      IconButton(
        tooltip: 'Refresh orders',
        onPressed: () => ref.invalidate(resourceProvider),
        icon: const Icon(Icons.refresh),
      ),
    ],
    child: Protected(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          TextField(
            maxLength: 80,
            textInputAction: TextInputAction.search,
            decoration: const InputDecoration(
              counterText: '',
              labelText: 'Search reference or recipient',
              prefixIcon: Icon(Icons.search),
            ),
            onSubmitted: (v) => setState(() {
              query = v.trim();
              page = 1;
            }),
          ),
          verticalGap(),
          DropdownButtonFormField<String>(
            initialValue: status,
            decoration: const InputDecoration(labelText: 'Order status'),
            isExpanded: true,
            items: [
              const DropdownMenuItem(value: '', child: Text('All statuses')),
              for (final s in [
                'PLACED',
                'ACCEPTED',
                'PACKED',
                'SHIPPED',
                'DELIVERED',
                'CANCELLED',
              ])
                DropdownMenuItem(value: s, child: Text(label(s))),
            ],
            onChanged: (v) => setState(() {
              status = v!;
              page = 1;
            }),
          ),
          verticalGap(),
          RemoteView(
            path:
                '/workspace/me/orders?page=$page&q=${Uri.encodeQueryComponent(query)}${status.isEmpty ? '' : '&status=$status'}',
            private: true,
            builder: (c, data) => Column(
              children: [
                if (objects(data['items']).isEmpty)
                  EmptyState(
                    title: query.isEmpty && status.isEmpty
                        ? 'No orders yet'
                        : 'No matching orders',
                    message: 'Your confirmed orders will appear here.',
                    action: FilledButton(
                      onPressed: () => context.push('/products'),
                      child: const Text('Explore products'),
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
                            'Order #${shortRef(row['id'])}',
                            style: Theme.of(c).textTheme.titleMedium,
                          ),
                          Text(
                            dateText(row['createdAt']),
                            style: Theme.of(c).textTheme.bodySmall,
                          ),
                          MoneyRow(
                            'Original COD total',
                            integer(row['totalLkrMinor']),
                          ),
                          for (final shop in objects(row['sellerOrders']))
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 6),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      string(object(shop['seller'])['name']),
                                    ),
                                  ),
                                  StatusPill(string(shop['status'])),
                                ],
                              ),
                            ),
                          verticalGap(8),
                          OutlinedButton(
                            onPressed: () =>
                                context.push('/orders/${row['id']}'),
                            child: const Text('View order'),
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
  );
}

String shortRef(Object? value) {
  final s = string(value);
  return s.substring(0, s.length < 8 ? s.length : 8).toUpperCase();
}

class OrderDetailsScreen extends ConsumerWidget {
  const OrderDetailsScreen({super.key, required this.id, this.packageId});
  final String id;
  final String? packageId;
  @override
  Widget build(BuildContext context, WidgetRef ref) => PageFrame(
    title: packageId == null ? 'Order details' : 'Package tracking',
    actions: [
      IconButton(
        tooltip: 'Refresh order',
        onPressed: () => ref.invalidate(
          resourceProvider((path: '/me/orders/$id', private: true)),
        ),
        icon: const Icon(Icons.refresh),
      ),
    ],
    child: Protected(
      child: RemoteView(
        path: '/me/orders/$id',
        private: true,
        builder: (c, order) => ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text(
              'Order #${shortRef(id)}',
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
                  const Text(
                    'Delivery address',
                    style: TextStyle(fontWeight: FontWeight.w700),
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
            ).where((p) => packageId == null || p['id'] == packageId)) ...[
              SectionTitle(string(object(shop['seller'])['name'])),
              Panel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    StatusPill(string(shop['status'])),
                    verticalGap(),
                    for (final item in objects(shop['items']))
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              string(item['productTitle']),
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            Text(
                              '${object(item['optionValues']).values.join(' / ')} · Qty ${item['quantity']}',
                              style: Theme.of(c).textTheme.bodySmall,
                            ),
                            MoneyRow(
                              'Paid item value',
                              integer(item['lineLkrMinor']),
                            ),
                            if (shop['status'] == 'DELIVERED' &&
                                object(item['variant'])['productId'] != null)
                              TextButton(
                                onPressed: () => context.push(
                                  '/products/${object(item['variant'])['productId']}/reviews',
                                ),
                                child: const Text('Review this product'),
                              ),
                          ],
                        ),
                      ),
                    MoneyRow('Delivery', integer(shop['shippingLkrMinor'])),
                    MoneyRow(
                      'Original package total',
                      integer(shop['totalLkrMinor']),
                      strong: true,
                    ),
                    verticalGap(),
                    ShipmentTimeline(package: shop),
                    if (packageId == null)
                      OutlinedButton(
                        onPressed: () =>
                            context.push('/orders/$id/tracking/${shop['id']}'),
                        child: const Text('Package tracking'),
                      ),
                    if (shop['status'] == 'PLACED')
                      ActionButton(
                        label: 'Cancel this shop package',
                        outlined: true,
                        action: () async {
                          if (!await confirm(
                            context,
                            title: 'Cancel this package?',
                            message:
                                'Only items from ${string(object(shop['seller'])['name'])} will be cancelled. Other shop packages stay unchanged. Cancellation is available before acceptance.',
                            action: 'Cancel package',
                          )) {
                            return;
                          }
                          await ref
                              .read(repositoryProvider)
                              .write(
                                '/me/orders/$id/seller-orders/${shop['id']}/cancel',
                                'PATCH',
                              );
                          ref.invalidate(resourceProvider);
                        },
                      ),
                    if (shop['status'] == 'DELIVERED') ...[
                      OutlinedButton(
                        onPressed: () =>
                            context.push('/returns/new/${shop['id']}'),
                        child: const Text('Return selected items'),
                      ),
                      if (object(shop['seller'])['slug'] != null)
                        TextButton(
                          onPressed: () => context.push(
                            '/shops/${object(shop['seller'])['slug']}/reviews',
                          ),
                          child: const Text('Review this shop'),
                        ),
                    ],
                    TextButton(
                      onPressed: () =>
                          context.push('/support/new?order=${shop['id']}'),
                      child: const Text('Get support for this package'),
                    ),
                  ],
                ),
              ),
            ],
            verticalGap(20),
            Panel(
              color: HelaColors.mint,
              child: Column(
                children: [
                  const Text('Cash on delivery'),
                  MoneyRow(
                    'Original order total',
                    integer(order['totalLkrMinor']),
                    strong: true,
                  ),
                  const Text(
                    'Cancellations and refund records are shown separately; original purchase totals are retained.',
                    style: TextStyle(fontSize: 12),
                  ),
                ],
              ),
            ),
            verticalGap(24),
          ],
        ),
      ),
    ),
  );
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Delivery progress',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        verticalGap(10),
        if (status == 'CANCELLED')
          const Notice('This package was cancelled.')
        else ...[
          if (shipment.isNotEmpty) ...[
            Text(
              string(shipment['courierName']),
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            if (string(shipment['trackingNumber']).isNotEmpty)
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(string(shipment['trackingNumber'])),
                subtitle: const Text('Courier reference'),
                trailing: IconButton(
                  tooltip: 'Copy tracking reference',
                  onPressed: () async {
                    await Clipboard.setData(
                      ClipboardData(text: string(shipment['trackingNumber'])),
                    );
                    if (context.mounted) {
                      toast(context, 'Tracking reference copied.');
                    }
                  },
                  icon: const Icon(Icons.copy),
                ),
              ),
            Text('Dispatched ${dateText(shipment['shippedAt'])}'),
          ],
          if (dispatched != null && min > 0 && max > 0 && status != 'DELIVERED')
            Notice(
              'Estimated ${dateText(dispatched.add(Duration(days: min)).toIso8601String())} – ${dateText(dispatched.add(Duration(days: max)).toIso8601String())}.',
            )
          else if (min > 0 && max > 0 && shipment.isEmpty)
            Notice('Estimated $min–$max calendar days after dispatch.'),
          if (shipment.isEmpty)
            const Text(
              'Courier details appear when the shop dispatches your package.',
              style: TextStyle(color: HelaColors.muted, fontSize: 12),
            ),
          for (final state in [
            'PLACED',
            'ACCEPTED',
            'PACKED',
            'SHIPPED',
            'DELIVERED',
          ]) ...[
            for (final event in events.where((e) => e['toStatus'] == state))
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(
                  Icons.check_circle_outline,
                  color: HelaColors.teal,
                ),
                title: Text(label(state)),
                subtitle: Text(dateText(event['createdAt'], time: true)),
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
                title: Text(label(state)),
              ),
          ],
          const Text(
            'Delivery updates are provided by the shop.',
            style: TextStyle(fontSize: 12, color: HelaColors.muted),
          ),
        ],
      ],
    );
  }
}
