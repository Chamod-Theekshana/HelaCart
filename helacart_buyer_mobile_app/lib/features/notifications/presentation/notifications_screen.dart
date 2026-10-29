import 'dart:async';

import '../../../app/hc.dart';

String? buyerNoticeTarget(Json notice) {
  final href = string(notice['href']);
  if (href.startsWith('//') || RegExp(r'[\\\x00-\x1f]').hasMatch(href)) {
    return null;
  }
  final uri = Uri.tryParse(href);
  if (uri == null || uri.hasScheme || uri.hasAuthority) return null;
  final path = uri.path;
  if (RegExp(r'^/products/[^/]+$').hasMatch(path)) return path;
  if (RegExp(r'^/shops/[^/]+$').hasMatch(path)) return path;
  if (path == '/orders' || path == '/account') {
    return uri.queryParameters['order'] == null
        ? '/orders'
        : '/orders/${Uri.encodeComponent(uri.queryParameters['order']!)}';
  }
  if (path == '/account/support') {
    return uri.queryParameters['case'] == null
        ? '/support'
        : '/support/${Uri.encodeComponent(uri.queryParameters['case']!)}';
  }
  if (path == '/account/returns') return '/returns';
  if (path == '/favorites') return '/favorites';
  if (href.isEmpty && !string(notice['type']).startsWith('COMMISSION_')) {
    return string(notice['type']).startsWith('RETURN_')
        ? '/returns'
        : '/orders';
  }
  return null;
}

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});
  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  int page = 1;
  Timer? timer;
  @override
  void initState() {
    super.initState();
    timer = Timer.periodic(const Duration(seconds: 60), (_) {
      if (mounted && ref.read(sessionProvider).value != null) {
        ref.invalidate(
          resourceProvider((
            path: '/workspace/me/notifications?page=$page',
            private: true,
          )),
        );
      }
    });
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => PageFrame(
    title: 'Notifications',
    child: Protected(
      verified: false,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          ResponsiveActions(
            children: [
              ActionButton(
                label: 'Mark all as read',
                outlined: true,
                action: () async {
                  await ref
                      .read(repositoryProvider)
                      .write('/me/notifications/read-all', 'PATCH');
                  ref.invalidate(resourceProvider);
                },
              ),
              OutlinedButton.icon(
                onPressed: () => ref.invalidate(resourceProvider),
                icon: const Icon(Icons.refresh),
                label: const Text('Refresh'),
              ),
            ],
          ),
          verticalGap(),
          RemoteView(
            path: '/workspace/me/notifications?page=$page',
            private: true,
            builder: (c, data) => Column(
              children: [
                if (objects(data['items']).isEmpty)
                  const EmptyState(
                    title: 'You’re all caught up',
                    message: 'Order updates, support replies and enabled favorite alerts will appear here.',
                    icon: Icons.notifications_none,
                  ),
                for (final row in objects(data['items']))
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Panel(
                      color: row['readAt'] == null
                          ? HelaColors.mint
                          : Colors.white,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            string(row['message']),
                            style: TextStyle(
                              fontWeight: row['readAt'] == null
                                  ? FontWeight.w600
                                  : FontWeight.w400,
                            ),
                          ),
                          Text(
                            dateText(row['createdAt'], time: true),
                            style: Theme.of(c).textTheme.bodySmall,
                          ),
                          verticalGap(8),
                          ActionButton(
                            label: 'View update',
                            textOnly: true,
                            icon: Icons.arrow_forward,
                            action: () async {
                              await ref
                                  .read(repositoryProvider)
                                  .write(
                                    '/me/notifications/${row['id']}/read',
                                    'PATCH',
                                  );
                              ref.invalidate(resourceProvider);
                              final target = buyerNoticeTarget(row);
                              if (!context.mounted) return;
                              if (target == null) {
                                toast(
                                  context,
                                  'This destination is unavailable in the buyer app.',
                                );
                                return;
                              }
                              context.push(target);
                            },
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
