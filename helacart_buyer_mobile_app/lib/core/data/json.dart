typedef Json = Map<String, dynamic>;
Json object(Object? value) =>
    value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};
List<Json> objects(Object? value) =>
    value is List ? value.map(object).toList(growable: false) : const [];
String string(Object? value, [String fallback = '']) =>
    value is String ? value : fallback;
int integer(Object? value, [int fallback = 0]) =>
    value is num ? value.toInt() : fallback;
bool boolean(Object? value) => value == true;
String label(String value) => value
    .toLowerCase()
    .split('_')
    .map((s) => s.isEmpty ? s : '${s[0].toUpperCase()}${s.substring(1)}')
    .join(' ');
