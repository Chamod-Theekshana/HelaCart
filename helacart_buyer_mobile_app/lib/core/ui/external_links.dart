import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../app/app_update.dart';
import '../../app/deep_links.dart';
import '../../app/theme/helacart_theme.dart';
import '../../l10n/app_strings.dart';
import 'widgets.dart';

/// Launches an absolute https [url]; anything else is refused. Returns
/// whether the platform opened it.
Future<bool> launchHttps(String url, {bool inApp = false}) async {
  final uri = Uri.tryParse(url);
  if (uri == null || uri.scheme != 'https' || uri.host.isEmpty) return false;
  try {
    return await launchUrl(
      uri,
      mode: inApp
          ? LaunchMode.inAppBrowserView
          : LaunchMode.externalApplication,
    );
  } catch (_) {
    return false;
  }
}

/// Opens an https page outside the app (store, seller application) or in the
/// in-app browser view (policies) and reports failures with a snackbar.
Future<void> openExternal(
  BuildContext context,
  String url, {
  bool inApp = false,
}) async {
  final opened = await launchHttps(url, inApp: inApp);
  if (!opened && context.mounted) {
    toast(context, context.tr('legal.openFailed'));
  }
}

/// Privacy, terms and returns links from `GET /app-config` (§9), falling back
/// to the storefront's `/legal/*` pages while loading or offline.
class LegalLinksBar extends ConsumerWidget {
  const LegalLinksBar({super.key, this.alignment = WrapAlignment.center});
  final WrapAlignment alignment;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final legal = ref.watch(legalLinksProvider);
    return Wrap(
      alignment: alignment,
      spacing: 4,
      children: [
        for (final link in [
          ('legal.privacy', legal.privacyUrl),
          ('legal.terms', legal.termsUrl),
          ('legal.returns', legal.returnsUrl),
        ])
          TextButton(
            onPressed: () => openExternal(context, link.$2, inApp: true),
            child: Text(context.tr(link.$1)),
          ),
      ],
    );
  }
}

/// Opens the web seller application (sellers apply on the storefront).
Future<void> openSellerApplication(BuildContext context) =>
    openExternal(context, sellerApplicationUrl().toString());

/// Account-menu style list rows for policies and the seller application.
List<Widget> aboutHelaCartTiles(BuildContext context, WidgetRef ref) {
  final legal = ref.watch(legalLinksProvider);
  return [
    for (final row in [
      ('menu.sell', Icons.storefront_outlined, null),
      ('legal.privacy', Icons.privacy_tip_outlined, legal.privacyUrl),
      ('legal.terms', Icons.description_outlined, legal.termsUrl),
      ('legal.returns', Icons.assignment_return_outlined, legal.returnsUrl),
    ])
      ListTile(
        contentPadding: EdgeInsets.zero,
        minLeadingWidth: 24,
        leading: Icon(row.$2, color: HelaColors.teal, size: 21),
        title: Text(context.tr(row.$1), style: const TextStyle(fontSize: 13)),
        trailing: const Icon(Icons.open_in_new, size: 16),
        onTap: () => row.$3 == null
            ? openSellerApplication(context)
            : openExternal(context, row.$3!, inApp: true),
      ),
  ];
}
