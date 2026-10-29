import '../../../app/hc.dart';
import '../../catalog/presentation/product_widgets.dart';

class ShopsScreen extends ConsumerStatefulWidget {
  const ShopsScreen({super.key});
  @override
  ConsumerState<ShopsScreen> createState() => _ShopsScreenState();
}

class _ShopsScreenState extends ConsumerState<ShopsScreen> {
  int page = 1;
  String query = '';
  @override
  Widget build(BuildContext context) => PageFrame(
    title: 'Discover shops',
    child: ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          'Good finds.\nGreat little shops.',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        verticalGap(),
        const Text('Get to know the people behind your next favourite find.'),
        verticalGap(20),
        TextField(
          maxLength: 80,
          decoration: const InputDecoration(
            counterText: '',
            hintText: 'Search shops',
            prefixIcon: Icon(Icons.search),
          ),
          textInputAction: TextInputAction.search,
          onSubmitted: (v) => setState(() {
            query = v.trim();
            page = 1;
          }),
        ),
        RemoteView(
          path: '/shops?page=$page&q=${Uri.encodeQueryComponent(query)}',
          builder: (c, data) => Column(
            children: [
              Text('${integer(data['total'])} shops'),
              verticalGap(),
              if (objects(data['items']).isEmpty)
                const EmptyState(
                  title: 'No shops found',
                  message: 'Try another search.',
                )
              else
                ...objects(data['items']).map((s) => ShopCard(s)),
              Pager(
                page: page,
                pages: integer(data['pages'], 1),
                change: (v) => setState(() => page = v),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class ShopProfileScreen extends StatelessWidget {
  const ShopProfileScreen({super.key, required this.slug});
  final String slug;
  @override
  Widget build(BuildContext context) => PageFrame(
    title: 'Local shop',
    child: ListView(
      padding: const EdgeInsets.all(20),
      children: [
        RemoteView(
          path: '/shops/${Uri.encodeComponent(slug)}',
          builder: (c, shop) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (shop['coverUrl'] != null)
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: SizedBox(
                    height: 160,
                    child: ProductPhoto(
                      string(shop['coverUrl']),
                      fit: BoxFit.cover,
                    ),
                  ),
                ),
              verticalGap(),
              ShopCard(shop),
              ShopTabs(slug: slug, selected: 'about'),
              const SectionTitle('About this shop'),
              Panel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      string(
                        shop['description'],
                        'Discover this shop’s collection.',
                      ),
                    ),
                    verticalGap(),
                    Text(string(shop['publicLocation'], 'Sri Lanka')),
                    if (shop['createdAt'] != null) ...[
                      verticalGap(6),
                      Text(
                        'Joined ${dateText(shop['createdAt'])}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                    if (shop['shippingFeeLkrMinor'] != null) ...[
                      verticalGap(),
                      MoneyRow(
                        'Standard delivery',
                        integer(shop['shippingFeeLkrMinor']),
                      ),
                    ],
                    const Notice(
                      'Final delivery fee and destination availability are confirmed at checkout.',
                    ),
                  ],
                ),
              ),
              const SectionTitle('Explore categories'),
              Wrap(
                spacing: 8,
                children: objects(shop['categories'])
                    .map(
                      (r) => ActionChip(
                        label: Text(string(r['name'])),
                        onPressed: () => context.push(
                          '/shops/${Uri.encodeComponent(slug)}/products?category=${Uri.encodeQueryComponent(string(r['slug']))}',
                        ),
                      ),
                    )
                    .toList(),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}
