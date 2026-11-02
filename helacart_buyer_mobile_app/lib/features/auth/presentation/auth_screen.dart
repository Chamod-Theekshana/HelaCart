import '../../../app/hc.dart';
import '../../../core/ui/external_links.dart';

String safeDestination(String? destination) {
  if (destination == null ||
      !destination.startsWith('/') ||
      destination.startsWith('//') ||
      RegExp(r'[\\\x00-\x1f]').hasMatch(destination)) {
    return '/';
  }
  final uri = Uri.tryParse(destination);
  if (uri == null || uri.hasAuthority || uri.hasScheme) return '/';
  if (uri.pathSegments.any(
    (segment) =>
        segment == '..' ||
        segment == '.' ||
        segment.contains('/') ||
        segment.contains('\\') ||
        RegExp(r'[\x00-\x1f]').hasMatch(segment),
  )) {
    return '/';
  }
  return RegExp(
        r'^/(?:$|products(?:/[^/]+(?:/reviews)?)?|categories|search|offers|shops(?:/[^/]+(?:/(?:products|reviews))?)?|favorites|cart|checkout|orders(?:/[^/]+(?:/tracking/[^/]+)?)?|order-success/[^/]+|account(?:/(?:profile|addresses(?:/new|/[^/]+/edit)?|security(?:/(?:password|email))?|reviews|phone|notification-preferences|privacy))?|notifications|returns(?:/new/[^/]+)?|refunds|support(?:/[^/]+)?|help)$',
      ).hasMatch(uri.path)
      ? destination
      : '/';
}

class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({
    super.key,
    this.mode = 'sign-in',
    this.next,
    this.favorite,
  });
  final String mode;
  final String? next, favorite;
  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen> {
  final form = GlobalKey<FormState>();
  final email = TextEditingController(),
      password = TextEditingController(),
      confirmation = TextEditingController();
  bool obscure = true;
  String? sent;
  @override
  void dispose() {
    email.dispose();
    password.dispose();
    confirmation.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final register = widget.mode == 'register', reset = widget.mode == 'reset';
    final service = ref.watch(authServiceProvider);
    final next = safeDestination(widget.next);
    return PageFrame(
      title: context.tr(
        reset
            ? 'auth.resetTitle'
            : register
            ? 'auth.registerTitle'
            : 'auth.signInTitle',
      ),
      child: ListView(
        padding: const EdgeInsets.all(HelaSpacing.screen),
        children: [
          const Brand(),
          verticalGap(24),
          Text(
            context.tr(
              reset
                  ? 'auth.resetHeadline'
                  : register
                  ? 'auth.registerHeadline'
                  : 'auth.signInHeadline',
            ),
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          verticalGap(10),
          Text(
            context.tr(reset ? 'auth.resetBody' : 'auth.body'),
            style: Theme.of(context).textTheme.bodySmall,
          ),
          verticalGap(24),
          if (!service.configured) Notice(context.tr('auth.notConfigured')),
          if (sent != null) Notice(sent!),
          Form(
            key: form,
            child: Column(
              children: [
                TextFormField(
                  controller: email,
                  decoration: InputDecoration(
                    labelText: context.tr('auth.email'),
                    prefixIcon: const Icon(Icons.mail_outline),
                  ),
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const [AutofillHints.email],
                  validator: (v) =>
                      v != null &&
                          RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
                              .hasMatch(v.trim())
                      ? null
                      : context.tr('auth.emailInvalid'),
                ),
                verticalGap(),
                if (!reset) ...[
                  TextFormField(
                    controller: password,
                    obscureText: obscure,
                    decoration: InputDecoration(
                      labelText: context.tr('auth.password'),
                      helperText: register
                          ? context.tr('auth.passwordHelper')
                          : null,
                      suffixIcon: IconButton(
                        tooltip: context.tr(
                          obscure ? 'auth.showPassword' : 'auth.hidePassword',
                        ),
                        onPressed: () => setState(() => obscure = !obscure),
                        icon: Icon(
                          obscure
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined,
                        ),
                      ),
                    ),
                    autofillHints: [
                      register
                          ? AutofillHints.newPassword
                          : AutofillHints.password,
                    ],
                    validator: (v) =>
                        requiredText(v, min: register ? 6 : 1, max: 128),
                  ),
                  if (register) verticalGap(),
                ],
                if (!reset && !register)
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: () => context.push('/auth/reset'),
                      child: Text(context.tr('auth.forgot')),
                    ),
                  ),
                if (register) ...[
                  TextFormField(
                    controller: confirmation,
                    obscureText: true,
                    decoration: InputDecoration(
                      labelText: context.tr('auth.confirmPassword'),
                    ),
                    validator: (v) =>
                        v == password.text ? null : context.tr('auth.mismatch'),
                  ),
                  verticalGap(),
                ],
                ActionButton(
                  label: context.tr(
                    reset
                        ? 'auth.sendReset'
                        : register
                        ? 'auth.createAccount'
                        : 'common.signIn',
                  ),
                  enabled: service.configured,
                  action: () async {
                    if (!form.currentState!.validate()) return;
                    final resetSent = context.tr('auth.resetSent');
                    if (reset) {
                      await service.reset(email.text);
                      if (mounted) setState(() => sent = resetSent);
                      return;
                    }
                    if (register) {
                      await service.register(email.text, password.text);
                      if (widget.favorite != null) {
                        await ref
                            .read(repositoryProvider)
                            .write(
                              '/me/favorites/products/${Uri.encodeComponent(widget.favorite!)}',
                              'PUT',
                            );
                        ref.invalidate(favoriteIndexProvider);
                      }
                      if (context.mounted) {
                        context.go(
                          '/verify?next=${Uri.encodeQueryComponent(next)}',
                        );
                      }
                      return;
                    }
                    await service.signIn(email.text, password.text);
                    if (widget.favorite != null) {
                      await ref
                          .read(repositoryProvider)
                          .write(
                            '/me/favorites/products/${Uri.encodeComponent(widget.favorite!)}',
                            'PUT',
                          );
                      ref.invalidate(favoriteIndexProvider);
                    }
                    if (context.mounted) context.go(next);
                  },
                ),
              ],
            ),
          ),
          verticalGap(),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 8,
            children: [
              TextButton(
                onPressed: () => context.push(
                  '/auth/${register || reset ? 'sign-in' : 'register'}?next=${Uri.encodeQueryComponent(next)}${widget.favorite == null ? '' : '&favorite=${Uri.encodeQueryComponent(widget.favorite!)}'}',
                ),
                child: Text(
                  context.tr(
                    register || reset
                        ? 'auth.backToSignIn'
                        : 'auth.createAnAccount',
                  ),
                ),
              ),
              TextButton(
                onPressed: () => context.go('/'),
                child: Text(context.tr('auth.continueBrowsing')),
              ),
            ],
          ),
          verticalGap(24),
          Panel(
            child: Row(
              children: [
                const Icon(Icons.payments_outlined, color: HelaColors.teal),
                const SizedBox(width: 12),
                Expanded(child: Text(context.tr('auth.cod'))),
              ],
            ),
          ),
          if (register) ...[
            verticalGap(),
            Text(
              context.tr('legal.agree'),
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          verticalGap(8),
          const LegalLinksBar(),
        ],
      ),
    );
  }
}

class VerifyEmailScreen extends ConsumerWidget {
  const VerifyEmailScreen({super.key, this.next});
  final String? next;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(sessionProvider).value;
    return PageFrame(
      title: context.tr('verify.title'),
      child: ListView(
        padding: const EdgeInsets.all(HelaSpacing.screen),
        children: [
          const Icon(
            Icons.mark_email_unread_outlined,
            size: 70,
            color: HelaColors.teal,
          ),
          verticalGap(24),
          Text(
            context.tr('verify.headline'),
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          verticalGap(),
          Text(
            context.tr('verify.body', {
              'email': user?.email ?? context.tr('verify.yourEmail'),
            }),
          ),
          verticalGap(24),
          ActionButton(
            label: context.tr('verify.done'),
            enabled: user != null,
            action: () async {
              final pending = context.tr('verify.pending');
              await ref.read(authServiceProvider).reload();
              final checked = ref.read(authServiceProvider).session;
              if (checked?.verified != true) throw AppFailure(pending);
              ref.invalidate(profileProvider);
              ref.invalidate(cartProvider);
              if (context.mounted) context.go(safeDestination(next));
            },
          ),
          verticalGap(),
          ActionButton(
            label: context.tr('verify.resend'),
            outlined: true,
            enabled: user != null,
            action: () async {
              final sentMessage = context.tr('verify.sent');
              await ref.read(authServiceProvider).resend();
              if (context.mounted) toast(context, sentMessage);
            },
          ),
          verticalGap(),
          TextButton(
            onPressed: () => context.go('/'),
            child: Text(context.tr('auth.continueBrowsing')),
          ),
        ],
      ),
    );
  }
}

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});
  @override
  Widget build(BuildContext context) => PageFrame(
    title: 'Welcome',
    child: ListView(
      padding: const EdgeInsets.all(HelaSpacing.screen),
      children: [
        const Brand(),
        verticalGap(24),
        ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: Image.asset(
            'assets/images/hero.jpg',
            height: 280,
            fit: BoxFit.cover,
          ),
        ),
        verticalGap(28),
        Text(
          'Good finds.\nLocal roots.',
          style: Theme.of(context).textTheme.headlineLarge,
        ),
        verticalGap(),
        const Text(
          'Discover everyday favourites from independent shops across Sri Lanka. Pay when your order arrives.',
        ),
        verticalGap(28),
        FilledButton(
          onPressed: () => context.go('/'),
          child: const Text('Start exploring'),
        ),
        TextButton(
          onPressed: () => context.push('/auth'),
          child: const Text('Sign in'),
        ),
      ],
    ),
  );
}
