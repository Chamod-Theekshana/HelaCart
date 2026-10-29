import '../../../app/hc.dart';
import 'home_screen.dart';
import 'product_widgets.dart';

class CatalogScreen extends ConsumerStatefulWidget {
  const CatalogScreen({
    super.key,
    this.initial = const {},
    this.shopSlug,
    this.openFilters = false,
  });
  final Map<String, String> initial;
  final String? shopSlug;
  final bool openFilters;
  @override
  ConsumerState<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends ConsumerState<CatalogScreen> {
  @override
  void initState() {
    super.initState();
    if (widget.openFilters) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) filterSheet();
      });
    }
  }

  late Map<String, String> filters = {...widget.initial};
  int page = 1;
  String get query =>
      Uri(queryParameters: {...filters, 'page': '$page', 'limit': '20'}).query;
  Future<void> filterSheet() async {
    List<Json> categoryRows = [];
    try {
      categoryRows = await ref.read(categoriesProvider.future);
    } catch (_) {
      /* Other filters remain usable. */
    }
    if (!mounted) return;
    final min = TextEditingController(
          text: filters['minPrice'] == null
              ? ''
              : (int.parse(filters['minPrice']!) / 100).toStringAsFixed(2),
        ),
        max = TextEditingController(
          text: filters['maxPrice'] == null
              ? ''
              : (int.parse(filters['maxPrice']!) / 100).toStringAsFixed(2),
        );
    var category = filters['category'],
        stock = filters['inStock'] == 'true',
        offers = filters['deals'] == 'true';
    if (!categoryRows.any((row) => row['slug'] == category)) {
      category = null;
    }
    String? error;
    final result = await showModalBottomSheet<Map<String, String>>(
      context: context,
      isScrollControlled: true,
      builder: (c) => StatefulBuilder(
        builder: (c, update) => SafeArea(
          child: Padding(
            padding: EdgeInsets.fromLTRB(
              20,
              0,
              20,
              MediaQuery.viewInsetsOf(c).bottom + 20,
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Filter products',
                    style: Theme.of(c).textTheme.titleLarge,
                  ),
                  verticalGap(),
                  DropdownButtonFormField<String>(
                    initialValue: category,
                    decoration: const InputDecoration(labelText: 'Category'),
                    isExpanded: true,
                    items: [
                      const DropdownMenuItem(
                        value: null,
                        child: Text('All categories'),
                      ),
                      ...categoryRows.map(
                        (r) => DropdownMenuItem(
                          value: string(r['slug']),
                          child: Text(
                            string(r['name']),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ),
                    ],
                    onChanged: (v) => update(() => category = v),
                  ),
                  verticalGap(),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: min,
                          keyboardType: const TextInputType.numberWithOptions(
                            decimal: true,
                          ),
                          decoration: const InputDecoration(
                            labelText: 'Min price (Rs.)',
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: max,
                          keyboardType: const TextInputType.numberWithOptions(
                            decimal: true,
                          ),
                          decoration: const InputDecoration(
                            labelText: 'Max price (Rs.)',
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (widget.shopSlug == null) ...[
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('In stock only'),
                      value: stock,
                      onChanged: (v) => update(() => stock = v),
                    ),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Active offers only'),
                      value: offers,
                      onChanged: (v) => update(() => offers = v),
                    ),
                  ],
                  if (error != null) Notice(error!, error: true),
                  verticalGap(),
                  FilledButton(
                    onPressed: () {
                      final minimum = min.text.isEmpty
                              ? null
                              : parseMinor(min.text),
                          maximum = max.text.isEmpty
                              ? null
                              : parseMinor(max.text);
                      if ((min.text.isNotEmpty && minimum == null) ||
                          (max.text.isNotEmpty && maximum == null) ||
                          (minimum != null &&
                              maximum != null &&
                              minimum > maximum)) {
                        update(
                          () => error = 'Enter valid prices; minimum must not exceed maximum.',
                        );
                        return;
                      }
                      Navigator.pop(c, {
                        if (category != null) 'category': category!,
                        if (minimum != null) 'minPrice': '$minimum',
                        if (maximum != null) 'maxPrice': '$maximum',
                        if (stock) 'inStock': 'true',
                        if (offers) 'deals': 'true',
                      });
                    },
                    child: const Text('Apply filters'),
                  ),
                  TextButton(
                    onPressed: () => Navigator.pop(c, <String, String>{}),
                    child: const Text('Reset filters'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    min.dispose();
    max.dispose();
    if (result != null && mounted) {
      setState(() {
        filters.removeWhere(
          (key, _) => [
            'category',
            'minPrice',
            'maxPrice',
            'inStock',
            'deals',
          ].contains(key),
        );
        filters.addAll(result);
        page = 1;
      });
    }
  }

  Future<void> sortSheet() async {
    final result = await showModalBottomSheet<String>(
      context: context,
      builder: (c) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final pair in [
              if (widget.shopSlug == null) ('relevance', 'Relevance'),
              ('newest', 'Newest'),
              ('price-asc', 'Price: low to high'),
              ('price-desc', 'Price: high to low'),
              ('name', 'Name: A–Z'),
            ])
              ListTile(
                title: Text(pair.$2),
                trailing: filters['sort'] == pair.$1
                    ? const Icon(Icons.check, color: HelaColors.teal)
                    : null,
                onTap: () => Navigator.pop(c, pair.$1),
              ),
          ],
        ),
      ),
    );
    if (result != null && mounted) {
      setState(() {
        filters['sort'] = result;
        page = 1;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final slug = widget.shopSlug;
    final path = slug == null
        ? null
        : '/shops/${Uri.encodeComponent(slug)}/products?$query';
    Widget content(PageData<Product> data) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('${data.total} products'),
        verticalGap(),
        if (data.items.isEmpty)
          EmptyState(
            title: 'No matching finds',
            message: 'Try another search or remove a filter.',
            action: OutlinedButton(
              onPressed: () => setState(() {
                filters = {};
                page = 1;
              }),
              child: const Text('Clear filters'),
            ),
          )
        else
          ProductGrid(data.items),
        Pager(
          page: page,
          pages: data.pages,
          change: (v) => setState(() => page = v),
        ),
      ],
    );
    return PageFrame(
      title: filters['deals'] == 'true'
          ? 'Offers'
          : slug != null
          ? 'Shop products'
          : filters['q'] != null
          ? 'Search results'
          : 'All products',
      actions: const [ShoppingActions()],
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          if (slug != null) const Text('Products from this shop only'),
          if (slug != null) ShopTabs(slug: slug, selected: 'products'),
          TextFormField(
            initialValue: filters['q'],
            maxLength: 80,
            decoration: InputDecoration(
              hintText: slug == null ? 'Search products' : 'Search this shop',
              prefixIcon: const Icon(Icons.search),
              counterText: '',
            ),
            textInputAction: TextInputAction.search,
            onFieldSubmitted: (v) => setState(() {
              if (v.trim().isEmpty) {
                filters.remove('q');
              } else {
                filters['q'] = v.trim();
              }
              page = 1;
            }),
          ),
          verticalGap(12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: filterSheet,
                  icon: const Icon(Icons.tune, size: 18),
                  label: const Text('Filter'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: sortSheet,
                  icon: const Icon(Icons.swap_vert, size: 18),
                  label: const Text('Sort'),
                ),
              ),
            ],
          ),
          if (filters.keys.any((key) => key != 'sort')) ...[
            verticalGap(8),
            Wrap(
              spacing: 6,
              children: filters.entries
                  .where((e) => e.key != 'sort')
                  .map(
                    (e) => InputChip(
                      label: Text(
                        '${label(e.key)}: ${e.value}',
                        style: const TextStyle(fontSize: 11),
                      ),
                      onDeleted: () => setState(() {
                        filters.remove(e.key);
                        page = 1;
                      }),
                    ),
                  )
                  .toList(),
            ),
          ],
          verticalGap(12),
          if (path != null)
            RemoteView(
              path: path,
              builder: (c, data) =>
                  content(PageData.fromJson(data, Product.fromJson)),
            )
          else
            ref
                .watch(productsProvider(query))
                .when(
                  data: content,
                  loading: () => const LoadingBlocks(),
                  error: (e, _) => ErrorState(
                    e,
                    retry: () => ref.invalidate(productsProvider(query)),
                  ),
                ),
        ],
      ),
    );
  }
}
