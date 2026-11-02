import 'dart:async';

import '../../../app/hc.dart';
import '../../push/push_service.dart';

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
  String get path => '/workspace/me/notifications?page=$page';
  @override
  void initState() {
    super.initState();
    // Polling is the fallback when push notifications are unavailable.
    timer = Timer.periodic(const Duration(seconds: 60), (_) {
      if (mounted &&
          !ref.read(pushAvailableProvider) &&
          ref.read(sessionProvider).value != null) {
        ref.invalidate(resourceProvider((path: path, private: true)));
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
    title: context.tr('notifications.title'),
    child: Protected(
      verified: false,
      child: RefreshIndicator(
        onRefresh: () => refreshResource(ref, path, private: true),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(20),
          children: [
            ResponsiveActions(
              children: [
                ActionButton(
                  label: context.tr('notifications.markAll'),
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
                  label: Text(context.tr('common.refresh')),
                ),
              ],
            ),
            verticalGap(),
            RemoteView(
              path: path,
              private: true,
              builder: (c, data) => Column(
                children: [
                  if (objects(data['items']).isEmpty)
                    EmptyState(
                      title: c.tr('notifications.emptyTitle'),
                      message: c.tr('notifications.emptyMessage'),
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
                              label: c.tr('notifications.view'),
                              textOnly: true,
                              icon: Icons.arrow_forward,
                              action: () async {
                                final unavailable = c.tr(
                                  'notifications.unavailable',
                                );
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
                                  toast(context, unavailable);
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
    ),
  );
}
