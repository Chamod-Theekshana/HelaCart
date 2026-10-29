import 'package:material_ui/material_ui.dart';

abstract final class HelaColors {
  static const teal = Color(0xFF006B61), accent = Color(0xFF0D9488);
  static const navy = Color(0xFF0F172A), ink = Color(0xFF162435);
  static const muted = Color(0xFF64748B), canvas = Color(0xFFF7F9FF);
  static const wash = Color(0xFFEDF3FF), mint = Color(0xFFE8FAF5);
  static const border = Color(0xFFE2E8F0), cream = Color(0xFFF8F5EE);
  static const danger = Color(0xFFB91C1C);
  static const image = Color(0xFFF3F4F2), search = Color(0xFFF5F7F8);
}

abstract final class HelaSpacing {
  static const small = 8.0, item = 12.0, card = 16.0, screen = 20.0;
}

/// Compact visual controls retain native 48px touch targets.
ButtonStyle compactButtonStyle() => FilledButton.styleFrom(
  minimumSize: const Size(48, 40),
  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
  tapTargetSize: MaterialTapTargetSize.padded,
);

ThemeData helacartTheme() {
  final scheme = ColorScheme.fromSeed(seedColor: HelaColors.teal).copyWith(
    primary: HelaColors.teal,
    secondary: HelaColors.accent,
    surface: Colors.white,
    onSurface: HelaColors.ink,
    error: HelaColors.danger,
  );
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    fontFamily: 'Inter',
  );
  final heading = base.textTheme.apply(fontFamily: 'PlusJakartaSans');
  return base.copyWith(
    scaffoldBackgroundColor: Colors.white,
    textTheme: base.textTheme.copyWith(
      headlineLarge: heading.headlineLarge?.copyWith(
        fontSize: 28,
        height: 1.25,
        fontWeight: FontWeight.w700,
        color: HelaColors.navy,
      ),
      headlineMedium: heading.headlineMedium?.copyWith(
        fontSize: 24,
        height: 1.3,
        fontWeight: FontWeight.w700,
        color: HelaColors.navy,
      ),
      headlineSmall: heading.headlineSmall?.copyWith(
        fontSize: 22,
        height: 1.3,
        fontWeight: FontWeight.w700,
        color: HelaColors.navy,
      ),
      titleLarge: heading.titleLarge?.copyWith(
        fontSize: 18,
        height: 1.35,
        fontWeight: FontWeight.w700,
        color: HelaColors.navy,
      ),
      titleMedium: heading.titleMedium?.copyWith(
        fontSize: 15,
        height: 1.4,
        fontWeight: FontWeight.w600,
      ),
      titleSmall: heading.titleSmall?.copyWith(
        fontSize: 13,
        height: 1.4,
        fontWeight: FontWeight.w600,
      ),
      bodyLarge: base.textTheme.bodyLarge?.copyWith(fontSize: 14, height: 1.45),
      bodyMedium: base.textTheme.bodyMedium?.copyWith(
        fontSize: 14,
        height: 1.45,
      ),
      bodySmall: base.textTheme.bodySmall?.copyWith(
        fontSize: 12,
        color: HelaColors.muted,
        height: 1.45,
      ),
      labelLarge: base.textTheme.labelLarge?.copyWith(
        fontSize: 13,
        height: 1.3,
        fontWeight: FontWeight.w600,
      ),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.white,
      foregroundColor: HelaColors.navy,
      surfaceTintColor: Colors.transparent,
      centerTitle: false,
      toolbarHeight: 60,
      titleSpacing: 16,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      labelStyle: const TextStyle(fontSize: 14),
      hintStyle: const TextStyle(fontSize: 14, color: HelaColors.muted),
      helperStyle: const TextStyle(fontSize: 12, height: 1.4),
      errorMaxLines: 3,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: HelaColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: HelaColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: HelaColors.teal, width: 2),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(48, 48),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(
          fontFamily: 'Inter',
          fontWeight: FontWeight.w600,
          fontSize: 13,
          height: 1.3,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(48, 48),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        foregroundColor: HelaColors.teal,
        side: const BorderSide(color: HelaColors.border),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 13,
          height: 1.3,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(
        minimumSize: const Size(48, 48),
        iconSize: 21,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        minimumSize: const Size(48, 40),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        textStyle: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 13,
          height: 1.3,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
    listTileTheme: const ListTileThemeData(
      minTileHeight: 56,
      horizontalTitleGap: 12,
      minLeadingWidth: 24,
      titleTextStyle: TextStyle(
        fontFamily: 'Inter',
        fontSize: 14,
        height: 1.4,
        color: HelaColors.ink,
      ),
      subtitleTextStyle: TextStyle(
        fontFamily: 'Inter',
        fontSize: 12,
        height: 1.45,
        color: HelaColors.muted,
      ),
    ),
    chipTheme: base.chipTheme.copyWith(
      labelStyle: const TextStyle(
        fontFamily: 'Inter',
        fontSize: 12,
        color: HelaColors.ink,
      ),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      side: const BorderSide(color: HelaColors.border),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
    ),
    dialogTheme: const DialogThemeData(
      titleTextStyle: TextStyle(
        fontFamily: 'PlusJakartaSans',
        fontSize: 20,
        height: 1.3,
        fontWeight: FontWeight.w700,
        color: HelaColors.navy,
      ),
      contentTextStyle: TextStyle(
        fontFamily: 'Inter',
        fontSize: 14,
        height: 1.5,
        color: HelaColors.ink,
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: HelaColors.mint,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (s) => TextStyle(
          fontSize: 11,
          fontWeight: s.contains(WidgetState.selected)
              ? FontWeight.w700
              : FontWeight.w500,
          color: s.contains(WidgetState.selected)
              ? HelaColors.teal
              : HelaColors.muted,
        ),
      ),
    ),
    dividerTheme: const DividerThemeData(
      color: HelaColors.border,
      thickness: 1,
      space: 24,
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: Colors.white,
      showDragHandle: true,
    ),
  );
}
