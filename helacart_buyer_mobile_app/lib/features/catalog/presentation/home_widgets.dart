import '../../../app/hc.dart';
import 'product_widgets.dart';

class HomeNotifications extends ConsumerWidget {
  const HomeNotifications({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(sessionProvider).value;
    final inbox = user == null
        ? null
        : ref
              .watch(
                resourceProvider((
                  path: '/me/notifications/inbox',
                  private: true,
                )),
              )
              .value;
    final unread = integer(object(inbox)['unreadCount']);
    return Padding(
      padding: const EdgeInsets.only(right: 12),
      child: IconButton(
        tooltip: 'Notifications',
        style: IconButton.styleFrom(padding: EdgeInsets.zero),
        onPressed: () => context.push('/notifications'),
        icon: Container(
          width: 36,
          height: 36,
          decoration: const BoxDecoration(
            color: HelaColors.search,
            shape: BoxShape.circle,
          ),
          child: Center(
            child: Badge(
              isLabelVisible: unread > 0,
              label: Text('$unread'),
              child: const Icon(Icons.notifications_none, size: 21),
            ),
          ),
        ),
      ),
    );
  }
}

class DiscoverySearchBar extends StatelessWidget {
  const DiscoverySearchBar({super.key});
  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: Material(
          color: HelaColors.search,
          borderRadius: BorderRadius.circular(13),
          child: InkWell(
            borderRadius: BorderRadius.circular(13),
            onTap: () => context.push('/search'),
            child: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 14, vertical: 13),
              child: Row(
                children: [
                  Icon(Icons.search, size: 21, color: HelaColors.muted),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Find your next good find',
                      style: TextStyle(fontSize: 13, color: HelaColors.muted),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
      const SizedBox(width: 10),
      IconButton.outlined(
        tooltip: 'Filter products',
        onPressed: () => context.push('/products?filters=true'),
        style: IconButton.styleFrom(
          minimumSize: const Size(48, 48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(13),
          ),
          side: const BorderSide(color: HelaColors.border),
        ),
        icon: const Icon(Icons.tune, color: HelaColors.teal, size: 21),
      ),
    ],
  );
}

class StorefrontHero extends StatelessWidget {
  const StorefrontHero(this.hero, {super.key, required this.onExplore});
  final Json hero;
  final VoidCallback onExplore;
  @override
  Widget build(BuildContext context) {
    final large = MediaQuery.textScalerOf(context).scale(14) > 19;
    final image = hero['mobileImageUrl'] ?? hero['desktopImageUrl'];
    return ClipRRect(
      borderRadius: BorderRadius.circular(19),
      child: Stack(
        children: [
          Positioned.fill(
            child: image == null
                ? Image.asset(
                    'assets/images/home-reference.jpg',
                    fit: BoxFit.cover,
                    alignment: Alignment.centerRight,
                  )
                : ProductPhoto(string(image), fit: BoxFit.cover),
          ),
          const Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    HelaColors.cream,
                    Color(0xF5F8F5EE),
                    Color(0x50F8F5EE),
                  ],
                  stops: [0, .45, 1],
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'A LITTLE CLOSER TO HOME',
                  style: TextStyle(
                    fontSize: 10,
                    letterSpacing: 1.3,
                    fontWeight: FontWeight.w700,
                    color: HelaColors.teal,
                  ),
                ),
                verticalGap(10),
                ConstrainedBox(
                  constraints: BoxConstraints(
                    maxWidth: large ? double.infinity : 240,
                  ),
                  child: Text(
                    '${string(hero['title'], 'Good finds.')}\n${string(hero['accent'], 'Local roots.')}',
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontSize: 28,
                      height: 1.2,
                      letterSpacing: -.8,
                    ),
                  ),
                ),
                verticalGap(10),
                ConstrainedBox(
                  constraints: BoxConstraints(
                    maxWidth: large ? double.infinity : 210,
                  ),
                  child: Text(
                    string(
                      hero['description'],
                      'Everyday things to love. Independent shops to discover.',
                    ),
                    style: const TextStyle(
                      fontSize: 12,
                      height: 1.45,
                      color: Color(0xFF59645F),
                    ),
                  ),
                ),
                verticalGap(16),
                FilledButton(
                  style: compactButtonStyle(),
                  onPressed: onExplore,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Flexible(
                        child: Text(
                          string(hero['buttonLabel'], 'Explore the collection'),
                          style: const TextStyle(fontSize: 12),
                        ),
                      ),
                      const SizedBox(width: 12),
                      const Icon(Icons.arrow_forward, size: 17),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class DeliveryTrustStrip extends StatelessWidget {
  const DeliveryTrustStrip({super.key});
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.symmetric(vertical: 20),
    padding: const EdgeInsets.symmetric(vertical: 12),
    decoration: const BoxDecoration(
      border: Border.symmetric(
        horizontal: BorderSide(color: HelaColors.border),
      ),
    ),
    child: const Wrap(
      alignment: WrapAlignment.center,
      spacing: 16,
      runSpacing: 12,
      children: [
        _TrustLabel(Icons.payments_outlined, 'Pay on delivery'),
        _TrustLabel(Icons.local_shipping_outlined, 'Clear fees at checkout'),
      ],
    ),
  );
}

class _TrustLabel extends StatelessWidget {
  const _TrustLabel(this.icon, this.label);
  final IconData icon;
  final String label;
  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(icon, size: 17, color: HelaColors.teal),
      const SizedBox(width: 6),
      Text(
        label,
        style: const TextStyle(fontSize: 11, color: HelaColors.muted),
      ),
    ],
  );
}

class LocalShopTile extends StatelessWidget {
  const LocalShopTile(this.shop, {super.key});
  final Json shop;
  @override
  Widget build(BuildContext context) => Material(
    color: Colors.white,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(14),
      side: const BorderSide(color: HelaColors.border),
    ),
    child: InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: () =>
          context.push('/shops/${Uri.encodeComponent(string(shop['slug']))}'),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor: HelaColors.cream,
              child: Text(string(shop['name'], 'H').substring(0, 1)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    string(shop['name']),
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  verticalGap(4),
                  Text(
                    string(shop['publicLocation'], 'Sri Lanka'),
                    style: const TextStyle(
                      fontSize: 11,
                      color: HelaColors.muted,
                    ),
                  ),
                ],
              ),
            ),
            if (boolean(shop['isVerified']))
              IconButton(
                tooltip: 'Shop identity reviewed by HelaCart.',
                onPressed: () => verifiedShopInfo(context),
                icon: const Icon(
                  Icons.verified_outlined,
                  size: 18,
                  color: HelaColors.teal,
                ),
              ),
          ],
        ),
      ),
    ),
  );
}
