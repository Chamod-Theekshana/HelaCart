import 'dart:async';

import 'app_update.dart';
import 'hc.dart';
import 'locale.dart';
import 'router.dart';
import '../core/data/app_config.dart';
import '../features/notifications/presentation/notifications_screen.dart';
import '../features/push/push_service.dart';

class HelaCartApp extends ConsumerStatefulWidget {
  const HelaCartApp({super.key});
  @override
  ConsumerState<HelaCartApp> createState() => _HelaCartAppState();
}

class _HelaCartAppState extends ConsumerState<HelaCartApp> {
  final messenger = GlobalKey<ScaffoldMessengerState>();
  late final AuthService auth = ref.read(authServiceProvider);
  late final PushService? push = ref.read(pushServiceProvider);
  DeviceRegistration? devices;
  bool bannerShown = false;

  @override
  void initState() {
    super.initState();
    final service = push;
    if (service != null) unawaited(startPush(service));
    ref.listenManual<AsyncValue<UpdateStatus>>(updateStatusProvider, (
      previous,
      next,
    ) {
      final status = next.value;
      if (status?.kind != UpdateKind.optional || bannerShown) return;
      bannerShown = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final state = messenger.currentState;
        if (mounted && state != null) {
          showOptionalUpdateBanner(state, context, status!);
        }
      });
    });
  }

  @override
  void dispose() {
    final registration = devices;
    if (registration != null) auth.removeSignOutHook(registration.unregister);
    push?.dispose();
    super.dispose();
  }

  /// §7: permission, token registration after sign-in and on refresh,
  /// unregister before sign-out, foreground banner and tap navigation.
  Future<void> startPush(PushService push) async {
    final available = await push.initialize();
    if (!mounted) return;
    ref.read(pushAvailableProvider.notifier).setAvailable(available);
    final registration = DeviceRegistration(
      platform: push.platform,
      token: () => push.token,
      appVersion: () async {
        if (!mounted) return '0.0.0';
        final version = await ref.read(appVersionProvider.future);
        return version ?? '0.0.0';
      },
      write: (path, body) =>
          ref.read(repositoryProvider).write(path, 'POST', body),
    );
    devices = registration;
    Future<void> sync() async {
      try {
        await registration.sync(auth.session?.uid);
      } catch (_) {
        /* Retried on the next sign-in or token refresh. */
      }
    }

    auth.addSignOutHook(registration.unregister);
    push.listen(
      onForeground: showForegroundPush,
      onOpened: openPush,
      onToken: (_) => unawaited(sync()),
    );
    ref.listenManual<AsyncValue<BuyerSession?>>(sessionProvider, (
      previous,
      next,
    ) {
      if (previous?.value?.uid != next.value?.uid) unawaited(sync());
    }, fireImmediately: true);
    final initial = await push.initialMessage();
    if (initial != null && mounted) {
      WidgetsBinding.instance.addPostFrameCallback((_) => openPush(initial));
    }
  }

  void refreshInbox() {
    ref.invalidate(
      resourceProvider((path: '/me/notifications/inbox', private: true)),
    );
    ref.invalidate(
      resourceProvider((
        path: '/workspace/me/notifications?page=1',
        private: true,
      )),
    );
  }

  void showForegroundPush(PushMessage message) {
    refreshInbox();
    final target = buyerNoticeTarget(message.notice);
    final strings = AppStrings.current;
    final text = [
      message.title,
      message.body,
    ].whereType<String>().where((s) => s.trim().isNotEmpty).join('\n');
    messenger.currentState?.showSnackBar(
      SnackBar(
        content: Text(text.isEmpty ? strings.t('push.newUpdate') : text),
        action: target == null
            ? null
            : SnackBarAction(
                label: strings.t('push.view'),
                onPressed: () => openPush(message),
              ),
      ),
    );
  }

  /// Opens the buyer-safe destination for a tapped notification and marks it
  /// read, using the same mapping as the in-app inbox.
  void openPush(PushMessage message) {
    refreshInbox();
    final id = message.notificationId;
    if (id != null && id.isNotEmpty) {
      unawaited(
        ref
            .read(repositoryProvider)
            .write('/me/notifications/${Uri.encodeComponent(id)}/read', 'PATCH')
            .then<void>((_) {}, onError: (Object _) {}),
      );
    }
    final target = buyerNoticeTarget(message.notice);
    if (target != null && mounted) ref.read(routerProvider).push(target);
  }

  @override
  Widget build(BuildContext context) {
    final locale = ref.watch(localeProvider);
    AppStrings.current = AppStrings.forLocale(locale);
    final update = ref.watch(updateStatusProvider).value;
    return MaterialApp.router(
      title: 'HelaCart',
      debugShowCheckedModeBanner: false,
      theme: helacartTheme(),
      locale: locale,
      supportedLocales: AppStrings.supportedLocales,
      localizationsDelegates: AppStrings.localizationsDelegates,
      scaffoldMessengerKey: messenger,
      routerConfig: ref.watch(routerProvider),
      builder: (context, child) => update?.kind == UpdateKind.required
          ? UpdateRequiredScreen(status: update!)
          : child ?? const SizedBox.shrink(),
    );
  }
}
