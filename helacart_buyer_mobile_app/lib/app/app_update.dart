import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../core/data/app_config.dart';
import '../core/data/json.dart';
import '../core/ui/external_links.dart';
import '../l10n/app_strings.dart';
import 'deep_links.dart';
import 'providers.dart';
import 'theme/helacart_theme.dart';

/// `GET /app-config` once per app start. Failures fall back to the
/// storefront's legal pages and never block the app.
final remoteAppConfigProvider = FutureProvider<RemoteAppConfig>((ref) async {
  try {
    final data = await ref.watch(repositoryProvider).read('/app-config');
    return RemoteAppConfig.fromJson(object(data), appLinkHost);
  } catch (_) {
    return RemoteAppConfig.fallback(appLinkHost);
  }
}, retry: (count, error) => null);

/// Legal links are always available (fallback while loading/offline).
final legalLinksProvider = Provider<LegalLinks>(
  (ref) =>
      ref.watch(remoteAppConfigProvider).value?.legal ??
      LegalLinks.fallback(appLinkHost),
);

/// Installed version from the platform, or `null` when unavailable (tests,
/// unsupported platforms).
final appVersionProvider = FutureProvider<String?>((ref) async {
  try {
    final info = await PackageInfo.fromPlatform();
    return info.version.isEmpty ? null : info.version;
  } catch (_) {
    return null;
  }
}, retry: (count, error) => null);

/// Force/optional update decision for Android and iOS store builds.
final updateStatusProvider = FutureProvider<UpdateStatus>((ref) async {
  if (kIsWeb || ref.watch(configProvider).preview) return UpdateStatus.none;
  final platform = defaultTargetPlatform;
  if (platform != TargetPlatform.android && platform != TargetPlatform.iOS) {
    return UpdateStatus.none;
  }
  final version = await ref.watch(appVersionProvider.future);
  if (version == null) return UpdateStatus.none;
  final config = await ref.watch(remoteAppConfigProvider.future);
  return evaluateUpdate(version, config.releaseFor(platform));
}, retry: (count, error) => null);

String storeUrlFor(UpdateStatus status) =>
    status.storeUrl ??
    (defaultTargetPlatform == TargetPlatform.android
        ? RemoteAppConfig.androidStoreUrl
        : 'https://$appLinkHost');

/// Blocking screen shown instead of the app below `minimumVersion`.
class UpdateRequiredScreen extends StatelessWidget {
  const UpdateRequiredScreen({super.key, required this.status});
  final UpdateStatus status;
  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(HelaSpacing.screen),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(
                Icons.system_update_outlined,
                size: 64,
                color: HelaColors.teal,
              ),
              const SizedBox(height: 20),
              Text(
                context.tr('update.requiredTitle'),
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 12),
              Text(
                context.tr('update.requiredBody'),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 28),
              FilledButton.icon(
                key: const ValueKey('update-required-store'),
                onPressed: () => openExternal(context, storeUrlFor(status)),
                icon: const Icon(Icons.open_in_new),
                label: Text(context.tr('update.action')),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

/// Dismissible top banner for a newer (not required) version.
void showOptionalUpdateBanner(
  ScaffoldMessengerState messenger,
  BuildContext context,
  UpdateStatus status,
) {
  messenger.showMaterialBanner(
    MaterialBanner(
      key: const ValueKey('update-available-banner'),
      backgroundColor: HelaColors.mint,
      leading: const Icon(Icons.system_update_outlined, color: HelaColors.teal),
      content: Text(context.tr('update.availableBody')),
      actions: [
        TextButton(
          onPressed: messenger.hideCurrentMaterialBanner,
          child: Text(context.tr('update.later')),
        ),
        TextButton(
          onPressed: () async {
            messenger.hideCurrentMaterialBanner();
            final failed = context.tr('legal.openFailed');
            if (!await launchHttps(storeUrlFor(status))) {
              messenger.showSnackBar(SnackBar(content: Text(failed)));
            }
          },
          child: Text(context.tr('update.action')),
        ),
      ],
    ),
  );
}
