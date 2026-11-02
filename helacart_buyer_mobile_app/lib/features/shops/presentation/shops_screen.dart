import '../../../app/deep_links.dart';
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
  String get path => '/shops?page=$page&q=${Uri.encodeQueryComponent(query)}';
  @override
  Widget build(BuildContext context) => PageFrame(
    title: context.tr('shops.title'),
    child: RefreshIndicator(
      onRefresh: () => refreshResource(ref, path),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            context.tr('shops.headline'),
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          verticalGap(),
          Text(context.tr('shops.intro')),
          verticalGap(20),
          TextField(
            maxLength: 80,
            decoration: InputDecoration(
              counterText: '',
              hintText: context.tr('shops.search'),
              prefixIcon: const Icon(Icons.search),
            ),
            textInputAction: TextInputAction.search,
            onSubmitted: (v) => setState(() {
              query = v.trim();
              page = 1;
            }),
          ),
          RemoteView(
            path: path,
            builder: (c, data) => Column(
              children: [
                Text(c.tr('shops.count', {'count': integer(data['total'])})),
                verticalGap(),
                if (objects(data['items']).isEmpty)
                  EmptyState(
                    title: c.tr('shops.emptyTitle'),
                    message: c.tr('shops.emptyMessage'),
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
    ),
  );
}

class ShopProfileScreen extends ConsumerWidget {
  const ShopProfileScreen({super.key, required this.slug});
  final String slug;
  String get path => '/shops/${Uri.encodeComponent(slug)}';
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final name = string(
      object(
        ref.watch(resourceProvider((path: path, private: false))).value,
      )['name'],
    );
    return PageFrame(
      title: context.tr('shop.title'),
      actions: [
        ShareLinkButton(
          key: const ValueKey('share-shop'),
          tooltip: context.tr('share.shop'),
          url: shopShareUrl(slug),
          text: context.tr('share.shopText', {
            'name': name.isEmpty ? slug : name,
          }),
        ),
      ],
      child: RefreshIndicator(
        onRefresh: () => refreshResource(ref, path),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(20),
          children: [
            RemoteView(
              path: path,
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
                  SectionTitle(c.tr('shop.about')),
                  Panel(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          string(
                            shop['description'],
                            c.tr('shop.defaultDescription'),
                          ),
                        ),
                        verticalGap(),
                        Text(
                          string(
                            shop['publicLocation'],
                            c.tr('common.sriLanka'),
                          ),
                        ),
                        if (shop['createdAt'] != null) ...[
                          verticalGap(6),
                          Text(
                            c.tr('shop.joined', {
                              'date': dateText(shop['createdAt']),
                            }),
                            style: Theme.of(c).textTheme.bodySmall,
                          ),
                        ],
                        if (shop['shippingFeeLkrMinor'] != null) ...[
                          verticalGap(),
                          MoneyRow(
                            c.tr('shop.standardDelivery'),
                            integer(shop['shippingFeeLkrMinor']),
                          ),
                        ],
                        Notice(c.tr('shop.deliveryNotice')),
                      ],
                    ),
                  ),
                  SectionTitle(c.tr('shop.categories')),
                  Wrap(
                    spacing: 8,
                    children: objects(shop['categories'])
                        .map(
                          (r) => ActionChip(
                            label: Text(string(r['name'])),
                            onPressed: () => c.push(
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
      ),
    );
  }
}
