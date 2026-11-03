import 'dart:async';

import '../../../app/hc.dart';
import '../../checkout/presentation/checkout_screen.dart';

/// l10n key for a §3.1 phone/OTP error `code`, or `null` for other errors.
String? otpErrorKey(String? code) => switch (code) {
  'PHONE_INVALID' ||
  'OTP_RATE_LIMITED' ||
  'OTP_INVALID' ||
  'OTP_EXPIRED' => 'otp.$code',
  _ => null,
};

/// Buyer-facing message for a failed send/confirm. Branches on the stable
/// `code` (never the server `message`), with status fallbacks.
String otpErrorMessage(Object error, AppStrings strings) {
  if (error is AppFailure) {
    final key =
        otpErrorKey(error.code) ??
        switch (error.status) {
          429 => 'otp.OTP_RATE_LIMITED',
          410 => 'otp.OTP_EXPIRED',
          // Production without an SMS provider answers 503.
          503 => 'otp.unavailable',
          _ => null,
        };
    if (key != null) return strings.t(key);
  }
  return friendlyError(error);
}

/// SMS one-time-code verification of a Sri Lankan mobile number (§3.1).
/// Opened from checkout (PHONE_NOT_VERIFIED) and from saved addresses; pops
/// `true` once the number is verified.
class PhoneVerificationScreen extends ConsumerStatefulWidget {
  const PhoneVerificationScreen({super.key, this.phone});
  final String? phone;
  @override
  ConsumerState<PhoneVerificationScreen> createState() =>
      _PhoneVerificationScreenState();
}

class _PhoneVerificationScreenState
    extends ConsumerState<PhoneVerificationScreen> {
  late final phone = TextEditingController(text: widget.phone ?? '');
  final code = TextEditingController();
  PhoneVerification? verification;
  Timer? ticker;
  int wait = 0;

  @override
  void dispose() {
    ticker?.cancel();
    phone.dispose();
    code.dispose();
    super.dispose();
  }

  /// Counts down to the server's `resendAfter` (bounded against clock skew).
  void startCountdown(DateTime? resendAfter) {
    ticker?.cancel();
    final until =
        resendAfter?.toLocal() ??
        DateTime.now().add(const Duration(seconds: 60));
    void tick() {
      final left = until.difference(DateTime.now()).inSeconds.clamp(0, 120);
      setState(() => wait = left);
      if (left == 0) ticker?.cancel();
    }

    tick();
    ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) tick();
    });
  }

  Future<void> send() async {
    final strings = AppStrings.of(context);
    if (!isSriLankanMobile(phone.text)) {
      throw AppFailure(strings.t('phone.invalid'));
    }
    try {
      final result = PhoneVerification.fromJson(
        object(
          await ref.read(repositoryProvider).write(
            '/me/phone-verifications',
            'POST',
            {'phone': compactPhone(phone.text)},
          ),
        ),
      );
      if (result.id.isEmpty) throw AppFailure(strings.t('error.generic'));
      if (!mounted) return;
      setState(() {
        verification = result;
        code.clear();
      });
      startCountdown(result.resendAfter);
    } catch (e) {
      throw AppFailure(otpErrorMessage(e, strings));
    }
  }

  Future<void> confirm() async {
    final strings = AppStrings.of(context);
    final current = verification;
    if (current == null) return;
    final value = code.text.trim();
    if (!RegExp(r'^\d{6}$').hasMatch(value)) {
      throw AppFailure(strings.t('phone.codeFormat'));
    }
    try {
      final result = object(
        await ref.read(repositoryProvider).write(
          '/me/phone-verifications/${Uri.encodeComponent(current.id)}/confirm',
          'POST',
          {'code': value},
        ),
      );
      ref.invalidate(addressesProvider);
      ref.invalidate(quoteProvider);
      if (!mounted) return;
      toast(
        context,
        strings.t('phone.verified', {
          'phone': string(result['phone'], current.phone),
        }),
      );
      if (context.canPop()) {
        context.pop(true);
      } else {
        context.go('/account/addresses');
      }
    } catch (e) {
      if (e is AppFailure && e.code == 'OTP_EXPIRED' && mounted) {
        ticker?.cancel();
        setState(() => wait = 0);
      }
      throw AppFailure(otpErrorMessage(e, strings));
    }
  }

  @override
  Widget build(BuildContext context) {
    final sent = verification;
    return PageFrame(
      title: context.tr('phone.title'),
      child: Protected(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text(context.tr('phone.intro')),
            verticalGap(20),
            TextField(
              key: const ValueKey('otp-phone'),
              controller: phone,
              enabled: sent == null,
              keyboardType: TextInputType.phone,
              autofillHints: const [AutofillHints.telephoneNumber],
              maxLength: 20,
              decoration: InputDecoration(
                labelText: context.tr('phone.label'),
                hintText: context.tr('phone.hint'),
                counterText: '',
                prefixIcon: const Icon(Icons.phone_iphone),
              ),
            ),
            verticalGap(),
            if (sent == null)
              ActionButton(
                key: const ValueKey('otp-send'),
                label: context.tr('phone.send'),
                icon: Icons.sms_outlined,
                action: send,
              )
            else ...[
              Notice(context.tr('phone.sentTo', {'phone': sent.phone})),
              TextField(
                key: const ValueKey('otp-code'),
                controller: code,
                keyboardType: TextInputType.number,
                autofillHints: const [AutofillHints.oneTimeCode],
                maxLength: 6,
                decoration: InputDecoration(
                  labelText: context.tr('phone.code'),
                  counterText: '',
                  prefixIcon: const Icon(Icons.password),
                ),
              ),
              verticalGap(),
              ActionButton(
                key: const ValueKey('otp-verify'),
                label: context.tr('phone.verify'),
                icon: Icons.verified_user_outlined,
                action: confirm,
              ),
              verticalGap(8),
              ActionButton(
                key: const ValueKey('otp-resend'),
                label: wait > 0
                    ? context.tr('phone.resendIn', {'seconds': wait})
                    : context.tr('phone.resend'),
                outlined: true,
                enabled: wait == 0,
                action: send,
              ),
              TextButton(
                onPressed: () {
                  ticker?.cancel();
                  setState(() {
                    verification = null;
                    wait = 0;
                  });
                },
                child: Text(context.tr('phone.changeNumber')),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
