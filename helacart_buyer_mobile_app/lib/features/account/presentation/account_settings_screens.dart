import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../../app/hc.dart';
import '../../../app/locale.dart';
import '../../../core/ui/external_links.dart';
import '../../checkout/presentation/checkout_screen.dart';
import '../../push/push_service.dart';
import 'account_screen.dart';

/// Bottom sheet listing English / සිංහල / தமிழ்; the choice is saved.
Future<void> showLanguagePicker(BuildContext context, WidgetRef ref) async {
  final current = ref.read(localeProvider).languageCode;
  final selected = await showModalBottomSheet<String>(
    context: context,
    builder: (c) => SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(vertical: HelaSpacing.screen),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: HelaSpacing.screen,
              ),
              child: Text(
                c.tr('language.title'),
                style: Theme.of(c).textTheme.titleLarge,
              ),
            ),
            verticalGap(8),
            RadioGroup<String>(
              groupValue: current,
              onChanged: (value) => Navigator.pop(c, value),
              child: Column(
                children: [
                  for (final entry in AppStrings.languageNames.entries)
                    RadioListTile<String>(
                      key: ValueKey('language-${entry.key}'),
                      value: entry.key,
                      title: Text(entry.value),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
  );
  if (selected == null || selected == current) return;
  await ref.read(localeProvider.notifier).select(Locale(selected));
}

/// Push / email / SMS switches backed by `/me/notification-preferences` (§7).
class NotificationPreferencesScreen extends ConsumerWidget {
  const NotificationPreferencesScreen({super.key});
  static const path = '/me/notification-preferences';
  @override
  Widget build(BuildContext context, WidgetRef ref) => PageFrame(
    title: context.tr('prefs.title'),
    child: Protected(
      verified: false,
      child: RemoteView(
        path: path,
        private: true,
        builder: (c, data) => NotificationPreferencesForm(
          initial: NotificationPreferences.fromJson(data),
        ),
      ),
    ),
  );
}

class NotificationPreferencesForm extends ConsumerStatefulWidget {
  const NotificationPreferencesForm({super.key, required this.initial});
  final NotificationPreferences initial;
  @override
  ConsumerState<NotificationPreferencesForm> createState() =>
      _NotificationPreferencesFormState();
}

class _NotificationPreferencesFormState
    extends ConsumerState<NotificationPreferencesForm> {
  late var preferences = widget.initial;

  Future<void> save() async {
    final strings = AppStrings.of(context);
    final saved = object(
      await ref
          .read(repositoryProvider)
          .write(
            NotificationPreferencesScreen.path,
            'PUT',
            preferences.toJson(),
          ),
    );
    if (!mounted) return;
    if (saved.isNotEmpty) {
      setState(() => preferences = NotificationPreferences.fromJson(saved));
    }
    toast(context, strings.t('prefs.saved'));
  }

  @override
  Widget build(BuildContext context) {
    final pushBlocked =
        ref.watch(pushServiceProvider) != null &&
        !ref.watch(pushAvailableProvider);
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(context.tr('prefs.intro')),
        if (pushBlocked) Notice(context.tr('prefs.pushBlocked')),
        verticalGap(),
        for (final row in [
          (
            'prefs.push',
            'prefs.pushHint',
            Icons.notifications_active_outlined,
            preferences.push,
            (bool v) => preferences.copyWith(push: v),
          ),
          (
            'prefs.email',
            'prefs.emailHint',
            Icons.mail_outline,
            preferences.email,
            (bool v) => preferences.copyWith(email: v),
          ),
          (
            'prefs.sms',
            'prefs.smsHint',
            Icons.sms_outlined,
            preferences.sms,
            (bool v) => preferences.copyWith(sms: v),
          ),
        ])
          SwitchListTile(
            key: ValueKey(row.$1),
            contentPadding: EdgeInsets.zero,
            secondary: Icon(row.$3, color: HelaColors.teal),
            title: Text(context.tr(row.$1)),
            subtitle: Text(context.tr(row.$2)),
            value: row.$4,
            onChanged: (value) => setState(() => preferences = row.$5(value)),
          ),
        verticalGap(20),
        ActionButton(label: context.tr('prefs.save'), action: save),
      ],
    );
  }
}

/// PDPA data export (§8) and account deletion.
class PrivacyScreen extends ConsumerWidget {
  const PrivacyScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => PageFrame(
    title: context.tr('privacy.title'),
    child: Protected(
      verified: false,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Panel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  context.tr('privacy.exportTitle'),
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                verticalGap(8),
                Text(context.tr('privacy.exportBody')),
                verticalGap(),
                Builder(
                  builder: (button) => ActionButton(
                    key: const ValueKey('privacy-export'),
                    label: context.tr('privacy.exportAction'),
                    icon: Icons.download_outlined,
                    outlined: true,
                    action: () => exportMyData(button, ref),
                  ),
                ),
              ],
            ),
          ),
          verticalGap(),
          Panel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  context.tr('privacy.deleteTitle'),
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                verticalGap(8),
                Text(context.tr('privacy.deleteBody')),
                verticalGap(),
                ActionButton(
                  key: const ValueKey('privacy-delete'),
                  label: context.tr('privacy.deleteAction'),
                  icon: Icons.delete_forever_outlined,
                  outlined: true,
                  action: () => deleteMyAccount(context, ref),
                ),
              ],
            ),
          ),
          verticalGap(),
          const LegalLinksBar(),
        ],
      ),
    ),
  );
}

/// Downloads `GET /me/data-export` to a temporary JSON file and offers it
/// through the share sheet (save to Files/Drive, email, etc.).
Future<void> exportMyData(BuildContext context, WidgetRef ref) async {
  final strings = AppStrings.of(context);
  if (kIsWeb) throw AppFailure(strings.t('error.generic'));
  final box = context.findRenderObject();
  final origin = box is RenderBox && box.hasSize
      ? box.localToGlobal(Offset.zero) & box.size
      : null;
  final data = await ref
      .read(repositoryProvider)
      .read('/me/data-export', private: true);
  final json = data is String
      ? data
      : const JsonEncoder.withIndent('  ').convert(data);
  final directory = await getTemporaryDirectory();
  // Remove earlier exports so personal data does not accumulate in cache.
  await for (final entry in directory.list()) {
    final name = entry.uri.pathSegments.lastOrNull ?? '';
    if (entry is File &&
        name.startsWith('helacart-data-') &&
        name.endsWith('.json')) {
      await entry.delete().then<void>((_) {}, onError: (Object _) {});
    }
  }
  final name =
      'helacart-data-${DateTime.now().toIso8601String().substring(0, 10)}.json';
  final file = File('${directory.path}${Platform.pathSeparator}$name');
  await file.writeAsString(json, flush: true);
  await SharePlus.instance.share(
    ShareParams(
      files: [XFile(file.path, mimeType: 'application/json', name: name)],
      subject: strings.t('privacy.exportSubject'),
      sharePositionOrigin: origin,
    ),
  );
}

/// `DELETE /me/account` after typed confirmation, then local sign-out.
Future<void> deleteMyAccount(BuildContext context, WidgetRef ref) async {
  final strings = AppStrings.of(context);
  final confirmed = await promptDialog<bool>(
    context: context,
    builder: (c) => const DeleteAccountDialog(),
  );
  if (confirmed != true) return;
  final auth = ref.read(authServiceProvider);
  final owner = auth.session?.uid;
  try {
    await ref.read(repositoryProvider).write('/me/account', 'DELETE', {
      'confirm': 'DELETE',
    });
  } on AppFailure catch (e) {
    final key = switch (e.code) {
      'ACCOUNT_HAS_OPEN_ORDERS' || 'ACCOUNT_OWNS_SHOP' => 'error.${e.code}',
      _ => null,
    };
    if (key == null) rethrow;
    throw AppFailure(strings.t(key), status: e.status, code: e.code);
  }
  if (owner != null) {
    try {
      await ref.read(checkoutStoreProvider).clear(owner);
    } catch (_) {
      /* Recovery data is owner-scoped and unusable after deletion. */
    }
  }
  try {
    await auth.signOut();
  } catch (_) {
    /* The API already deleted the Firebase user; local sign-out is enough. */
  }
  refreshBuyer(ref);
  ref.invalidate(avatarProvider);
  if (context.mounted) {
    toast(context, strings.t('privacy.deleted'));
    context.go('/');
  }
}

class DeleteAccountDialog extends StatefulWidget {
  const DeleteAccountDialog({super.key});
  @override
  State<DeleteAccountDialog> createState() => _DeleteAccountDialogState();
}

class _DeleteAccountDialogState extends State<DeleteAccountDialog> {
  final typed = TextEditingController();
  @override
  void dispose() {
    typed.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ready = typed.text.trim() == 'DELETE';
    return AlertDialog(
      scrollable: true,
      title: Text(context.tr('privacy.deleteConfirmTitle')),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(context.tr('privacy.deleteConfirmBody')),
          verticalGap(),
          TextField(
            key: const ValueKey('delete-confirm-field'),
            controller: typed,
            autocorrect: false,
            enableSuggestions: false,
            textCapitalization: TextCapitalization.characters,
            decoration: InputDecoration(
              labelText: context.tr('privacy.deleteTypeLabel'),
            ),
            onChanged: (_) => setState(() {}),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: Text(context.tr('common.goBack')),
        ),
        FilledButton(
          key: const ValueKey('delete-confirm-button'),
          style: FilledButton.styleFrom(backgroundColor: HelaColors.danger),
          onPressed: ready ? () => Navigator.pop(context, true) : null,
          child: Text(context.tr('privacy.deleteConfirmAction')),
        ),
      ],
    );
  }
}
