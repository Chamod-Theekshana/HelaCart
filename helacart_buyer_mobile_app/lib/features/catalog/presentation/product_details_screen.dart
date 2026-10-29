import '../../../app/hc.dart';
import 'home_screen.dart';
import 'product_widgets.dart';

class ProductDetailsScreen extends ConsumerWidget {
  const ProductDetailsScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context, WidgetRef ref) => ref
      .watch(productProvider(id))
      .when(
        data: (p) => ProductDetails(product: p),
        loading: () =>
            const PageFrame(title: 'Product', child: LoadingBlocks()),
        error: (e, _) => PageFrame(
          title: 'Product unavailable',
          child: ErrorState(
            e,
            retry: () => ref.invalidate(productProvider(id)),
          ),
        ),
      );
}

class ProductDetails extends ConsumerStatefulWidget {
  const ProductDetails({super.key, required this.product});
  final Product product;
  @override
  ConsumerState<ProductDetails> createState() => _ProductDetailsState();
}

class _ProductDetailsState extends ConsumerState<ProductDetails> {
  late String selected =
      widget.product.availableVariant?.id ??
      widget.product.variants.firstOrNull?.id ??
      '';
  int quantity = 1, image = 0;
  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    final variant = p.variants.where((v) => v.id == selected).firstOrNull;
    final stock = variant?.availableQuantity ?? 0;
    return PageFrame(
      title: 'Good find',
      actions: [
        FavoriteHeart(p),
        IconButton(
          tooltip: 'Cart',
          onPressed: () => context.push('/cart'),
          icon: const Icon(Icons.shopping_bag_outlined),
        ),
      ],
      bottom: ActionButton(
        label: stock == 0
            ? 'Currently sold out'
            : '${p.variants.length > 1 ? 'Choose options' : 'Add to cart'} · ${money(variant?.priceLkrMinor ?? p.displayPrice)}',
        enabled: stock > 0 && quantity <= stock,
        icon: Icons.shopping_bag_outlined,
        action: () async {
          Variant chosen = variant!;
          var count = quantity;
          if (p.variants.length > 1) {
            final result = await showModalBottomSheet<(Variant, int)>(
              context: context,
              isScrollControlled: true,
              builder: (c) => VariantSelectionSheet(
                product: p,
                selected: selected,
                quantity: quantity,
              ),
            );
            if (result == null || !context.mounted) return;
            chosen = result.$1;
            count = result.$2;
            setState(() {
              selected = chosen.id;
              quantity = count;
            });
          }
          if (context.mounted) await addProduct(context, ref, p, chosen, count);
        },
      ),
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Panel(
            padding: EdgeInsets.zero,
            child: AspectRatio(
              aspectRatio: 1,
              child: InkWell(
                onTap: () => context.push('/gallery/${p.id}?image=$image'),
                child: ProductPhoto(p.imageUrls.elementAtOrNull(image)),
              ),
            ),
          ),
          if (p.imageUrls.length > 1)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Wrap(
                spacing: 10,
                children: [
                  for (var i = 0; i < p.imageUrls.length; i++)
                    InkWell(
                      onTap: () => setState(() => image = i),
                      child: Container(
                        width: 58,
                        height: 58,
                        padding: const EdgeInsets.all(3),
                        decoration: BoxDecoration(
                          border: Border.all(
                            color: image == i
                                ? HelaColors.teal
                                : HelaColors.border,
                          ),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: ProductPhoto(p.imageUrls[i]),
                      ),
                    ),
                ],
              ),
            ),
          verticalGap(16),
          Text(
            string(p.category['name']),
            style: const TextStyle(
              color: HelaColors.teal,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
          verticalGap(8),
          Text(
            p.title,
            style: Theme.of(context).textTheme.headlineSmall
                ?.copyWith(fontSize: 20),
          ),
          verticalGap(12),
          if (p.promotion != null) Notice(string(p.promotion!['name'])),
          if (variant?.originalPriceLkrMinor != null &&
              variant!.originalPriceLkrMinor! > variant.priceLkrMinor)
            Text(
              money(variant.originalPriceLkrMinor!),
              style: const TextStyle(
                decoration: TextDecoration.lineThrough,
                color: HelaColors.muted,
              ),
            ),
          Text(
            money(variant?.priceLkrMinor ?? p.displayPrice),
            style: const TextStyle(
              fontFamily: 'PlusJakartaSans',
              fontSize: 24,
              fontWeight: FontWeight.w700,
              color: HelaColors.teal,
            ),
          ),
          verticalGap(),
          if (p.variants.length > 1) ...[
            const Text(
              'Choose an option',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
            verticalGap(8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: p.variants
                  .map(
                    (v) => ChoiceChip(
                      selected: selected == v.id,
                      label: Text(
                        '${v.optionLabel}${v.availableQuantity == 0 ? ' · Sold out' : ''}',
                      ),
                      onSelected: (_) => setState(() {
                        selected = v.id;
                        quantity = 1;
                      }),
                    ),
                  )
                  .toList(),
            ),
            verticalGap(),
          ],
          Text(
            stock > 0
                ? '$stock available'
                : 'This option is currently out of stock',
            style: TextStyle(
              color: stock > 0 ? HelaColors.teal : HelaColors.muted,
            ),
          ),
          Row(
            children: [
              const Expanded(child: Text('Quantity')),
              IconButton(
                tooltip: 'Decrease quantity',
                onPressed: quantity > 1
                    ? () => setState(() => quantity--)
                    : null,
                icon: const Icon(Icons.remove_circle_outline),
              ),
              Text('$quantity'),
              IconButton(
                tooltip: 'Increase quantity',
                onPressed: quantity < stock && quantity < 100
                    ? () => setState(() => quantity++)
                    : null,
                icon: const Icon(Icons.add_circle_outline),
              ),
            ],
          ),
          verticalGap(),
          Panel(
            child: ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(
                Icons.storefront_outlined,
                color: HelaColors.teal,
              ),
              title: Text(p.shopName),
              subtitle: const Text('Visit this shop'),
              trailing: const Icon(Icons.chevron_right),
              onTap: p.shopSlug.isEmpty
                  ? null
                  : () => context.push(
                      '/shops/${Uri.encodeComponent(p.shopSlug)}',
                    ),
            ),
          ),
          const SectionTitle('The details'),
          Text(
            p.description?.isNotEmpty == true
                ? p.description!
                : 'Explore this find from a HelaCart shop.',
          ),
          if (p.brand?.isNotEmpty == true) ...[
            verticalGap(),
            Text('Brand: ${p.brand}'),
          ],
          if (p.specifications.isNotEmpty) ...[
            const SectionTitle('Specifications'),
            Panel(
              child: Column(
                children: p.specifications
                    .map(
                      (r) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 7),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Text(
                                string(r['name']),
                                style: const TextStyle(color: HelaColors.muted),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(child: Text(string(r['value']))),
                          ],
                        ),
                      ),
                    )
                    .toList(),
              ),
            ),
          ],
          if (p.warranty?.isNotEmpty == true) ...[
            const SectionTitle('Shop warranty'),
            Text(p.warranty!),
          ],
          verticalGap(20),
          const Notice(
            'Cash on delivery. Final delivery fee is confirmed for your address at checkout.',
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Product reviews'),
            subtitle: const Text('Read verified-purchase experiences'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push('/products/${p.id}/reviews'),
          ),
          RecommendationsSection(productId: p.id),
          verticalGap(20),
        ],
      ),
    );
  }
}

class VariantSelectionSheet extends StatefulWidget {
  const VariantSelectionSheet({
    super.key,
    required this.product,
    required this.selected,
    required this.quantity,
  });
  final Product product;
  final String selected;
  final int quantity;
  @override
  State<VariantSelectionSheet> createState() => _VariantSelectionSheetState();
}

class _VariantSelectionSheetState extends State<VariantSelectionSheet> {
  late String selected = widget.selected;
  late int quantity = widget.quantity;
  @override
  Widget build(BuildContext context) {
    final variant = widget.product.variants.firstWhere((v) => v.id == selected);
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(HelaSpacing.screen),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Choose your option',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            verticalGap(),
            Text(widget.product.title),
            verticalGap(8),
            Text(
              money(variant.priceLkrMinor),
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: HelaColors.teal,
              ),
            ),
            verticalGap(),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: widget.product.variants
                  .map(
                    (v) => ChoiceChip(
                      label: Text(
                        '${v.optionLabel}${v.availableQuantity == 0 ? ' · Sold out' : ''}',
                      ),
                      selected: selected == v.id,
                      onSelected: (_) => setState(() {
                        selected = v.id;
                        quantity = 1;
                      }),
                    ),
                  )
                  .toList(),
            ),
            verticalGap(),
            Text(
              variant.availableQuantity > 0
                  ? '${variant.availableQuantity} available'
                  : 'This option is sold out',
            ),
            Row(
              children: [
                const Expanded(child: Text('Quantity')),
                IconButton(
                  tooltip: 'Decrease quantity',
                  onPressed: quantity > 1
                      ? () => setState(() => quantity--)
                      : null,
                  icon: const Icon(Icons.remove_circle_outline),
                ),
                Text('$quantity'),
                IconButton(
                  tooltip: 'Increase quantity',
                  onPressed:
                      quantity < variant.availableQuantity && quantity < 100
                      ? () => setState(() => quantity++)
                      : null,
                  icon: const Icon(Icons.add_circle_outline),
                ),
              ],
            ),
            verticalGap(),
            FilledButton(
              onPressed:
                  variant.availableQuantity > 0 &&
                      quantity <= variant.availableQuantity
                  ? () => Navigator.pop(context, (variant, quantity))
                  : null,
              child: const Text('Add to cart'),
            ),
          ],
        ),
      ),
    );
  }
}

class ProductGalleryScreen extends ConsumerWidget {
  const ProductGalleryScreen({super.key, required this.id, this.initial = 0});
  final String id;
  final int initial;
  @override
  Widget build(BuildContext context, WidgetRef ref) => PageFrame(
    title: 'Product photos',
    child: ref
        .watch(productProvider(id))
        .when(
          data: (p) => p.imageUrls.isEmpty
              ? const EmptyState(
                  title: 'Photo unavailable',
                  message: 'This shop has not supplied a product photo.',
                )
              : _GalleryPages(
                  key: ValueKey((id, p.imageUrls.length, initial)),
                  images: p.imageUrls,
                  initial: initial,
                ),
          loading: () => const LoadingBlocks(),
          error: (e, _) =>
              ErrorState(e, retry: () => ref.invalidate(productProvider(id))),
        ),
  );
}

class _GalleryPages extends StatefulWidget {
  const _GalleryPages({super.key, required this.images, required this.initial});
  final List<String> images;
  final int initial;
  @override
  State<_GalleryPages> createState() => _GalleryPagesState();
}

class _GalleryPagesState extends State<_GalleryPages> {
  late final controller = PageController(
    initialPage: widget.initial.clamp(0, widget.images.length - 1),
  );
  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => PageView.builder(
    controller: controller,
    itemCount: widget.images.length,
    itemBuilder: (c, i) => Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: Text('${i + 1} of ${widget.images.length}'),
        ),
        Expanded(
          child: InteractiveViewer(
            child: Center(child: ProductPhoto(widget.images[i])),
          ),
        ),
      ],
    ),
  );
}
