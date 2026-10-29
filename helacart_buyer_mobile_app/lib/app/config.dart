import 'package:flutter/foundation.dart';

class AppConfig {
  const AppConfig({required this.apiUrl, this.preview = false});
  final String apiUrl;
  final bool preview;
  factory AppConfig.environment() {
    const configured = String.fromEnvironment('API_URL');
    const environment = String.fromEnvironment('APP_ENV', defaultValue: 'dev');
    const preview = bool.fromEnvironment('DESIGN_PREVIEW');
    final fallback = kIsWeb || defaultTargetPlatform != TargetPlatform.android
        ? 'http://localhost:4000/api/v1'
        : 'http://10.0.2.2:4000/api/v1';
    final url = configured.isEmpty ? fallback : configured;
    final uri = Uri.tryParse(url);
    if (uri == null ||
        !uri.hasAuthority ||
        !['http', 'https'].contains(uri.scheme)) {
      throw const FormatException('API_URL must be an absolute HTTP(S) URL.');
    }
    if ((kReleaseMode || environment == 'production') &&
        (uri.scheme != 'https' || preview)) {
      throw const FormatException('Production requires HTTPS and live data.');
    }
    return AppConfig(
      apiUrl: url.replaceAll(RegExp(r'/+$'), ''),
      preview: preview,
    );
  }
}
