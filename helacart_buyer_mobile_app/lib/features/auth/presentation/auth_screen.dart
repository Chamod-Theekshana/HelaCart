import '../../../app/hc.dart';

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
        r'^/(?:$|products(?:/[^/]+(?:/reviews)?)?|categories|search|offers|shops(?:/[^/]+(?:/(?:products|reviews))?)?|favorites|cart|checkout|orders(?:/[^/]+(?:/tracking/[^/]+)?)?|order-success/[^/]+|account(?:/(?:profile|addresses(?:/new)?|security(?:/(?:password|email))?|reviews))?|notifications|returns(?:/new/[^/]+)?|refunds|support(?:/[^/]+)?|help)$',
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
      title: reset
          ? 'Reset password'
          : register
          ? 'Create account'
          : 'Sign in',
      child: ListView(
        padding: const EdgeInsets.all(HelaSpacing.screen),
        children: [
          const Brand(),
          verticalGap(24),
          Text(
            reset
                ? 'Let’s get you back in.'
                : register
                ? 'A place for your good finds.'
                : 'Welcome back.',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          verticalGap(10),
          Text(
            reset
                ? 'We’ll send a password-reset link to your email.'
                : 'Your favourite shops, saved finds and orders, together.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          verticalGap(24),
          if (!service.configured)
            const Notice(
              'Sign-in needs the mobile Firebase settings. Public shopping screens remain available; see the README for configuration.',
            ),
          if (sent != null) Notice(sent!),
          Form(
            key: form,
            child: Column(
              children: [
                TextFormField(
                  controller: email,
                  decoration: const InputDecoration(
                    labelText: 'Email address',
                    prefixIcon: Icon(Icons.mail_outline),
                  ),
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const [AutofillHints.email],
                  validator: (v) =>
                      v != null &&
                          RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
                              .hasMatch(v.trim())
                      ? null
                      : 'Enter a valid email.',
                ),
                verticalGap(),
                if (!reset) ...[
                  TextFormField(
                    controller: password,
                    obscureText: obscure,
                    decoration: InputDecoration(
                      labelText: 'Password',
                      helperText: register ? 'At least 6 characters' : null,
                      suffixIcon: IconButton(
                        tooltip: obscure ? 'Show password' : 'Hide password',
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
                      child: const Text('Forgot password?'),
                    ),
                  ),
                if (register) ...[
                  TextFormField(
                    controller: confirmation,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'Confirm password',
                    ),
                    validator: (v) =>
                        v == password.text ? null : 'Passwords do not match.',
                  ),
                  verticalGap(),
                ],
                ActionButton(
                  label: reset
                      ? 'Send reset link'
                      : register
                      ? 'Create account'
                      : 'Sign in',
                  enabled: service.configured,
                  action: () async {
                    if (!form.currentState!.validate()) return;
                    if (reset) {
                      await service.reset(email.text);
                      if (mounted) {
                        setState(
                          () => sent = 'If this email has an account, a password reset link has been sent. Check your inbox and spam folder.',
                        );
                      }
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
                  register || reset ? 'Back to sign in' : 'Create an account',
                ),
              ),
              TextButton(
                onPressed: () => context.go('/'),
                child: const Text('Continue browsing'),
              ),
            ],
          ),
          verticalGap(24),
          const Panel(
            child: Row(
              children: [
                Icon(Icons.payments_outlined, color: HelaColors.teal),
                SizedBox(width: 12),
                Expanded(
                  child: Text('Cash on delivery. Pay when your order arrives.'),
                ),
              ],
            ),
          ),
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
      title: 'Verify email',
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
            'Check your email',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          verticalGap(),
          Text(
            'Open the verification link sent to ${user?.email ?? 'your email address'}, then return here.',
          ),
          verticalGap(24),
          ActionButton(
            label: 'I’ve verified my email',
            enabled: user != null,
            action: () async {
              await ref.read(authServiceProvider).reload();
              final checked = ref.read(authServiceProvider).session;
              if (checked?.verified != true) {
                throw const AppFailure(
                  'Verification is still pending. Check your inbox and try again.',
                );
              }
              ref.invalidate(profileProvider);
              ref.invalidate(cartProvider);
              if (context.mounted) context.go(safeDestination(next));
            },
          ),
          verticalGap(),
          ActionButton(
            label: 'Resend verification email',
            outlined: true,
            enabled: user != null,
            action: () async {
              await ref.read(authServiceProvider).resend();
              if (context.mounted) {
                toast(
                  context,
                  'Verification email sent. Check your inbox and spam folder.',
                );
              }
            },
          ),
          verticalGap(),
          TextButton(
            onPressed: () => context.go('/'),
            child: const Text('Continue browsing'),
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
