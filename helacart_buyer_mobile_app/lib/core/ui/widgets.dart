import 'package:cached_network_image/cached_network_image.dart';

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../app/providers.dart';
import '../../app/theme/helacart_theme.dart';
import '../../features/auth/data/auth_service.dart';
import '../../l10n/app_strings.dart';
import '../data/json.dart';
import '../data/format.dart';

class Brand extends StatelessWidget {
  const Brand({super.key});
  @override
  Widget build(BuildContext context) => Semantics(
    label: 'HelaCart',
    image: true,
    child: SizedBox(
      width: 140,
      height: 36,
      child: ClipRect(
        child: OverflowBox(
          minWidth: 148,
          maxWidth: 148,
          minHeight: 148,
          maxHeight: 148,
          child: Image.asset(
            'assets/brand/helacart-logo.png',
            width: 148,
            height: 148,
            excludeFromSemantics: true,
          ),
        ),
      ),
    ),
  );
}

class PageFrame extends StatelessWidget {
  const PageFrame({
    super.key,
    required this.title,
    required this.child,
    this.bottom,
    this.actions,
    this.brand = false,
    this.leading,
    this.drawer,
  });
  final String title;
  final Widget child;
  final Widget? bottom;
  final List<Widget>? actions;
  final bool brand;
  final Widget? leading, drawer;
  @override
  Widget build(BuildContext context) => Scaffold(
    drawer: drawer,
    appBar: AppBar(
      toolbarHeight: brand
          ? 60
          : (MediaQuery.textScalerOf(context).scale(18) * 2.4 + 12).clamp(
              56,
              104,
            ),
      leading: leading,
      centerTitle: brand,
      title: brand
          ? const Brand()
          : Text(
              title,
              maxLines: 2,
              style: Theme.of(context).textTheme.titleLarge,
            ),
      actions: actions,
    ),
    body: SafeArea(top: false, child: child),
    bottomNavigationBar: bottom == null
        ? null
        : DecoratedBox(
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: HelaColors.border)),
            ),
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 10, 20, 10),
                child: bottom,
              ),
            ),
          ),
  );
}

class Panel extends StatelessWidget {
  const Panel({
    super.key,
    required this.child,
    this.color = Colors.white,
    this.padding = const EdgeInsets.all(16),
  });
  final Widget child;
  final Color color;
  final EdgeInsets padding;
  @override
  Widget build(BuildContext context) => Material(
    color: color,
    shape: RoundedRectangleBorder(
      side: const BorderSide(color: HelaColors.border),
      borderRadius: BorderRadius.circular(14),
    ),
    child: Padding(padding: padding, child: child),
  );
}

class Notice extends StatelessWidget {
  const Notice(this.text, {super.key, this.error = false});
  final String text;
  final bool error;
  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: Container(
      width: double.infinity,
      margin: const EdgeInsets.symmetric(vertical: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: error ? const Color(0xFFFFF0ED) : HelaColors.mint,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: error ? HelaColors.danger : HelaColors.teal,
          fontSize: 12,
          height: 1.45,
        ),
      ),
    ),
  );
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.title,
    required this.message,
    this.icon = Icons.shopping_bag_outlined,
    this.action,
  });
  final String title, message;
  final IconData icon;
  final Widget? action;
  @override
  Widget build(BuildContext context) {
    final content = Padding(
      padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircleAvatar(
            radius: 28,
            backgroundColor: HelaColors.mint,
            child: Icon(icon, size: 26, color: HelaColors.teal),
          ),
          const SizedBox(height: 16),
          Text(
            title,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          Text(
            message,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall,
          ),
          if (action != null) ...[const SizedBox(height: 20), action!],
        ],
      ),
    );
    return LayoutBuilder(
      builder: (context, constraints) {
        // Inside a list the height is unbounded: centre horizontally only.
        if (!constraints.hasBoundedHeight) return Center(child: content);
        // As a whole page body, centre in the available area. Scrolls instead
        // of overflowing on short screens or with large text.
        return SingleChildScrollView(
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minWidth: constraints.hasBoundedWidth ? constraints.maxWidth : 0,
              minHeight: constraints.maxHeight,
            ),
            child: Center(child: content),
          ),
        );
      },
    );
  }
}

class LoadingBlocks extends StatelessWidget {
  const LoadingBlocks({super.key});
  @override
  Widget build(BuildContext context) => Semantics(
    label: context.tr('common.loading'),
    child: Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: List.generate(
          3,
          (i) => Container(
            height: i == 0 ? 120 : 70,
            margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(
              color: HelaColors.wash,
              borderRadius: BorderRadius.circular(16),
            ),
          ),
        ),
      ),
    ),
  );
}

class ErrorState extends StatelessWidget {
  const ErrorState(this.error, {super.key, required this.retry});
  final Object error;
  final VoidCallback retry;
  @override
  Widget build(BuildContext context) => EmptyState(
    title: context.tr('common.tryAgainTitle'),
    message: friendlyError(error),
    icon: Icons.wifi_off_rounded,
    action: OutlinedButton.icon(
      onPressed: retry,
      icon: const Icon(Icons.refresh),
      label: Text(context.tr('common.tryAgain')),
    ),
  );
}

class RemoteView extends ConsumerWidget {
  const RemoteView({
    super.key,
    required this.path,
    required this.builder,
    this.private = false,
  });
  final String path;
  final bool private;
  final Widget Function(BuildContext, Json) builder;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final key = (path: path, private: private);
    return ref
        .watch(resourceProvider(key))
        .when(
          // Pull-to-refresh keeps the current data instead of flashing the
          // skeleton. A changed account/key is a reload and still shows it.
          skipLoadingOnRefresh: true,
          skipLoadingOnReload: false,
          loading: () => const LoadingBlocks(),
          error: (e, _) =>
              ErrorState(e, retry: () => ref.invalidate(resourceProvider(key))),
          data: (data) => builder(context, object(data)),
        );
  }
}

/// Awaits a refreshed provider [future] for a [RefreshIndicator] without
/// rethrowing failures already rendered by the view's error state.
Future<void> refreshFuture(Future<Object?> future) async {
  try {
    await future;
  } catch (_) {
    /* RemoteView / AsyncValue UI renders the failure with a retry action. */
  }
}

/// Re-fetches one [RemoteView] resource for a [RefreshIndicator]. Errors are
/// shown by the view itself, so they are not rethrown to the indicator.
Future<void> refreshResource(
  WidgetRef ref,
  String path, {
  bool private = false,
}) => refreshFuture(
  ref.refresh(resourceProvider((path: path, private: private)).future),
);

class Protected extends ConsumerWidget {
  const Protected({super.key, required this.child, this.verified = true});
  final Widget child;
  final bool verified;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(sessionProvider);
    return state.when(
      skipLoadingOnReload: false,
      loading: () => const LoadingBlocks(),
      error: (e, _) =>
          ErrorState(e, retry: () => ref.invalidate(sessionProvider)),
      data: (user) {
        if (user == null) {
          return EmptyState(
            title: context.tr('common.protectedTitle'),
            message: context.tr('common.protectedMessage'),
            icon: Icons.person_outline,
            action: FilledButton(
              onPressed: () => context.push(
                '/auth?next=${Uri.encodeQueryComponent(GoRouterState.of(context).uri.toString())}',
              ),
              child: Text(context.tr('common.signIn')),
            ),
          );
        }
        if (verified && !user.verified) {
          return EmptyState(
            title: context.tr('common.verifyTitle'),
            message: context.tr('common.verifyMessage'),
            icon: Icons.mark_email_unread_outlined,
            action: FilledButton(
              onPressed: () => context.push(
                '/verify?next=${Uri.encodeQueryComponent(GoRouterState.of(context).uri.toString())}',
              ),
              child: Text(context.tr('common.verifyEmail')),
            ),
          );
        }
        return KeyedSubtree(key: ValueKey(user.uid), child: child);
      },
    );
  }
}

class _ActionButtonKey extends LocalKey {
  const _ActionButtonKey(this.inner);
  final Key inner;
  @override
  bool operator ==(Object other) =>
      other is _ActionButtonKey && other.inner == inner;
  @override
  int get hashCode => Object.hash(_ActionButtonKey, inner);
}

class ActionButton extends ConsumerStatefulWidget {
  ActionButton({
    Key? key,
    required this.label,
    required this.action,
    this.enabled = true,
    this.icon,
    this.outlined = false,
    this.compact = false,
    this.textOnly = false,
    this.destructive = false,
  }) : buttonKey = key,
       super(key: key == null ? null : _ActionButtonKey(key));
  final Key? buttonKey;
  final String label;
  final Future<void> Function() action;
  final bool enabled, outlined, compact, textOnly, destructive;
  final IconData? icon;
  @override
  ConsumerState<ActionButton> createState() => _ActionButtonState();
}

class _ActionButtonState extends ConsumerState<ActionButton> {
  bool busy = false;
  bool prompting = false;
  String? error;
  Future<void> run() async {
    if (busy) return;
    void setPrompting(bool value) {
      if (mounted && prompting != value) setState(() => prompting = value);
    }

    setState(() {
      busy = true;
      prompting = false;
      error = null;
    });
    try {
      final owner = ref.read(authServiceProvider).session?.uid;
      await runZoned(
        widget.action,
        zoneValues: {
          #helacartActionOwner: owner,
          #helacartActionPrompting: setPrompting,
        },
      );
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) {
        setState(() {
          busy = false;
          prompting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final loading = busy && !prompting;
    final content = Row(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (loading) ...[
          const SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
          const SizedBox(width: 10),
        ] else if (widget.icon != null) ...[
          Icon(widget.icon, size: 19),
          const SizedBox(width: 8),
        ],
        Flexible(
          child: Text(
            loading ? context.tr('common.pleaseWait') : widget.label,
            textAlign: TextAlign.center,
          ),
        ),
      ],
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        widget.textOnly
            ? TextButton(
                key: widget.buttonKey,
                style: TextButton.styleFrom(
                  alignment: Alignment.centerLeft,
                  padding: EdgeInsets.zero,
                  foregroundColor: widget.destructive
                      ? HelaColors.danger
                      : null,
                ),
                onPressed: busy || !widget.enabled ? null : run,
                child: content,
              )
            : widget.compact
            ? TextButton(
                key: widget.buttonKey,
                style: TextButton.styleFrom(
                  padding: EdgeInsets.zero,
                  alignment: Alignment.centerLeft,
                ),
                onPressed: busy || !widget.enabled ? null : run,
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        loading
                            ? context.tr('common.pleaseWait')
                            : widget.label,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      width: 30,
                      height: 30,
                      decoration: BoxDecoration(
                        border: Border.all(color: HelaColors.border),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: loading
                          ? const Padding(
                              padding: EdgeInsets.all(6),
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Icon(widget.icon ?? Icons.add, size: 17),
                    ),
                  ],
                ),
              )
            : widget.outlined
            ? OutlinedButton(
                key: widget.buttonKey,
                onPressed: busy || !widget.enabled ? null : run,
                child: content,
              )
            : FilledButton(
                key: widget.buttonKey,
                onPressed: busy || !widget.enabled ? null : run,
                child: content,
              ),
        if (error != null) Notice(error!, error: true),
      ],
    );
  }
}

/// Actions use their natural label widths, wrapping whole controls before
/// squeezing their text. Each action retains its own busy/error handling.
class ResponsiveActions extends StatelessWidget {
  const ResponsiveActions({super.key, required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Wrap(
    spacing: HelaSpacing.small,
    runSpacing: 4,
    crossAxisAlignment: WrapCrossAlignment.center,
    children: [for (final child in children) IntrinsicWidth(child: child)],
  );
}

class ProductPhoto extends StatelessWidget {
  const ProductPhoto(this.url, {super.key, this.fit = BoxFit.contain});
  final String? url;
  final BoxFit fit;
  @override
  Widget build(BuildContext context) {
    final fallback = Container(
      color: HelaColors.wash,
      child: const Center(
        child: Icon(
          Icons.inventory_2_outlined,
          color: HelaColors.muted,
          size: 32,
        ),
      ),
    );
    if (url?.startsWith('asset:') == true) {
      return Image.asset(
        url!.substring(6),
        fit: fit,
        errorBuilder: (_, _, _) => fallback,
      );
    }
    final uri = Uri.tryParse(url ?? '');
    if (uri == null || !['http', 'https'].contains(uri.scheme)) return fallback;
    return CachedNetworkImage(
      imageUrl: url!,
      fit: fit,
      placeholder: (_, _) => fallback,
      errorWidget: (_, _, _) => fallback,
      memCacheWidth: 800,
    );
  }
}

class MoneyRow extends StatelessWidget {
  const MoneyRow(this.title, this.amount, {super.key, this.strong = false});
  final String title;
  final int amount;
  final bool strong;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: LayoutBuilder(
      builder: (context, box) {
        final value = Text(
          money(amount),
          textAlign: TextAlign.end,
          style: TextStyle(
            fontWeight: strong ? FontWeight.w800 : FontWeight.w600,
            color: strong ? HelaColors.teal : null,
            fontSize: strong ? 18 : 14,
          ),
        );
        final style = DefaultTextStyle.of(context).style;
        final labelWidth = textWidth(context, title, style);
        final amountWidth = textWidth(
          context,
          money(amount),
          style.merge(value.style),
        );
        if (labelWidth + amountWidth + 12 > box.maxWidth) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [Text(title), const SizedBox(height: 4), value],
          );
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: Text(title)),
            const SizedBox(width: 12),
            value,
          ],
        );
      },
    ),
  );
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.title, {super.key, this.more, this.onMore});
  final String title;
  final String? more;
  final VoidCallback? onMore;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(
      top: more == null ? 20 : 12,
      bottom: more == null ? 10 : 4,
    ),
    child: OverflowBar(
      alignment: MainAxisAlignment.spaceBetween,
      spacing: 12,
      overflowSpacing: 0,
      overflowAlignment: OverflowBarAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleLarge),
        if (more != null)
          TextButton(
            style: TextButton.styleFrom(
              padding: const EdgeInsets.only(left: 8),
            ),
            onPressed: onMore,
            child: Text(more!, style: const TextStyle(fontSize: 12)),
          ),
      ],
    ),
  );
}

/// Measures the actual font and system text size for layouts that must keep
/// labels and currency amounts together.
double textWidth(BuildContext context, String text, TextStyle style) {
  final painter = TextPainter(
    text: TextSpan(text: text, style: style),
    textDirection: Directionality.of(context),
    textScaler: MediaQuery.textScalerOf(context),
    locale: Localizations.maybeLocaleOf(context),
  )..layout();
  final width = painter.width;
  painter.dispose();
  return width;
}

class StatusPill extends StatelessWidget {
  const StatusPill(this.status, {super.key});
  final String status;

  /// Statuses that end or interrupt delivery use the warning palette.
  static const attention = {
    'REJECTED',
    'CANCELLED',
    'DELIVERY_FAILED',
    'RETURNED_TO_SELLER',
  };
  @override
  Widget build(BuildContext context) {
    final warn = attention.contains(status);
    return Align(
      alignment: Alignment.centerLeft,
      widthFactor: 1,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: warn ? const Color(0xFFFFF0ED) : HelaColors.mint,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          context.tr('status.$status', const {}, label(status)),
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: warn ? HelaColors.danger : HelaColors.teal,
          ),
        ),
      ),
    );
  }
}

class Pager extends StatelessWidget {
  const Pager({
    super.key,
    required this.page,
    required this.pages,
    required this.change,
  });
  final int page, pages;
  final ValueChanged<int> change;
  @override
  Widget build(BuildContext context) => pages <= 1
      ? const SizedBox.shrink()
      : Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                tooltip: context.tr('common.previousPage'),
                onPressed: page > 1 ? () => change(page - 1) : null,
                icon: const Icon(Icons.chevron_left),
              ),
              Text(context.tr('common.pageOf', {'page': page, 'pages': pages})),
              IconButton(
                tooltip: context.tr('common.nextPage'),
                onPressed: page < pages ? () => change(page + 1) : null,
                icon: const Icon(Icons.chevron_right),
              ),
            ],
          ),
        );
}

/// Shows a modal dialog while pausing any enclosing [ActionButton] spinner so
/// background buttons stay disabled without spinning behind the dialog.
Future<T?> promptDialog<T>({
  required BuildContext context,
  required WidgetBuilder builder,
}) async {
  final setPrompting =
      Zone.current[#helacartActionPrompting] as void Function(bool)?;
  setPrompting?.call(true);
  try {
    return await showDialog<T>(context: context, builder: builder);
  } finally {
    setPrompting?.call(false);
  }
}

Future<bool> confirm(
  BuildContext context, {
  required String title,
  required String message,
  String? action,
}) async =>
    await promptDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        scrollable: true,
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: Text(c.tr('common.goBack')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(c, true),
            child: Text(action ?? c.tr('common.confirm')),
          ),
        ],
      ),
    ) ??
    false;
void toast(BuildContext context, String message) =>
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
Widget verticalGap([double size = HelaSpacing.item]) => SizedBox(height: size);
String? requiredText(String? value, {int min = 1, int max = 4000}) =>
    value == null || value.trim().length < min
    ? AppStrings.current.t('validation.minChars', {'min': min})
    : value.trim().length > max
    ? AppStrings.current.t('validation.maxChars', {'max': max})
    : null;
