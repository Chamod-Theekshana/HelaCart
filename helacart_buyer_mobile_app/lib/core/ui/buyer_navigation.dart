import 'dart:math' as math;

import '../../app/hc.dart';
import '../../features/account/presentation/account_screen.dart';

class BuyerAccountMenuScope extends InheritedWidget {
  const BuyerAccountMenuScope({
    super.key,
    required this.open,
    required super.child,
  });
  final VoidCallback open;
  static void openMenu(BuildContext context) => context
      .dependOnInheritedWidgetOfExactType<BuyerAccountMenuScope>()
      ?.open();
  @override
  bool updateShouldNotify(BuyerAccountMenuScope oldWidget) => false;
}

/// One native, labelled hit target per destination; the cutout and raised icon
/// share the same animation so the selection never becomes attached to Bag.
class BuyerNavigationBar extends StatelessWidget {
  const BuyerNavigationBar({
    super.key,
    required this.selectedIndex,
    required this.onSelected,
    this.bagCount = 0,
  });
  final int selectedIndex, bagCount;
  final ValueChanged<int> onSelected;
  static const _selectionRadius = 30.0;
  static const _curveGap = 3.0;
  static const labels = ['Home', 'Categories', 'Bag', 'Favorites', 'Orders'];
  static const icons = [
    Icons.home_outlined,
    Icons.grid_view_outlined,
    Icons.shopping_bag_outlined,
    Icons.favorite_border,
    Icons.inventory_2_outlined,
  ];

  @override
  Widget build(BuildContext context) {
    final safeBottom = MediaQuery.paddingOf(context).bottom;
    final visibleLabels = MediaQuery.textScalerOf(context).scale(11) > 15
        ? const ['Home', 'Browse', 'Bag', 'Saved', 'Orders']
        : labels;
    final labelStyle = Theme.of(context).textTheme.bodyMedium!
        .copyWith(fontSize: 11, height: 1.25, fontWeight: FontWeight.w700);
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(
        begin: selectedIndex.toDouble(),
        end: selectedIndex.toDouble(),
      ),
      duration: MediaQuery.disableAnimationsOf(context)
          ? Duration.zero
          : const Duration(milliseconds: 350),
      curve: Curves.easeInOutCubic,
      builder: (context, position, _) => LayoutBuilder(
        builder: (context, box) {
          final center = box.maxWidth * (position + .5) / 5;
          var labelHeight = 0.0;
          for (final label in visibleLabels) {
            final painter = TextPainter(
              text: TextSpan(text: label, style: labelStyle),
              textDirection: Directionality.of(context),
              textScaler: MediaQuery.textScalerOf(context),
            )..layout(maxWidth: box.maxWidth / 5);
            if (painter.height > labelHeight) labelHeight = painter.height;
            painter.dispose();
          }
          final height = 73 + labelHeight + safeBottom;
          return SizedBox(
            height: height,
            child: Stack(
              children: [
                Positioned.fill(
                  child: ClipPath(
                    clipper: _NavigationCurve(center),
                    child: const ColoredBox(color: HelaColors.navy),
                  ),
                ),
                Positioned(
                  left: center - _selectionRadius,
                  top: 0,
                  child: ExcludeSemantics(
                    child: Container(
                      width: _selectionRadius * 2,
                      height: _selectionRadius * 2,
                      decoration: BoxDecoration(
                        color: HelaColors.teal,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 3),
                      ),
                      child: Icon(
                        icons[selectedIndex],
                        color: Colors.white,
                        size: 24,
                      ),
                    ),
                  ),
                ),
                Positioned.fill(
                  bottom: safeBottom,
                  child: Row(
                    children: List.generate(
                      5,
                      (i) => Expanded(
                        child: Semantics(
                          selected: i == selectedIndex,
                          label: i == 2 && bagCount > 0
                              ? 'Bag, $bagCount items'
                              : labels[i],
                          button: true,
                          child: Material(
                            color: Colors.transparent,
                            child: InkWell(
                              onTap: () => onSelected(i),
                              borderRadius: BorderRadius.circular(18),
                              child: ExcludeSemantics(
                                child: Column(
                                  children: [
                                    const SizedBox(height: 28),
                                    SizedBox(
                                      height: 28,
                                      child: Opacity(
                                        opacity: i == selectedIndex ? 0 : 1,
                                        child: Badge(
                                          isLabelVisible:
                                              i == 2 && bagCount > 0,
                                          label: Text('$bagCount'),
                                          child: Icon(
                                            icons[i],
                                            color: const Color(0xFFBAC7C8),
                                            size: 22,
                                          ),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 9),
                                    Text(
                                      visibleLabels[i],
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        fontSize: 11,
                                        height: 1.25,
                                        color: i == selectedIndex
                                            ? Colors.white
                                            : const Color(0xFFBAC7C8),
                                        fontWeight: i == selectedIndex
                                            ? FontWeight.w700
                                            : FontWeight.w500,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                if (selectedIndex == 2 && bagCount > 0)
                  Positioned(
                    left: center + 10,
                    top: 1,
                    child: IgnorePointer(
                      child: ExcludeSemantics(
                        child: Badge(label: Text('$bagCount')),
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _NavigationCurve extends CustomClipper<Path> {
  _NavigationCurve(this.center);
  final double center;
  static const _shoulderRadius = 24.0;
  @override
  Path getClip(Size size) {
    final circle = Rect.fromCircle(
      center: Offset(center, BuyerNavigationBar._selectionRadius),
      radius:
          BuyerNavigationBar._selectionRadius + BuyerNavigationBar._curveGap,
    );
    // Circular fillets create broader navy shoulders, tangent to both the
    // horizontal edge and the concentric notch so there are no sharp joins.
    final notchRadius = circle.width / 2;
    final centerDistance = notchRadius + _shoulderRadius;
    final dy = 18 + _shoulderRadius - circle.center.dy;
    final dx = math.sqrt(centerDistance * centerDistance - dy * dy);
    final tangentScale = notchRadius / centerDistance;
    final leftTangent = circle.center + Offset(-dx, dy) * tangentScale;
    final rightTangent = circle.center + Offset(dx, dy) * tangentScale;
    final notched = Path()
      ..moveTo(-64, 18)
      ..lineTo(center - dx, 18)
      ..arcToPoint(leftTangent, radius: const Radius.circular(_shoulderRadius))
      ..arcToPoint(
        rightTangent,
        radius: Radius.circular(notchRadius),
        clockwise: false,
      )
      ..arcToPoint(
        Offset(center + dx, 18),
        radius: const Radius.circular(_shoulderRadius),
      )
      ..lineTo(size.width + 64, 18)
      ..lineTo(size.width + 64, size.height)
      ..lineTo(-64, size.height)
      ..close();
    final roundedBar = Path()
      ..addRRect(
        RRect.fromRectAndCorners(
          Rect.fromLTWH(0, 18, size.width, size.height - 18),
          topLeft: const Radius.circular(24),
          topRight: const Radius.circular(24),
        ),
      );
    return Path.combine(PathOperation.intersect, roundedBar, notched);
  }

  @override
  bool shouldReclip(_NavigationCurve oldClipper) => oldClipper.center != center;
}

class BuyerAccountDrawer extends ConsumerWidget {
  const BuyerAccountDrawer({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider).value;
    final profileState = ref.watch(profileProvider);
    final profile = profileState.asData?.value;
    void open(String path) {
      Navigator.of(context).pop();
      if (['/orders', '/favorites'].contains(path)) {
        context.go(path);
      } else {
        context.push(path);
      }
    }

    return Drawer(
      width: MediaQuery.sizeOf(context).width.clamp(0, 368) - 28,
      backgroundColor: Colors.white,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 8, 12),
              child: Row(
                children: [
                  const Expanded(child: Brand()),
                  IconButton(
                    tooltip: 'Close account menu',
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (session == null)
                        const CircleAvatar(
                          radius: 26,
                          backgroundColor: HelaColors.mint,
                          child: Icon(
                            Icons.person_outline,
                            color: HelaColors.teal,
                          ),
                        )
                      else
                        BuyerAvatar(
                          profile: profile ?? {'name': session.email},
                          radius: 26,
                        ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              session == null
                                  ? 'Welcome to HelaCart'
                                  : string(profile?['name'], 'Your HelaCart'),
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            if (session != null)
                              Text(
                                session.email,
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            TextButton(
                              onPressed: () => open(
                                session == null ? '/auth' : '/account/profile',
                              ),
                              child: Text(
                                session == null
                                    ? 'Sign in / Create account'
                                    : 'View profile',
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  if (session != null && profileState.hasError) ...[
                    const Notice(
                      'Your profile could not be loaded. You can still open your account.',
                    ),
                    TextButton(
                      onPressed: () => ref.invalidate(profileProvider),
                      child: const Text('Retry profile'),
                    ),
                  ],
                  for (final group in [
                    (
                      'Your shopping',
                      [
                        ('/orders', 'Orders', Icons.inventory_2_outlined),
                        ('/favorites', 'Saved finds', Icons.favorite_border),
                        (
                          '/returns',
                          'Returns & refunds',
                          Icons.assignment_return_outlined,
                        ),
                        (
                          '/account/reviews',
                          'My product reviews',
                          Icons.rate_review_outlined,
                        ),
                      ],
                    ),
                    (
                      'My details',
                      [
                        ('/account/profile', 'Profile', Icons.person_outline),
                        (
                          '/account/addresses',
                          'Addresses',
                          Icons.location_on_outlined,
                        ),
                        (
                          '/notifications',
                          'Notifications',
                          Icons.notifications_none,
                        ),
                      ],
                    ),
                    (
                      'Help & security',
                      [
                        ('/support', 'Support', Icons.chat_bubble_outline),
                        (
                          '/account/security',
                          'Account security',
                          Icons.lock_outline,
                        ),
                        ('/help', 'Shopping help', Icons.help_outline),
                      ],
                    ),
                  ]) ...[
                    Padding(
                      padding: const EdgeInsets.only(top: 22, bottom: 8),
                      child: Text(
                        group.$1.toUpperCase(),
                        style: const TextStyle(
                          fontSize: 11,
                          letterSpacing: 1.2,
                          fontWeight: FontWeight.w700,
                          color: HelaColors.muted,
                        ),
                      ),
                    ),
                    for (final link in group.$2)
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        minLeadingWidth: 24,
                        leading: Icon(
                          link.$3,
                          color: HelaColors.teal,
                          size: 21,
                        ),
                        title: Text(
                          link.$2,
                          style: const TextStyle(fontSize: 13),
                        ),
                        trailing: const Icon(Icons.chevron_right, size: 18),
                        onTap: () => open(link.$1),
                      ),
                  ],
                  verticalGap(20),
                ],
              ),
            ),
            if (session != null)
              Padding(
                padding: const EdgeInsets.all(20),
                child: ActionButton(
                  label: 'Sign out',
                  outlined: true,
                  icon: Icons.logout,
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
                    if (context.mounted) {
                      Navigator.pop(context);
                      context.go('/');
                    }
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}
