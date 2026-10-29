import 'package:intl/intl.dart';
import 'package:timezone/timezone.dart' as tz;

String money(int minor) =>
    'Rs. ${NumberFormat('#,##0.00', 'en_LK').format(minor / 100)}';
String dateText(Object? input, {bool time = false}) {
  final date = DateTime.tryParse(input?.toString() ?? '');
  if (date == null) return 'Not available';
  final local = tz.TZDateTime.from(date, tz.getLocation('Asia/Colombo'));
  return DateFormat(time ? 'd MMM yyyy · h:mm a' : 'd MMM yyyy').format(local);
}

int? parseMinor(String value) {
  final normalized = value.trim();
  if (!RegExp(r'^\d+(\.\d{1,2})?$').hasMatch(normalized)) return null;
  final parts = normalized.split('.');
  final whole = int.tryParse(parts.first);
  if (whole == null || whole > 10000000) return null;
  final result =
      whole * 100 +
      int.parse(parts.length == 1 ? '0' : parts[1].padRight(2, '0'));
  return result <= 1000000000 ? result : null;
}
