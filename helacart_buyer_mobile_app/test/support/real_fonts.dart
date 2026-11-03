import 'package:flutter/services.dart';

/// The test default is Ahem, whose glyph widths hide real label wrapping.
Future<void> loadAppFonts() async {
  for (final font in {
    'Inter': 'assets/fonts/Inter.ttf',
    'PlusJakartaSans': 'assets/fonts/PlusJakartaSans.ttf',
    'MaterialIcons': 'fonts/MaterialIcons-Regular.otf',
  }.entries) {
    await (FontLoader(font.key)..addFont(rootBundle.load(font.value))).load();
  }
}
