import '../features/auth/presentation/auth_screen.dart';

/// Public web host for shared links and verified Android App Links / iOS
/// universal links (`--dart-define=APP_LINK_HOST=...`, default helacart.lk).
/// android/app/build.gradle.kts reads the same define for the intent filter.
const appLinkHost = String.fromEnvironment(
  'APP_LINK_HOST',
  defaultValue: 'helacart.lk',
);

const customLinkScheme = 'helacart';

final _publicSegment = RegExp(r'^[A-Za-z0-9_-]{1,128}$');

/// Parses an incoming platform link into an in-app location.
///
/// * `helacart://products/<id>` (host form) and `helacart:///products/<id>`
///   (path form) open any buyer destination that [safeDestination] allows.
/// * `https://<host>/products/<id>` and `https://<host>/shops/<slug>` open the
///   product or shop (only these public pages are claimed as App Links).
///
/// Returns `null` for anything that is not a supported HelaCart link.
String? deepLinkTarget(Uri uri, {String host = appLinkHost}) {
  final scheme = uri.scheme.toLowerCase();
  if (scheme == customLinkScheme) {
    final segments = [
      if (uri.host.isNotEmpty) uri.host,
      ...uri.pathSegments.where((segment) => segment.isNotEmpty),
    ];
    if (segments.isEmpty) return '/';
    final location = Uri(
      path: '/${segments.join('/')}',
      query: uri.hasQuery && uri.query.isNotEmpty ? uri.query : null,
    ).toString();
    return safeDestination(location);
  }
  final linkHost = uri.host.toLowerCase();
  final expected = host.toLowerCase();
  if (scheme == 'https' &&
      (linkHost == expected || linkHost == 'www.$expected')) {
    final segments = uri.pathSegments.where((s) => s.isNotEmpty).toList();
    if (segments.isEmpty) return '/';
    if (segments.length == 2 &&
        (segments.first == 'products' || segments.first == 'shops') &&
        _publicSegment.hasMatch(segments.last)) {
      return '/${segments.first}/${segments.last}';
    }
  }
  return null;
}

/// go_router top-level redirect for links that arrive with a scheme.
///
/// go_router matches routes on `uri.path`, so a link whose path already is
/// its target (`helacart:///products/1`, `https://<host>/products/1`) needs no
/// redirect. Anything else is rewritten to the canonical path form
/// `helacart:///<target>`, which then matches itself. This converges in one
/// hop whether or not the router resolves a redirect against the incoming
/// URI. In-app locations (no scheme) return `null` untouched.
String? deepLinkRedirect(Uri uri, {String host = appLinkHost}) {
  if (!uri.hasScheme) return null;
  final target = deepLinkTarget(uri, host: host) ?? '/';
  final pathIsMeaningful =
      uri.host.isEmpty ||
      (uri.scheme.toLowerCase() == 'https' &&
          deepLinkTarget(uri, host: host) != null);
  final current = Uri(
    path: uri.path.isEmpty ? '/' : uri.path,
    query: uri.hasQuery && uri.query.isNotEmpty ? uri.query : null,
  ).toString();
  if (pathIsMeaningful && current == target) return null;
  return '$customLinkScheme://$target';
}

/// Public https URL used when sharing a product.
Uri productShareUrl(String productId, {String host = appLinkHost}) =>
    Uri(scheme: 'https', host: host, pathSegments: ['products', productId]);

/// Public https URL used when sharing a shop.
Uri shopShareUrl(String slug, {String host = appLinkHost}) =>
    Uri(scheme: 'https', host: host, pathSegments: ['shops', slug]);

/// Web seller application (sellers apply on the web, not in the buyer app).
Uri sellerApplicationUrl({String host = appLinkHost}) =>
    Uri(scheme: 'https', host: host, path: '/seller/apply');
