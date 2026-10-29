import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:image_picker/image_picker.dart';

import '../../../app/hc.dart';
import '../../../core/data/buyer_repository.dart';
import '../../reviews/presentation/reviews_screen.dart';

final avatarProvider = FutureProvider.autoDispose.family<Uint8List, int>((
  ref,
  version,
) {
  ref.watch(sessionProvider);
  return ref.watch(apiProvider).privateImage('/auth/me/photo?v=$version');
}, retry: (c, e) => null);

class BuyerAvatar extends ConsumerWidget {
  const BuyerAvatar({super.key, required this.profile, this.radius = 30});
  final Json profile;
  final double radius;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final name = string(profile['name'], 'HelaCart');
    final letters = name
        .trim()
        .split(RegExp(r'\s+'))
        .take(2)
        .map((s) => s.isEmpty ? '' : s[0])
        .join()
        .toUpperCase();
    final bytes = boolean(profile['hasPhoto'])
        ? ref
              .watch(avatarProvider(integer(profile['photoVersion'])))
              .asData
              ?.value
        : null;
    return CircleAvatar(
      radius: radius,
      backgroundColor: HelaColors.mint,
      backgroundImage: bytes == null ? null : MemoryImage(bytes),
      child: bytes == null
          ? Text(
              letters,
              style: const TextStyle(
                color: HelaColors.teal,
                fontWeight: FontWeight.w800,
              ),
            )
          : null,
    );
  }
}

class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => PageFrame(
    title: 'Your HelaCart',
    child: Protected(
      verified: false,
      child: ref
          .watch(profileProvider)
          .when(
            skipLoadingOnRefresh: false,
            skipLoadingOnReload: false,
            loading: () => const LoadingBlocks(),
            error: (e, _) =>
                ErrorState(e, retry: () => ref.invalidate(profileProvider)),
            data: (profile) {
              if (profile == null) return const SizedBox.shrink();
              return ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  Panel(
                    child: Row(
                      children: [
                        BuyerAvatar(profile: profile),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                string(profile['name'], 'Welcome to HelaCart'),
                                style: Theme.of(context).textTheme.titleLarge,
                              ),
                              Text(
                                string(profile['email']),
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                              verticalGap(6),
                              StatusPill(
                                ref.watch(sessionProvider).value?.verified ==
                                        true
                                    ? 'EMAIL_VERIFIED'
                                    : 'VERIFY_EMAIL',
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          tooltip: 'Edit profile',
                          onPressed: () => context.push('/account/profile'),
                          icon: const Icon(Icons.edit_outlined),
                        ),
                      ],
                    ),
                  ),
                  if (ref.watch(sessionProvider).value?.verified == true) ...[
                    verticalGap(),
                    RemoteView(
                      path: '/workspace/me/summary',
                      private: true,
                      builder: (c, data) => Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: [
                          for (final pair in [
                            ('Orders', 'orders'),
                            ('Active packages', 'activeSellerOrders'),
                            ('Addresses', 'addresses'),
                            ('Unread notices', 'unreadNotifications'),
                          ])
                            SizedBox(
                              width: (MediaQuery.sizeOf(c).width - 60) / 2,
                              child: Panel(
                                color: HelaColors.wash,
                                child: Column(
                                  children: [
                                    Text(
                                      '${integer(data[pair.$2])}',
                                      style: Theme.of(c)
                                          .textTheme
                                          .headlineSmall,
                                    ),
                                    Text(
                                      pair.$1,
                                      style: Theme.of(c).textTheme.bodySmall,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                  const SectionTitle('Personal & orders'),
                  for (final row in [
                    ('/account/profile', 'My profile', Icons.person_outline),
                    ('/orders', 'My orders', Icons.inventory_2_outlined),
                    ('/favorites', 'Favorites', Icons.favorite_border),
                    (
                      '/account/addresses',
                      'Delivery addresses',
                      Icons.location_on_outlined,
                    ),
                    (
                      '/notifications',
                      'Notifications',
                      Icons.notifications_none,
                    ),
                    (
                      '/account/reviews',
                      'My product reviews',
                      Icons.star_border,
                    ),
                    (
                      '/returns',
                      'Returns & refunds',
                      Icons.assignment_return_outlined,
                    ),
                    ('/support', 'Support cases', Icons.support_agent),
                    (
                      '/account/security',
                      'Account security',
                      Icons.lock_outline,
                    ),
                    ('/help', 'Shopping help', Icons.help_outline),
                  ])
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Panel(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        child: ListTile(
                          leading: Icon(row.$3, color: HelaColors.teal),
                          title: Text(row.$2),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () => context.push(row.$1),
                        ),
                      ),
                    ),
                  verticalGap(),
                  ActionButton(
                    label: 'Sign out',
                    outlined: true,
                    action: () async {
                      if (!await confirm(
                        context,
                        title: 'Sign out of HelaCart?',
                        message: 'Your orders and favorites remain saved to your account.',
                        action: 'Sign out',
                      )) {
                        return;
                      }
                      await ref.read(authServiceProvider).signOut();
                      refreshBuyer(ref);
                      ref.invalidate(avatarProvider);
                      if (context.mounted) context.go('/');
                    },
                  ),
                  verticalGap(24),
                  const Text(
                    'HelaCart · Good finds. Local roots.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: HelaColors.muted, fontSize: 12),
                  ),
                ],
              );
            },
          ),
    ),
  );
}

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => PageFrame(
    title: 'My profile',
    child: Protected(
      child: ref
          .watch(profileProvider)
          .when(
            skipLoadingOnReload: false,
            skipLoadingOnRefresh: false,
            data: (data) => data == null
                ? const LoadingBlocks()
                : ProfileForm(
                    key: ValueKey('${data['id']}:${data['updatedAt']}'),
                    profile: data,
                  ),
            loading: () => const LoadingBlocks(),
            error: (e, _) =>
                ErrorState(e, retry: () => ref.invalidate(profileProvider)),
          ),
    ),
  );
}

class ProfileForm extends ConsumerStatefulWidget {
  const ProfileForm({super.key, required this.profile});
  final Json profile;
  @override
  ConsumerState<ProfileForm> createState() => _ProfileFormState();
}

class _ProfileFormState extends ConsumerState<ProfileForm> {
  final form = GlobalKey<FormState>();
  late final name = TextEditingController(text: string(widget.profile['name'])),
      phone = TextEditingController(text: string(widget.profile['phone']));
  @override
  void dispose() {
    name.dispose();
    phone.dispose();
    super.dispose();
  }

  Future<void> photoActions() async {
    await showModalBottomSheet<void>(
      context: context,
      builder: (c) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(HelaSpacing.screen),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Profile photo', style: Theme.of(c).textTheme.titleLarge),
              verticalGap(),
              ActionButton(
                label: 'Choose from photos',
                outlined: true,
                action: () async {
                  final picked = await ImagePicker().pickImage(
                    source: ImageSource.gallery,
                    requestFullMetadata: false,
                    imageQuality: 90,
                  );
                  if (picked == null) return;
                  final bytes = await picked.readAsBytes();
                  if (bytes.length > 3 * 1024 * 1024) {
                    throw const AppFailure('Choose a photo up to 3 MB.');
                  }
                  final data = FormData.fromMap({
                    'photo': await photoPart(picked.name, bytes),
                  });
                  await ref
                      .read(repositoryProvider)
                      .write('/auth/me/photo', 'POST', data);
                  ref.invalidate(profileProvider);
                  ref.invalidate(avatarProvider);
                  if (c.mounted) Navigator.pop(c);
                },
              ),
              if (boolean(widget.profile['hasPhoto'])) ...[
                verticalGap(),
                ActionButton(
                  label: 'Remove photo',
                  outlined: true,
                  action: () async {
                    await ref
                        .read(repositoryProvider)
                        .write('/auth/me/photo', 'DELETE');
                    ref.invalidate(profileProvider);
                    ref.invalidate(avatarProvider);
                    if (c.mounted) Navigator.pop(c);
                  },
                ),
              ],
              const Notice('JPEG, PNG or WebP · one photo, up to 3 MB'),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(20),
    children: [
      Center(child: BuyerAvatar(profile: widget.profile, radius: 36)),
      TextButton(onPressed: photoActions, child: const Text('Change photo')),
      verticalGap(16),
      Form(
        key: form,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextFormField(
              controller: name,
              maxLength: 100,
              decoration: const InputDecoration(
                labelText: 'Full name',
                counterText: '',
              ),
              validator: (v) => requiredText(v, min: 2, max: 100),
            ),
            verticalGap(),
            TextFormField(
              controller: phone,
              maxLength: 25,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(
                labelText: 'Contact phone (optional)',
                counterText: '',
              ),
              validator: (v) =>
                  v == null ||
                      v.isEmpty ||
                      RegExp(r'^\+?[\d ()-]{7,25}$').hasMatch(v)
                  ? null
                  : 'Enter a valid phone number.',
            ),
            verticalGap(),
            Panel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Sign-in email',
                    style: TextStyle(color: HelaColors.muted, fontSize: 12),
                  ),
                  Text(string(widget.profile['email'])),
                  TextButton(
                    onPressed: () => context.push('/account/security'),
                    child: const Text('Manage sign-in & security'),
                  ),
                ],
              ),
            ),
            verticalGap(24),
            ActionButton(
              label: 'Save changes',
              action: () async {
                if (!form.currentState!.validate()) return;
                await ref.read(repositoryProvider).write('/auth/me', 'PATCH', {
                  'name': name.text.trim(),
                  'phone': phone.text.trim(),
                });
                ref.invalidate(profileProvider);
                if (context.mounted) toast(context, 'Profile saved.');
              },
            ),
          ],
        ),
      ),
    ],
  );
}

class SecurityScreen extends ConsumerWidget {
  const SecurityScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(sessionProvider).value;
    return PageFrame(
      title: 'Account security',
      child: Protected(
        verified: false,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Panel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    user?.email ?? '',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  verticalGap(),
                  StatusPill(
                    user?.verified == true
                        ? 'EMAIL_VERIFIED'
                        : 'EMAIL_NOT_VERIFIED',
                  ),
                  if (user?.verified != true)
                    TextButton(
                      onPressed: () =>
                          context.push('/verify?next=/account/security'),
                      child: const Text('Verify my email'),
                    ),
                ],
              ),
            ),
            verticalGap(20),
            for (final row in [
              ('/account/security/password', 'Change password'),
              ('/account/security/email', 'Change sign-in email'),
            ])
              ListTile(
                title: Text(row.$2),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => context.push(row.$1),
              ),
            const Notice(
              'Sensitive changes require your current password. Your new email must be verified before it becomes your sign-in address.',
            ),
          ],
        ),
      ),
    );
  }
}

class SecurityFormScreen extends ConsumerStatefulWidget {
  const SecurityFormScreen({super.key, this.email = false});
  final bool email;
  @override
  ConsumerState<SecurityFormScreen> createState() => _SecurityFormScreenState();
}

class _SecurityFormScreenState extends ConsumerState<SecurityFormScreen> {
  final form = GlobalKey<FormState>();
  final current = TextEditingController(),
      next = TextEditingController(),
      again = TextEditingController();
  String? notice;
  @override
  void dispose() {
    current.dispose();
    next.dispose();
    again.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => PageFrame(
    title: widget.email ? 'Change sign-in email' : 'Change password',
    child: Protected(
      verified: false,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          if (notice != null) Notice(notice!),
          Form(
            key: form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (widget.email) ...[
                  TextFormField(
                    controller: next,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                      labelText: 'New email address',
                    ),
                    validator: (v) =>
                        v != null &&
                            RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
                                .hasMatch(v.trim())
                        ? null
                        : 'Enter a valid email.',
                  ),
                  verticalGap(),
                ],
                TextFormField(
                  controller: current,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'Current password',
                  ),
                  validator: (v) => requiredText(v, max: 128),
                ),
                verticalGap(),
                if (!widget.email) ...[
                  TextFormField(
                    controller: next,
                    obscureText: true,
                    maxLength: 128,
                    decoration: const InputDecoration(
                      labelText: 'New password',
                      helperText: 'At least 8 characters',
                    ),
                    validator: (v) => requiredText(v, min: 8, max: 128),
                  ),
                  verticalGap(),
                  TextFormField(
                    controller: again,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'Confirm new password',
                    ),
                    validator: (v) =>
                        v == next.text ? null : 'Passwords do not match.',
                  ),
                  verticalGap(),
                ],
                ActionButton(
                  label: widget.email
                      ? 'Send verification link'
                      : 'Update password',
                  action: () async {
                    if (!form.currentState!.validate()) return;
                    final service = ref.read(authServiceProvider);
                    if (widget.email) {
                      if (next.text.trim().toLowerCase() ==
                          service.session?.email.toLowerCase()) {
                        throw const AppFailure(
                          'Enter a different email address.',
                        );
                      }
                      await service.changeEmail(current.text, next.text);
                      if (mounted) {
                        setState(
                          () => notice =
                              'Open the link sent to ${next.text.trim()} to finish changing your email, then sign in again.',
                        );
                      }
                    } else {
                      await service.changePassword(current.text, next.text);
                      if (mounted) {
                        setState(
                          () => notice = 'Password updated. Use your new password next time you sign in.',
                        );
                      }
                    }
                    current.clear();
                    if (!widget.email) {
                      next.clear();
                      again.clear();
                    }
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

class MyReviewsScreen extends ConsumerStatefulWidget {
  const MyReviewsScreen({super.key});
  @override
  ConsumerState<MyReviewsScreen> createState() => _MyReviewsScreenState();
}

class _MyReviewsScreenState extends ConsumerState<MyReviewsScreen> {
  int page = 1;
  @override
  Widget build(BuildContext context) => PageFrame(
    title: 'My product reviews',
    child: Protected(
      child: RemoteView(
        path: '/me/product-reviews?page=$page',
        private: true,
        builder: (c, data) => ListView(
          padding: const EdgeInsets.all(20),
          children: [
            if (objects(data['items']).isEmpty)
              const EmptyState(
                title: 'Share a delivered purchase',
                message: 'Open a delivered order to review its products.',
                icon: Icons.rate_review_outlined,
              ),
            for (final review in objects(data['items']))
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      string(object(review['product'])['title']),
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    ReviewCard(review: review),
                    if (boolean(review['isHidden']))
                      const Notice(
                        'Hidden by moderation. This review cannot be republished.',
                      ),
                    if (boolean(review['canViewProduct']))
                      TextButton(
                        onPressed: () => context.push(
                          '/products/${object(review['product'])['id']}/reviews',
                        ),
                        child: const Text('View product / manage review'),
                      ),
                    ActionButton(
                      label: 'Delete my review',
                      outlined: true,
                      action: () async {
                        if (!await confirm(
                          context,
                          title: 'Delete your review?',
                          message: 'It will no longer appear publicly.',
                          action: 'Delete review',
                        )) {
                          return;
                        }
                        await ref.read(repositoryProvider).write(
                          '/products/${object(review['product'])['id']}/customer-reviews/mine',
                          'DELETE',
                          {'version': integer(review['version'])},
                        );
                        ref.invalidate(resourceProvider);
                      },
                    ),
                  ],
                ),
              ),
            Pager(
              page: page,
              pages: integer(data['pages'], 1),
              change: (v) => setState(() => page = v),
            ),
          ],
        ),
      ),
    ),
  );
}
