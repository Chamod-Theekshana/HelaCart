import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../l10n/app_strings.dart';

const localePreferenceKey = 'helacart.locale';

/// Language chosen before the app starts (saved preference, else English).
/// Overridden in main.dart; tests keep the English default.
final initialLocaleProvider = Provider<Locale>((ref) => const Locale('en'));

class LocaleController extends Notifier<Locale> {
  @override
  Locale build() => ref.watch(initialLocaleProvider);

  Future<void> select(Locale locale) async {
    final strings = AppStrings.forLocale(locale);
    AppStrings.current = strings;
    state = strings.locale;
    try {
      await SharedPreferencesAsync().setString(
        localePreferenceKey,
        strings.locale.languageCode,
      );
    } catch (_) {
      /* The choice still applies for this session. */
    }
  }
}

final localeProvider = NotifierProvider<LocaleController, Locale>(
  LocaleController.new,
);

/// Reads the saved language; English when unset or storage is unavailable.
Future<Locale> loadSavedLocale() async {
  try {
    final code = await SharedPreferencesAsync().getString(localePreferenceKey);
    return AppStrings.forLocale(code == null ? null : Locale(code)).locale;
  } catch (_) {
    return const Locale('en');
  }
}
