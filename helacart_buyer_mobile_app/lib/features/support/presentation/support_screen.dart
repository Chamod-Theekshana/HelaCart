import 'package:uuid/uuid.dart';

import '../../../app/hc.dart';
import '../../orders/presentation/orders_screen.dart';

const supportStatuses = [
  'ALL',
  'OPEN',
  'UNDER_REVIEW',
  'WAITING_BUYER',
  'WAITING_SELLER',
  'RESOLVED',
  'CLOSED',
];
const supportCategories = [
  'ORDER_ISSUE',
  'DELIVERY',
  'RETURN',
  'REFUND',
  'ACCOUNT',
  'OTHER',
];

class SupportScreen extends ConsumerStatefulWidget {
  const SupportScreen({super.key});
  @override
  ConsumerState<SupportScreen> createState() => _SupportScreenState();
}

class _SupportScreenState extends ConsumerState<SupportScreen> {
  int page = 1;
  String status = 'ALL', q = '';
  @override
  Widget build(BuildContext context) => PageFrame(
    title: 'Support cases',
    child: Protected(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          FilledButton.icon(
            onPressed: () => context.push('/support/new'),
            icon: const Icon(Icons.add),
            label: const Text('New case'),
          ),
          verticalGap(),
          TextField(
            maxLength: 80,
            decoration: const InputDecoration(
              counterText: '',
              labelText: 'Search case titles',
              prefixIcon: Icon(Icons.search),
            ),
            onSubmitted: (v) => setState(() {
              q = v.trim();
              page = 1;
            }),
          ),
          verticalGap(),
          DropdownButtonFormField<String>(
            initialValue: status,
            decoration: const InputDecoration(labelText: 'Case status'),
            isExpanded: true,
            items: supportStatuses
                .map((s) => DropdownMenuItem(value: s, child: Text(label(s))))
                .toList(),
            onChanged: (v) => setState(() {
              status = v!;
              page = 1;
            }),
          ),
          verticalGap(),
          RemoteView(
            path:
                '/me/after-sales/support?page=$page&status=$status&q=${Uri.encodeQueryComponent(q)}',
            private: true,
            builder: (c, data) => Column(
              children: [
                if (objects(data['items']).isEmpty)
                  const EmptyState(
                    title: 'No support cases',
                    message: 'Open a case when you need help with shopping, delivery or your account.',
                    icon: Icons.support_agent,
                  ),
                for (final row in objects(data['items']))
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Panel(
                      child: ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(string(row['title'])),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(label(string(row['category']))),
                            verticalGap(4),
                            StatusPill(string(row['status'])),
                            Text(
                              'Updated ${dateText(row['updatedAt'])}',
                              style: Theme.of(c).textTheme.bodySmall,
                            ),
                          ],
                        ),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => context.push('/support/${row['id']}'),
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

class NewSupportScreen extends ConsumerStatefulWidget {
  const NewSupportScreen({super.key, this.order});
  final String? order;
  @override
  ConsumerState<NewSupportScreen> createState() => _NewSupportScreenState();
}

class _NewSupportScreenState extends ConsumerState<NewSupportScreen> {
  final form = GlobalKey<FormState>();
  final title = TextEditingController(), body = TextEditingController();
  String category = 'ORDER_ISSUE';
  late String? order = widget.order;
  String? key, payload;
  @override
  void dispose() {
    title.dispose();
    body.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => PageFrame(
    title: 'New support case',
    child: Protected(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Notice(
            order == null
                ? 'A general case is private between you and HelaCart.'
                : 'This order-linked case is visible to you, the relevant shop and HelaCart.',
          ),
          if (order != null) Text('Linked package #${shortRef(order)}'),
          if (widget.order == null)
            RemoteView(
              path: '/workspace/me/orders?limit=20',
              private: true,
              builder: (c, data) {
                final packages = objects(data['items'])
                    .expand((o) => objects(o['sellerOrders']))
                    .toList();
                return DropdownButtonFormField<String>(
                  initialValue: order,
                  decoration: const InputDecoration(
                    labelText: 'Related shop order (optional)',
                  ),
                  isExpanded: true,
                  items: [
                    const DropdownMenuItem(
                      value: null,
                      child: Text('General question'),
                    ),
                    for (final p in packages)
                      DropdownMenuItem(
                        value: string(p['id']),
                        child: Text(
                          '${string(object(p['seller'])['name'])} · ${shortRef(p['id'])}',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                  onChanged: (v) => setState(() => order = v),
                );
              },
            ),
          const Text(
            'For older orders, open “Get support” from My orders.',
            style: TextStyle(fontSize: 12, color: HelaColors.muted),
          ),
          verticalGap(),
          Form(
            key: form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: category,
                  decoration: const InputDecoration(labelText: 'Category'),
                  items: supportCategories
                      .map(
                        (s) =>
                            DropdownMenuItem(value: s, child: Text(label(s))),
                      )
                      .toList(),
                  onChanged: (v) => setState(() => category = v!),
                ),
                verticalGap(),
                TextFormField(
                  controller: title,
                  maxLength: 150,
                  decoration: const InputDecoration(labelText: 'Case title'),
                  validator: (v) => requiredText(v, min: 5, max: 150),
                ),
                verticalGap(),
                TextFormField(
                  controller: body,
                  minLines: 4,
                  maxLines: 10,
                  maxLength: 4000,
                  decoration: const InputDecoration(
                    labelText: 'How can we help?',
                  ),
                  validator: (v) => requiredText(v, min: 10, max: 4000),
                ),
                verticalGap(),
                ActionButton(
                  label: 'Create case',
                  action: () async {
                    if (!form.currentState!.validate()) return;
                    final data = <String, dynamic>{
                      'title': title.text.trim(),
                      'category': category,
                      'body': body.text.trim(),
                      if (order != null) 'sellerOrderId': order,
                    };
                    if (payload != data.toString()) {
                      payload = data.toString();
                      key = const Uuid().v4();
                    }
                    final result = object(
                      await ref.read(repositoryProvider).write(
                        '/me/after-sales/support',
                        'POST',
                        {...data, 'requestKey': key},
                      ),
                    );
                    ref.invalidate(resourceProvider);
                    if (context.mounted) context.go('/support/${result['id']}');
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

class SupportConversationScreen extends StatelessWidget {
  const SupportConversationScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context) => PageFrame(
    title: 'Support conversation',
    child: Protected(
      child: RemoteView(
        path: '/me/after-sales/support/$id',
        private: true,
        builder: (c, data) => SupportConversation(id: id, detail: data),
      ),
    ),
  );
}

class SupportConversation extends ConsumerStatefulWidget {
  const SupportConversation({
    super.key,
    required this.id,
    required this.detail,
  });
  final String id;
  final Json detail;
  @override
  ConsumerState<SupportConversation> createState() =>
      _SupportConversationState();
}

class _SupportConversationState extends ConsumerState<SupportConversation> {
  final reply = TextEditingController();
  int page = 1;
  String? requestKey, payload;
  @override
  void dispose() {
    reply.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final closed = widget.detail['status'] == 'CLOSED';
    return Column(
      children: [
        Expanded(
          child: RemoteView(
            path: '/me/after-sales/support/${widget.id}/messages?page=$page',
            private: true,
            builder: (c, data) => ListView(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        string(widget.detail['title']),
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      verticalGap(8),
                      StatusPill(string(widget.detail['status'])),
                      if (widget.detail['resolution'] != null)
                        Notice(string(widget.detail['resolution'])),
                      ExpansionTile(
                        title: const Text('Case history'),
                        children: objects(widget.detail['events'])
                            .map(
                              (e) => ListTile(
                                title: Text(label(string(e['toStatus']))),
                                subtitle: Text(
                                  '${string(e['reason'])}\n${dateText(e['createdAt'], time: true)}',
                                ),
                              ),
                            )
                            .toList(),
                      ),
                    ],
                  ),
                ),
                Pager(
                  page: page,
                  pages: integer(data['pages'], 1),
                  change: (v) => setState(() => page = v),
                ),
                for (final message in objects(data['items']).reversed)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Panel(
                      color: message['authorRole'] == 'BUYER'
                          ? HelaColors.mint
                          : Colors.white,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${label(string(message['authorRole']))} · ${string(object(message['author'])['name'])}',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          verticalGap(8),
                          Text(string(message['body'])),
                          verticalGap(6),
                          Text(
                            dateText(message['createdAt'], time: true),
                            style: Theme.of(c).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: closed
              ? const Notice(
                  'This case is closed. HelaCart must reopen it before new replies can be sent.',
                )
              : Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: reply,
                      minLines: 1,
                      maxLines: 4,
                      maxLength: 4000,
                      decoration: const InputDecoration(
                        labelText: 'Your reply',
                      ),
                    ),
                    ActionButton(
                      label: widget.detail['status'] == 'RESOLVED'
                          ? 'Reply & reopen case'
                          : 'Send reply',
                      action: () async {
                        if (reply.text.trim().isEmpty) {
                          throw const AppFailure(
                            'Write a reply before sending.',
                          );
                        }
                        if (payload != reply.text.trim()) {
                          payload = reply.text.trim();
                          requestKey = const Uuid().v4();
                        }
                        await ref.read(repositoryProvider).write(
                          '/me/after-sales/support/${widget.id}/messages',
                          'POST',
                          {'requestKey': requestKey, 'body': reply.text.trim()},
                        );
                        reply.clear();
                        ref.invalidate(resourceProvider);
                      },
                    ),
                  ],
                ),
        ),
      ],
    );
  }
}
