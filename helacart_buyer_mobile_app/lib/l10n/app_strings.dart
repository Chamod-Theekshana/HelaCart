import 'package:flutter/foundation.dart';
import 'package:material_ui/material_ui.dart';

part 'strings_en.dart';
part 'strings_si.dart';
part 'strings_ta.dart';

/// Hand-written buyer-app strings for English, Sinhala and Tamil.
///
/// No gen-l10n code generation: every language is a plain `Map<String, String>`
/// with `{name}` placeholders. English is the source of truth and the fallback
/// for any key missing from another table (test/l10n_test.dart enforces that
/// Sinhala and Tamil define every English key with the same placeholders).
/// Money stays in the `Rs. 1,234.00` format in every language.
class AppStrings {
  const AppStrings._(this.locale, this._values);
  final Locale locale;
  final Map<String, String> _values;

  static const en = AppStrings._(Locale('en'), englishStrings);
  static const si = AppStrings._(Locale('si'), sinhalaStrings);
  static const ta = AppStrings._(Locale('ta'), tamilStrings);

  static const supportedLocales = [Locale('en'), Locale('si'), Locale('ta')];

  /// Language names shown in the picker, always in their own script.
  static const languageNames = {'en': 'English', 'si': 'සිංහල', 'ta': 'தமிழ்'};

  static const tables = {
    'en': englishStrings,
    'si': sinhalaStrings,
    'ta': tamilStrings,
  };

  /// Strings for code without a [BuildContext] (API/validation errors). The app
  /// keeps this in step with the selected locale.
  static AppStrings current = en;

  static AppStrings forLocale(Locale? locale) => switch (locale?.languageCode) {
    'si' => si,
    'ta' => ta,
    _ => en,
  };

  /// Falls back to [current] for widgets pumped without the app delegates.
  static AppStrings of(BuildContext context) =>
      Localizations.of<AppStrings>(context, AppStrings) ?? current;

  static const LocalizationsDelegate<AppStrings> delegate =
      _AppStringsDelegate();

  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates = [
    delegate,
    ...GlobalMaterialLocalizations.delegates,
    _FallbackMaterialLocalizationsDelegate(),
  ];

  /// Looks up [key] and fills `{placeholders}` from [args]. Unknown keys return
  /// [fallback] when given, otherwise the key itself (visible in QA).
  String t(
    String key, [
    Map<String, Object?> args = const {},
    String? fallback,
  ]) {
    var value = _values[key] ?? englishStrings[key] ?? fallback ?? key;
    for (final entry in args.entries) {
      value = value.replaceAll('{${entry.key}}', '${entry.value ?? ''}');
    }
    return value;
  }
}

extension AppStringsContext on BuildContext {
  AppStrings get strings => AppStrings.of(this);

  /// Translate [key] for the current locale. See [AppStrings.t].
  String tr(
    String key, [
    Map<String, Object?> args = const {},
    String? fallback,
  ]) => AppStrings.of(this).t(key, args, fallback);
}

class _AppStringsDelegate extends LocalizationsDelegate<AppStrings> {
  const _AppStringsDelegate();
  @override
  bool isSupported(Locale locale) =>
      AppStrings.tables.containsKey(locale.languageCode);
  @override
  Future<AppStrings> load(Locale locale) =>
      SynchronousFuture(AppStrings.forLocale(locale));
  @override
  bool shouldReload(_AppStringsDelegate old) => false;
}

/// Safety net: if the design-system package resolves Material localizations
/// through its own type, Sinhala/Tamil still get (English) Material labels
/// instead of a missing-localizations assertion. When the types are shared,
/// Flutter keeps the first supporting delegate (GlobalMaterialLocalizations).
class _FallbackMaterialLocalizationsDelegate
    extends LocalizationsDelegate<MaterialLocalizations> {
  const _FallbackMaterialLocalizationsDelegate();
  @override
  bool isSupported(Locale locale) => true;
  @override
  Future<MaterialLocalizations> load(Locale locale) =>
      DefaultMaterialLocalizations.load(locale);
  @override
  bool shouldReload(_FallbackMaterialLocalizationsDelegate old) => false;
}
