import '../../../app/hc.dart';

class HelpScreen extends StatelessWidget {
  const HelpScreen({super.key});
  @override
  Widget build(BuildContext context) => PageFrame(
    title: 'Shopping with HelaCart',
    child: ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          'Good finds.\nClear from the start.',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        verticalGap(),
        for (final item in [
          (
            'Discover local shops',
            'Browse physical goods from independent shops across Sri Lanka. A verified-shop badge means HelaCart reviewed the shop’s identity; it is separate from a purchase review.',
          ),
          (
            'Choose your option',
            'Check the selected size, colour, price and stock before adding a product. Offers apply automatically while active.',
          ),
          (
            'Review delivery fees',
            'Choose your saved address at checkout. Each shop has its own destination availability, delivery fee and package. Final totals must be reviewed before ordering.',
          ),
          (
            'Pay when it arrives',
            'HelaCart currently supports cash on delivery. The app does not collect an online card payment.',
          ),
          (
            'Track each package',
            'Shops update delivery progress and courier references. Delivery estimates, when supplied, are estimates after dispatch.',
          ),
          (
            'Share your experience',
            'Review a product after buying that product and receiving delivery. Shop reviews concern the shop experience and may include up to three photos.',
          ),
          (
            'Return selected items',
            'Open a delivered package in My orders to check return eligibility, the actual deadline and remaining quantities. Return approval and refund verification are separate steps.',
          ),
          (
            'Get support',
            'Open a general case with HelaCart or an order-linked case involving the relevant shop. Conversations are private to their authorized participants.',
          ),
        ])
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Panel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.$1, style: Theme.of(context).textTheme.titleMedium),
                  verticalGap(8),
                  Text(item.$2),
                ],
              ),
            ),
          ),
        verticalGap(),
        FilledButton(
          onPressed: () => context.push('/support'),
          child: const Text('My support cases'),
        ),
        TextButton(
          onPressed: () => context.push('/orders'),
          child: const Text('My orders'),
        ),
      ],
    ),
  );
}
