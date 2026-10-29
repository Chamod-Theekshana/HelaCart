import 'package:uuid/uuid.dart';

import '../../../app/hc.dart';
import '../../orders/presentation/orders_screen.dart';

class AfterSalesScreen extends ConsumerStatefulWidget {
  const AfterSalesScreen({super.key, this.refunds = false});
  final bool refunds;
  @override
  ConsumerState<AfterSalesScreen> createState() => _AfterSalesScreenState();
}

class _AfterSalesScreenState extends ConsumerState<AfterSalesScreen> {
  int page = 1;
  String status = 'ALL';
  late bool refunds = widget.refunds;
  @override
  Widget build(BuildContext context) => PageFrame(
    title: 'Returns & refunds',
    child: Protected(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          SegmentedButton<bool>(
            segments: const [
              ButtonSegment(value: false, label: Text('Returns')),
              ButtonSegment(value: true, label: Text('Refund records')),
            ],
            selected: {refunds},
            onSelectionChanged: (v) => setState(() {
              refunds = v.first;
              page = 1;
              status = 'ALL';
            }),
          ),
          verticalGap(),
          Text(
            refunds
                ? 'Records of actual refunds submitted by your shop; verification is separate.'
                : 'Return selected items from an eligible delivered package in My orders.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          DropdownButton<String>(
            value: status,
            isExpanded: true,
            items: [
              for (final s in [
                'ALL',
                'PENDING',
                'APPROVED',
                'REJECTED',
                if (!refunds) 'RESOLVED',
              ])
                DropdownMenuItem(
                  value: s,
                  child: Text(refunds ? refundLabel(s, null) : label(s)),
                ),
            ],
            onChanged: (v) => setState(() {
              status = v!;
              page = 1;
            }),
          ),
          RemoteView(
            path:
                '/me/after-sales/${refunds ? 'refunds' : 'returns'}?page=$page&status=$status',
            private: true,
            builder: (c, data) => Column(
              children: [
                if (objects(data['items']).isEmpty)
                  EmptyState(
                    title: refunds ? 'No refund records' : 'No return requests',
                    message: refunds
                        ? 'Seller-submitted refunds will appear here.'
                        : 'Start an eligible return from a delivered order.',
                    icon: Icons.assignment_return_outlined,
                  ),
                for (final row in objects(data['items']))
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Panel(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            '${refunds ? 'Refund' : 'Return'} #${shortRef(row['id'])}',
                            style: Theme.of(c).textTheme.titleMedium,
                          ),
                          verticalGap(8),
                          Text(
                            refunds
                                ? refundLabel(
                                    string(row['status']),
                                    row['reversal'],
                                  )
                                : label(string(row['status'])),
                            style: const TextStyle(
                              color: HelaColors.teal,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          Text(
                            dateText(row['createdAt']),
                            style: Theme.of(c).textTheme.bodySmall,
                          ),
                          if (refunds)
                            MoneyRow(
                              'Recorded refund',
                              integer(row['amountMinor']),
                            )
                          else ...[
                            Text(
                              string(
                                object(
                                  object(row['sellerOrder'])['seller'],
                                )['name'],
                              ),
                            ),
                            for (final item in objects(row['items']))
                              Text(
                                '${item['quantity']} × ${string(object(item['orderItem'])['productTitle'])}',
                              ),
                          ],
                          OutlinedButton(
                            onPressed: () {
                              final owner = ref
                                  .read(sessionProvider)
                                  .value!
                                  .uid;
                              showModalBottomSheet<void>(
                                context: context,
                                isScrollControlled: true,
                                builder: (sheet) => AfterSalesDetailSheet(
                                  owner: owner,
                                  row: row,
                                  refund: refunds,
                                ),
                              );
                            },
                            child: const Text('View details'),
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

String refundLabel(String status, Object? reversal) => reversal != null
    ? 'Corrected record'
    : switch (status) {
        'ALL' => 'All statuses',
        'PENDING' => 'Awaiting HelaCart verification',
        'APPROVED' => 'Verified record',
        'REJECTED' => 'Rejected record',
        _ => label(status),
      };

class AfterSalesDetailSheet extends ConsumerWidget {
  const AfterSalesDetailSheet({
    super.key,
    required this.owner,
    required this.row,
    required this.refund,
  });
  final String owner;
  final Json row;
  final bool refund;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (ref.watch(sessionProvider).value?.uid != owner) {
      return const SafeArea(
        child: EmptyState(
          title: 'Account changed',
          message: 'Close this view and reopen it from your account.',
        ),
      );
    }
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(HelaSpacing.screen),
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(context).height * .82,
          ),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '${refund ? 'Refund record' : 'Return details'} #${shortRef(row['id'])}',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                verticalGap(),
                if (refund)
                  RefundDetails(row: row)
                else ...[
                  StatusPill(string(row['status'])),
                  verticalGap(),
                  Text('Submitted ${dateText(row['createdAt'])}'),
                  Text(string(row['reason'])),
                  for (final item in objects(row['items'])) ...[
                    verticalGap(),
                    Text(
                      '${item['quantity']} × ${string(object(item['orderItem'])['productTitle'])}',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    MoneyRow(
                      'Requested item value',
                      integer(item['baseMinor']),
                    ),
                    for (final record in objects(item['refunds']))
                      Panel(
                        color: HelaColors.wash,
                        child: RefundDetails(row: record),
                      ),
                  ],
                  if (row['reviewReason'] != null) ...[
                    const SectionTitle('Review decision'),
                    Text(string(row['reviewReason'])),
                  ],
                  if (row['outcome'] != null) ...[
                    const SectionTitle('Recorded outcome'),
                    Text(label(string(row['outcome']))),
                  ],
                  if (row['resolutionNote'] != null)
                    Text(string(row['resolutionNote'])),
                  const Notice(
                    'Return approval does not mean a refund has been paid. Refund records and their verification are separate.',
                  ),
                ],
                verticalGap(20),
                OutlinedButton(
                  onPressed: () {
                    Navigator.pop(context);
                    final order = refund
                        ? object(
                            object(
                              object(row['returnItem'])['returnRequest'],
                            )['sellerOrder'],
                          )
                        : object(row['sellerOrder']);
                    context.push(
                      '/support/new${order['id'] == null ? '' : '?order=${order['id']}'}',
                    );
                  },
                  child: const Text('Get support'),
                ),
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Close'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class RefundDetails extends StatelessWidget {
  const RefundDetails({super.key, required this.row});
  final Json row;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        refundLabel(string(row['status']), row['reversal']),
        style: const TextStyle(
          fontWeight: FontWeight.w700,
          color: HelaColors.teal,
        ),
      ),
      verticalGap(8),
      MoneyRow('Merchandise', integer(row['merchandiseMinor'])),
      MoneyRow('Delivery', integer(row['shippingMinor'])),
      MoneyRow('Recorded total', integer(row['amountMinor']), strong: true),
      Text('Method: ${label(string(row['method']))}'),
      Text('Recorded paid-on date: ${dateText(row['paidOn'])}'),
      Text('Reference: ${string(row['reference'])}'),
      if (row['note'] != null) Text(string(row['note'])),
      if (row['reviewedAt'] != null)
        Text('Reviewed ${dateText(row['reviewedAt'])}'),
      if (row['reviewNote'] != null) Text(string(row['reviewNote'])),
      if (row['reversal'] != null)
        Notice(
          'Record corrected: ${string(object(row['reversal'])['reason'])}. This correction does not transfer or recover money.',
        ),
      const Notice(
        'This is a record of money returned by the seller. The app does not initiate a bank transfer.',
      ),
    ],
  );
}

class ReturnRequestScreen extends StatelessWidget {
  const ReturnRequestScreen({super.key, required this.packageId});
  final String packageId;
  @override
  Widget build(BuildContext context) => PageFrame(
    title: 'Return selected items',
    child: Protected(
      child: RemoteView(
        path: '/me/after-sales/return-options/$packageId',
        private: true,
        builder: (c, data) => ReturnRequestForm(
          key: ValueKey(packageId),
          packageId: packageId,
          options: data,
        ),
      ),
    ),
  );
}

class ReturnRequestForm extends ConsumerStatefulWidget {
  const ReturnRequestForm({
    super.key,
    required this.packageId,
    required this.options,
  });
  final String packageId;
  final Json options;
  @override
  ConsumerState<ReturnRequestForm> createState() => _ReturnRequestFormState();
}

class _ReturnRequestFormState extends ConsumerState<ReturnRequestForm> {
  final quantities = <String, int>{};
  final reason = TextEditingController();
  final form = GlobalKey<FormState>();
  bool review = false;
  String? requestKey, payload;
  @override
  void dispose() {
    reason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.options['eligible'] != true) {
      return const EmptyState(
        title: 'This package is not eligible',
        message: 'The return deadline may have passed or no returnable quantities remain. Contact support if you need help.',
        icon: Icons.assignment_return_outlined,
      );
    }
    final items = objects(widget.options['items']);
    final selected = items
        .where((i) => (quantities[string(i['orderItemId'])] ?? 0) > 0)
        .toList();
    final value = selected.fold<int>(
      0,
      (total, i) =>
          total +
          integer(i['unitMinor']) * (quantities[string(i['orderItemId'])] ?? 0),
    );
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          review
              ? 'Why are you returning these items?'
              : 'Choose items and quantities',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        if (widget.options['closesAt'] != null)
          Notice(
            'Return deadline: ${dateText(widget.options['closesAt'], time: true)}',
          ),
        for (final item in review ? selected : items)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Panel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    string(item['productTitle']),
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  Text(
                    'Purchased ${item['quantity']} · Returnable ${item['remainingQuantity']}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  MoneyRow('Paid unit price', integer(item['unitMinor'])),
                  if (!review)
                    Row(
                      children: [
                        const Expanded(child: Text('Return quantity')),
                        IconButton(
                          tooltip: 'Return fewer',
                          onPressed:
                              (quantities[string(item['orderItemId'])] ?? 0) > 0
                              ? () => setState(
                                  () =>
                                      quantities[string(item['orderItemId'])] =
                                          (quantities[string(
                                                item['orderItemId'],
                                              )] ??
                                              0) -
                                          1,
                                )
                              : null,
                          icon: const Icon(Icons.remove_circle_outline),
                        ),
                        Text('${quantities[string(item['orderItemId'])] ?? 0}'),
                        IconButton(
                          tooltip: 'Return more',
                          onPressed:
                              (quantities[string(item['orderItemId'])] ?? 0) <
                                  integer(item['remainingQuantity'])
                              ? () => setState(
                                  () =>
                                      quantities[string(item['orderItemId'])] =
                                          (quantities[string(
                                                item['orderItemId'],
                                              )] ??
                                              0) +
                                          1,
                                )
                              : null,
                          icon: const Icon(Icons.add_circle_outline),
                        ),
                      ],
                    )
                  else
                    Text(
                      'Requested quantity: ${quantities[string(item['orderItemId'])]}',
                    ),
                ],
              ),
            ),
          ),
        MoneyRow('Requested merchandise value', value, strong: true),
        if (review) ...[
          verticalGap(),
          Form(
            key: form,
            child: TextFormField(
              controller: reason,
              minLines: 3,
              maxLines: 8,
              maxLength: 1000,
              decoration: const InputDecoration(labelText: 'Reason for return'),
              validator: (v) => requiredText(v, min: 10, max: 1000),
            ),
          ),
          const Notice(
            'HelaCart reviews this request. Submission does not approve a refund or arrange a pickup.',
          ),
          ActionButton(
            label: 'Submit return request',
            action: () async {
              if (!form.currentState!.validate()) return;
              final body = <String, dynamic>{
                'sellerOrderId': widget.packageId,
                'reason': reason.text.trim(),
                'items': selected
                    .map(
                      (i) => {
                        'orderItemId': i['orderItemId'],
                        'quantity': quantities[string(i['orderItemId'])],
                      },
                    )
                    .toList(),
              };
              final hash = body.toString();
              if (payload != hash) {
                requestKey = const Uuid().v4();
                payload = hash;
              }
              await ref.read(repositoryProvider).write('/me/returns', 'POST', {
                ...body,
                'requestKey': requestKey,
              });
              ref.invalidate(resourceProvider);
              if (context.mounted) context.go('/returns');
            },
          ),
          TextButton(
            onPressed: () => setState(() => review = false),
            child: const Text('Change selected items'),
          ),
        ] else
          FilledButton(
            onPressed: selected.isEmpty
                ? null
                : () => setState(() => review = true),
            child: const Text('Continue'),
          ),
      ],
    );
  }
}
