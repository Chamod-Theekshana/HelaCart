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
    actions: [
      IconButton(
        tooltip: context.tr('common.refresh'),
        onPressed: () => ref.invalidate(resourceProvider),
        icon: const Icon(Icons.refresh_rounded),
      ),
    ],
    child: Protected(
      verified: false,
      child: ColoredBox(
        color: Colors.white,
        child: RefreshIndicator(
          onRefresh: () => refreshResource(ref, path, private: true),
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.only(bottom: 24),
            children: [
              RemoteView(
                path: path,
                private: true,
                builder: (c, data) {
                  final items = objects(data['items']);
                  final groups = <String, List<Json>>{};
                  for (final row in items) {
                    final date = DateTime.tryParse(string(row['createdAt']));
                    final label = date == null
                        ? c.tr('notifications.activity')
                        : dateText(row['createdAt']);
                    groups.putIfAbsent(label, () => []).add(row);
                  }
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (items.isNotEmpty) ...[
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Align(
                            alignment: Alignment.centerRight,
                            child: IntrinsicWidth(
                              child: ActionButton(
                                label: c.tr('notifications.markAll'),
                                icon: Icons.done_all_rounded,
                                textOnly: true,
                                action: () async {
                                  await ref
                                      .read(repositoryProvider)
                                      .write(
                                        '/me/notifications/read-all',
                                        'PATCH',
                                      );
                                  ref.invalidate(resourceProvider);
                                },
                              ),
                            ),
                          ),
                        ),
                      ],
                      if (items.isEmpty)
                        EmptyState(
                          title: c.tr('notifications.emptyTitle'),
                          message: c.tr('notifications.emptyMessage'),
                          icon: Icons.notifications_none_rounded,
                        ),
                      for (final group in groups.entries) ...[
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
                          child: Row(
                            children: [
                              Flexible(
                                child: Text(
                                  group.key,
                                  style: Theme.of(c).textTheme.bodySmall
                                      ?.copyWith(fontWeight: FontWeight.w600),
                                ),
                              ),
                              const SizedBox(width: 12),
                              const Expanded(child: Divider(height: 1)),
                            ],
                          ),
                        ),
                        for (final row in group.value)
                          _NotificationRow(
                            key: ValueKey(row['id']),
                            notice: row,
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
                      Pager(
                        page: page,
                        pages: integer(data['pages'], 1),
                        change: (v) => setState(() => page = v),
                      ),
                    ],
                  );
                },
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _NotificationRow extends ConsumerStatefulWidget {
  const _NotificationRow({
    super.key,
    required this.notice,
    required this.action,
  });

  final Json notice;
  final Future<void> Function() action;

  @override
  ConsumerState<_NotificationRow> createState() => _NotificationRowState();
}

class _NotificationRowState extends ConsumerState<_NotificationRow> {
  bool busy = false;
  String? error;

  Future<void> open() async {
    if (busy) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await runZoned(
        widget.action,
        zoneValues: {
          #helacartActionOwner: ref.read(authServiceProvider).session?.uid,
        },
      );
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  (IconData, String) get category {
    final type = string(widget.notice['type']);
    final target = buyerNoticeTarget(widget.notice) ?? '';
    if (type.startsWith('SUPPORT_') || target.startsWith('/support')) {
      return (Icons.chat_bubble_outline_rounded, 'notifications.support');
    }
    if (type.startsWith('RETURN_') ||
        type.startsWith('REFUND_') ||
        target == '/returns') {
      return (Icons.assignment_return_outlined, 'notifications.returns');
    }
    if (type.startsWith('FAVORITE_') ||
        target == '/favorites' ||
        target.startsWith('/products/') ||
        target.startsWith('/shops/')) {
      return (Icons.favorite_border_rounded, 'notifications.favorites');
    }
    if (type.startsWith('ORDER_') || target.startsWith('/orders')) {
      return (Icons.local_shipping_outlined, 'notifications.orders');
    }
    return (Icons.notifications_none_rounded, 'notifications.update');
  }

  @override
  Widget build(BuildContext context) {
    final notice = widget.notice;
    final unread = notice['readAt'] == null;
    final (icon, label) = category;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          button: true,
          label: unread ? context.tr('notifications.unread') : null,
          child: Material(
            color: unread
                ? HelaColors.mint.withValues(alpha: .55)
                : Colors.white,
            child: InkWell(
              onTap: busy ? null : open,
              child: Container(
                constraints: const BoxConstraints(minHeight: 80),
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
                decoration: const BoxDecoration(
                  border: Border(
                    bottom: BorderSide(color: HelaColors.border, width: .5),
                  ),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: unread ? HelaColors.mint : HelaColors.search,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        icon,
                        semanticLabel: context.tr(label),
                        color: HelaColors.teal,
                        size: 22,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            string(notice['message']),
                            style: Theme.of(context).textTheme.bodyMedium
                                ?.copyWith(
                                  fontWeight: unread
                                      ? FontWeight.w600
                                      : FontWeight.w400,
                                  color: HelaColors.ink,
                                ),
                          ),
                          verticalGap(4),
                          Text(
                            dateText(notice['createdAt'], time: true),
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(
                                  color: unread
                                      ? HelaColors.teal
                                      : HelaColors.muted,
                                ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Padding(
                      padding: const EdgeInsets.only(top: 16),
                      child: busy
                          ? SizedBox(
                              width: 12,
                              height: 12,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                semanticsLabel: context.tr('common.pleaseWait'),
                              ),
                            )
                          : Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color: unread
                                    ? HelaColors.accent
                                    : Colors.transparent,
                                shape: BoxShape.circle,
                              ),
                            ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Notice(error!, error: true),
          ),
      ],
    );
  }
}
