import 'json.dart';
import 'models.dart';

// Plain, hand-written models for the November 2026 API contract
// (docs/API-CHANGES-2026-11.md). They wrap the generated freezed models
// instead of changing them, so the generated model files stay in sync.

/// A saved address plus the §3.1/§4 flags (`phoneVerified`, `isDefault`).
class SavedAddress {
  const SavedAddress(
    this.address, {
    this.phoneVerified = false,
    this.isDefault = false,
  });
  factory SavedAddress.fromJson(Json json) => SavedAddress(
    BuyerAddress.fromJson(json),
    phoneVerified: boolean(json['phoneVerified']),
    isDefault: boolean(json['isDefault']),
  );
  final BuyerAddress address;
  final bool phoneVerified, isDefault;
  String get id => address.id;
}

/// Known §3.2 checkout failure codes, also listed early in `checkoutBlockers`.
const checkoutBlockerCodes = {
  'PHONE_NOT_VERIFIED',
  'TOO_MANY_OPEN_ORDERS',
  'COD_LIMIT_EXCEEDED',
  'SELLER_SUSPENDED',
};

/// `GET /me/cart?addressId=` quote with the §3.2 `checkoutBlockers` list.
class CartQuote {
  const CartQuote(this.cart, {this.checkoutBlockers = const []});
  factory CartQuote.fromJson(Json json) => CartQuote(
    CartData.fromJson(json),
    checkoutBlockers: [
      for (final code
          in json['checkoutBlockers'] is List
              ? json['checkoutBlockers'] as List
              : const [])
        if (code is String && code.isNotEmpty) code,
    ],
  );
  final CartData cart;
  final List<String> checkoutBlockers;
  bool get blocked => checkoutBlockers.isNotEmpty;
}

/// `POST /me/phone-verifications` response (§3.1).
class PhoneVerification {
  const PhoneVerification({
    required this.id,
    required this.phone,
    this.expiresAt,
    this.resendAfter,
  });
  factory PhoneVerification.fromJson(Json json) => PhoneVerification(
    id: string(json['verificationId']),
    phone: string(json['phone']),
    expiresAt: DateTime.tryParse(string(json['expiresAt'])),
    resendAfter: DateTime.tryParse(string(json['resendAfter'])),
  );
  final String id, phone;
  final DateTime? expiresAt, resendAfter;
}

/// `GET|PUT /me/notification-preferences` (§7).
class NotificationPreferences {
  const NotificationPreferences({
    this.push = true,
    this.email = true,
    this.sms = true,
  });
  factory NotificationPreferences.fromJson(Json json) =>
      NotificationPreferences(
        push: json['push'] != false,
        email: json['email'] != false,
        sms: json['sms'] != false,
      );
  final bool push, email, sms;
  NotificationPreferences copyWith({bool? push, bool? email, bool? sms}) =>
      NotificationPreferences(
        push: push ?? this.push,
        email: email ?? this.email,
        sms: sms ?? this.sms,
      );
  Json toJson() => {'push': push, 'email': email, 'sms': sms};
}

/// Removes spaces, dashes and brackets so the API can normalise the number
/// (`07XXXXXXXX`, `7XXXXXXXX`, `947XXXXXXXX`, `+947XXXXXXXX`).
String compactPhone(String value) => value.replaceAll(RegExp(r'[\s()-]'), '');

/// Client-side pre-check for Sri Lankan mobile numbers (§3.1). The API stays
/// authoritative and answers `PHONE_INVALID` for anything else.
bool isSriLankanMobile(String value) =>
    RegExp(r'^(?:\+94|94|0)?7\d{8}$').hasMatch(compactPhone(value));
