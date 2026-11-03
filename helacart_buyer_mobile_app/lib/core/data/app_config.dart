import 'package:flutter/foundation.dart';

import 'json.dart';

/// Store release policy for one platform from `GET /app-config` (§9).
class PlatformRelease {
  const PlatformRelease({
    this.minimumVersion,
    this.latestVersion,
    this.storeUrl,
  });
  factory PlatformRelease.fromJson(Json json) => PlatformRelease(
    minimumVersion: _version(json['minimumVersion']),
    latestVersion: _version(json['latestVersion']),
    storeUrl: httpsUrl(json['storeUrl']),
  );
  final String? minimumVersion, latestVersion, storeUrl;
}

/// Published policy pages. Always populated: API values when valid, otherwise
/// the web storefront's `/legal/*` pages on [host].
class LegalLinks {
  const LegalLinks({
    required this.privacyUrl,
    required this.termsUrl,
    required this.returnsUrl,
  });
  factory LegalLinks.fallback(String host) => LegalLinks(
    privacyUrl: 'https://$host/legal/privacy',
    termsUrl: 'https://$host/legal/terms',
    returnsUrl: 'https://$host/legal/returns',
  );
  factory LegalLinks.fromJson(Json json, String host) {
    final fallback = LegalLinks.fallback(host);
    return LegalLinks(
      privacyUrl: httpsUrl(json['privacyUrl']) ?? fallback.privacyUrl,
      termsUrl: httpsUrl(json['termsUrl']) ?? fallback.termsUrl,
      returnsUrl: httpsUrl(json['returnsUrl']) ?? fallback.returnsUrl,
    );
  }
  final String privacyUrl, termsUrl, returnsUrl;
}

/// `GET /app-config` (public, cacheable). Every field tolerates absence.
class RemoteAppConfig {
  const RemoteAppConfig({
    required this.legal,
    this.android,
    this.ios,
    this.supportEmail,
    this.supportPhone,
  });
  factory RemoteAppConfig.fallback(String host) => RemoteAppConfig(
    legal: LegalLinks.fallback(host),
    android: const PlatformRelease(storeUrl: androidStoreUrl),
  );
  factory RemoteAppConfig.fromJson(Json json, String host) => RemoteAppConfig(
    legal: LegalLinks.fromJson(object(json['legal']), host),
    android: json['android'] is Map
        ? PlatformRelease.fromJson(object(json['android']))
        : const PlatformRelease(storeUrl: androidStoreUrl),
    ios: json['ios'] is Map
        ? PlatformRelease.fromJson(object(json['ios']))
        : null,
    supportEmail: _nonEmpty(object(json['support'])['email']),
    supportPhone: _nonEmpty(object(json['support'])['phone']),
  );
  static const androidStoreUrl =
      'https://play.google.com/store/apps/details?id=com.helacart.buyer';
  final LegalLinks legal;
  final PlatformRelease? android, ios;
  final String? supportEmail, supportPhone;

  PlatformRelease? releaseFor(TargetPlatform platform) => switch (platform) {
    TargetPlatform.android => android,
    TargetPlatform.iOS => ios,
    _ => null,
  };
}

/// Only absolute https URLs from configuration are opened.
String? httpsUrl(Object? value) {
  final uri = Uri.tryParse(string(value).trim());
  return uri != null && uri.scheme == 'https' && uri.host.isNotEmpty
      ? uri.toString()
      : null;
}

String? _nonEmpty(Object? value) {
  final text = string(value).trim();
  return text.isEmpty ? null : text;
}

String? _version(Object? value) =>
    RegExp(r'^\d+(\.\d+){0,2}').hasMatch(string(value).trim())
    ? string(value).trim()
    : null;

/// Semantic comparison of `major.minor.patch` versions. Pre-release/build
/// suffixes (`-beta`, `+2`) are ignored and missing parts count as zero, so
/// `1.10.0 > 1.9.9` and `1.1 == 1.1.0`. Returns <0, 0 or >0.
int compareVersions(String a, String b) {
  List<int> parts(String value) {
    final core = value.trim().split(RegExp(r'[-+]')).first;
    final numbers = core
        .split('.')
        .map((part) => int.tryParse(part.trim()) ?? 0)
        .toList();
    while (numbers.length < 3) {
      numbers.add(0);
    }
    return numbers;
  }

  final left = parts(a), right = parts(b);
  final length = left.length > right.length ? left.length : right.length;
  for (var i = 0; i < length; i++) {
    final x = i < left.length ? left[i] : 0;
    final y = i < right.length ? right[i] : 0;
    if (x != y) return x.compareTo(y);
  }
  return 0;
}

enum UpdateKind { none, optional, required }

class UpdateStatus {
  const UpdateStatus(this.kind, {this.storeUrl, this.latestVersion});
  static const none = UpdateStatus(UpdateKind.none);
  final UpdateKind kind;
  final String? storeUrl, latestVersion;
}

/// Below `minimumVersion` blocks the app; below `latestVersion` suggests an
/// update. Unknown versions never block.
UpdateStatus evaluateUpdate(String? currentVersion, PlatformRelease? release) {
  if (currentVersion == null || currentVersion.isEmpty || release == null) {
    return UpdateStatus.none;
  }
  final minimum = release.minimumVersion, latest = release.latestVersion;
  if (minimum != null && compareVersions(currentVersion, minimum) < 0) {
    return UpdateStatus(
      UpdateKind.required,
      storeUrl: release.storeUrl,
      latestVersion: latest ?? minimum,
    );
  }
  if (latest != null && compareVersions(currentVersion, latest) < 0) {
    return UpdateStatus(
      UpdateKind.optional,
      storeUrl: release.storeUrl,
      latestVersion: latest,
    );
  }
  return UpdateStatus.none;
}
