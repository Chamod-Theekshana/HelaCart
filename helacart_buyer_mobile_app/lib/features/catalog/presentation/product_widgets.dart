import 'package:cached_network_image/cached_network_image.dart';
import 'package:share_plus/share_plus.dart';

import '../../../app/hc.dart';
import '../../cart/application/cart_actions.dart';

/// Shares a public https product/shop link (Android App Links / iOS universal
/// links open it in the app; otherwise the web storefront).
class ShareLinkButton extends StatelessWidget {
  const ShareLinkButton({
    super.key,
    required this.tooltip,
    required this.url,
    required this.text,
  });
  final String tooltip, text;
  final Uri url;
  @override
  Widget build(BuildContext context) => IconButton(
    tooltip: tooltip,
    icon: const Icon(Icons.share_outlined),
    onPressed: () async {
      final box = context.findRenderObject();
      final origin = box is RenderBox && box.hasSize
          ? box.localToGlobal(Offset.zero) & box.size
          : null;
      try {
        await SharePlus.instance.share(
          ShareParams(
            text: '$text\n$url',
            subject: text,
            sharePositionOrigin: origin,
          ),
        );
      } catch (_) {
        if (context.mounted) toast(context, context.tr('legal.openFailed'));
      }
    },
  );
}

class FavoriteHeart extends ConsumerWidget {
  const FavoriteHeart(this.product, {super.key});
  final Product product;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final index = ref.watch(favoriteIndexProvider);
    final saved = index.value?[product.id];
    return IconButton(
      tooltip: saved == null
          ? context.tr('product.save', {'title': product.title})
          : context.tr('product.removeFavorite'),
      style: IconButton.styleFrom(
        padding: const EdgeInsets.all(8),
        foregroundColor: HelaColors.teal,
      ),
      icon: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: .95),
          shape: BoxShape.circle,
        ),
        child: Icon(
          saved == null ? Icons.favorite_border : Icons.favorite,
          size: 19,
        ),
      ),
      onPressed: () async {
        if (ref.read(sessionProvider).value == null) {
          context.push(
            '/auth?next=${Uri.encodeQueryComponent('/products/${product.id}')}&favorite=${Uri.encodeQueryComponent(product.id)}',
          );
          return;
        }
        try {
          if (index.hasError) {
            ref.invalidate(favoriteIndexProvider);
            throw AppFailure(context.tr('product.refreshFavorites'));
          }
          await ref
              .read(repositoryProvider)
              .write(
                saved == null
                    ? '/me/favorites/products/${product.id}'
                    : '/me/favorites/$saved',
                saved == null ? 'PUT' : 'DELETE',
              );
          ref.invalidate(favoriteIndexProvider);
          ref.invalidate(resourceProvider);
        } catch (e) {
          if (context.mounted) toast(context, friendlyError(e));
        }
      },
    );
  }
}

Future<void> addProduct(
  BuildContext context,
  WidgetRef ref,
  Product product,
  Variant variant,
  int quantity,
) async {
  final session = ref.read(sessionProvider).value;
  if (session == null) {
    context.push(
      '/auth?next=${Uri.encodeQueryComponent('/products/${product.id}')}',
    );
    return;
  }
  if (!session.verified) {
    context.push(
      '/verify?next=${Uri.encodeQueryComponent('/products/${product.id}')}',
    );
    return;
  }
  await ref
      .read(cartActionsProvider)
      .add(variant.id, quantity, variant.availableQuantity);
  ref.invalidate(cartProvider);
  if (context.mounted) {
    await showModalBottomSheet<void>(
      context: context,
      builder: (c) => SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(HelaSpacing.screen),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(
                Icons.check_circle_outline,
                size: 40,
                color: HelaColors.teal,
              ),
              verticalGap(),
              Text(
                c.tr('product.added'),
                style: Theme.of(c).textTheme.titleLarge,
                textAlign: TextAlign.center,
              ),
              verticalGap(8),
              Text(
                '${product.title}\n${c.tr('product.addedDetail', {'option': variant.optionLabel, 'quantity': quantity})}',
                textAlign: TextAlign.center,
              ),
              verticalGap(20),
              FilledButton(
                onPressed: () {
                  Navigator.pop(c);
                  context.push('/cart');
                },
                child: Text(c.tr('product.viewCart')),
              ),
              TextButton(
                onPressed: () => Navigator.pop(c),
                child: Text(c.tr('product.continueShopping')),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ProductTile extends ConsumerWidget {
  const ProductTile(this.product, {super.key});
  final Product product;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final variant = product.availableVariant;
    final original =
        variant?.originalPriceLkrMinor ?? product.originalPriceLkrMinor;
    final scale = MediaQuery.textScalerOf(context).scale(13) / 13;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Stack(
          children: [
            AspectRatio(
              aspectRatio: 1,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: Material(
                  color: HelaColors.image,
                  child: InkWell(
                    onTap: () => context.push('/products/${product.id}'),
                    child: Padding(
                      padding: const EdgeInsets.all(10),
                      child: ProductPhoto(product.imageUrls.firstOrNull),
                    ),
                  ),
                ),
              ),
            ),
            Positioned(top: 2, right: 2, child: FavoriteHeart(product)),
            if (product.promotion != null)
              Positioned(
                left: 8,
                bottom: 10,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 7,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(5),
                  ),
                  child: Text(
                    context.tr('product.off', {
                      'percent':
                          integer(product.promotion!['discountBps']) / 100,
                    }),
                    style: const TextStyle(
                      color: HelaColors.teal,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
          ],
        ),
        verticalGap(8),
        Text(
          product.shopName,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontSize: 11, color: HelaColors.muted),
        ),
        InkWell(
          onTap: () => context.push('/products/${product.id}'),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: 48 * scale),
            child: Text(
              product.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontWeight: FontWeight.w500,
                fontSize: 13,
                height: 1.45,
              ),
            ),
          ),
        ),
        Wrap(
          spacing: 6,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text(
              money(product.displayPrice),
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 14,
                color: HelaColors.navy,
              ),
            ),
            if (original != null && original > product.displayPrice)
              Text(
                money(original),
                style: const TextStyle(
                  decoration: TextDecoration.lineThrough,
                  color: HelaColors.muted,
                  fontSize: 11,
                ),
              ),
          ],
        ),
        Text(
          context.tr(variant == null ? 'product.soldOut' : 'product.inStock'),
          style: TextStyle(
            fontSize: 11,
            color: variant == null ? HelaColors.muted : HelaColors.teal,
          ),
        ),
        const Spacer(),
        ActionButton(
          label: context.tr(
            product.variants.length > 1
                ? 'product.chooseOptions'
                : variant == null
                ? 'product.viewProduct'
                : 'product.addToBag',
          ),
          compact: true,
          icon: product.variants.length > 1 || variant == null
              ? Icons.arrow_forward
              : Icons.add,
          action: () async {
            if (variant == null || product.variants.length > 1) {
              context.push('/products/${product.id}');
              return;
            }
            await addProduct(context, ref, product, variant, 1);
          },
        ),
      ],
    );
  }
}

class ProductGrid extends StatelessWidget {
  const ProductGrid(this.products, {super.key});
  final List<Product> products;
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, box) {
      final scale = MediaQuery.textScalerOf(context).scale(14) / 14;
      final columns = scale > 1.35
          ? 1
          : box.maxWidth >= 700
          ? 4
          : box.maxWidth >= 540
          ? 3
          : 2;
      final width = (box.maxWidth - (columns - 1) * 14) / columns;
      return Column(
        children: [
          for (var start = 0; start < products.length; start += columns)
            Padding(
              padding: EdgeInsets.only(
                bottom: start + columns < products.length ? 16 : 0,
              ),
              child: IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (var column = 0; column < columns; column++) ...[
                      if (column > 0) const SizedBox(width: 14),
                      SizedBox(
                        width: width,
                        child: start + column < products.length
                            ? ProductTile(products[start + column])
                            : null,
                      ),
                    ],
                  ],
                ),
              ),
            ),
        ],
      );
    },
  );
}

/// Shop logo, or the shop's initial when there is no logo or it fails to load.
class ShopAvatar extends StatelessWidget {
  const ShopAvatar(
    this.shop, {
    super.key,
    this.backgroundColor = HelaColors.mint,
    this.style,
  });
  final Json shop;
  final Color backgroundColor;
  final TextStyle? style;
  @override
  Widget build(BuildContext context) {
    final logo = Uri.tryParse(string(shop['logoUrl']));
    final hasLogo = logo != null && ['http', 'https'].contains(logo.scheme);
    return CircleAvatar(
      backgroundColor: backgroundColor,
      // The initial stays underneath and shows if the logo fails.
      foregroundImage: hasLogo
          ? CachedNetworkImageProvider(logo.toString(), maxWidth: 160)
          : null,
      onForegroundImageError: hasLogo ? (_, _) {} : null,
      child: Text(string(shop['name'], 'H').substring(0, 1), style: style),
    );
  }
}

class ShopCard extends StatelessWidget {
  const ShopCard(this.shop, {super.key});
  final Json shop;
  @override
  Widget build(BuildContext context) {
    final rating = object(shop['rating']);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Panel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                ShopAvatar(
                  shop,
                  style: const TextStyle(
                    color: HelaColors.teal,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    string(shop['name']),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                if (boolean(shop['isVerified']))
                  IconButton(
                    tooltip: context.tr('shop.verified'),
                    onPressed: () => verifiedShopInfo(context),
                    icon: const Icon(
                      Icons.verified_outlined,
                      color: HelaColors.teal,
                    ),
                  ),
              ],
            ),
            verticalGap(8),
            Text(
              string(shop['publicLocation'], context.tr('common.sriLanka')),
              style: Theme.of(context).textTheme.bodySmall,
            ),
            verticalGap(8),
            Wrap(
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 12,
              runSpacing: 8,
              children: [
                Text(
                  integer(rating['total']) > 0
                      ? context.tr('shop.rating', {
                          'average': rating['average'],
                          'total': rating['total'],
                        })
                      : context.tr('shop.noReviews'),
                  style: const TextStyle(fontSize: 12),
                ),
                TextButton(
                  onPressed: () => context.push(
                    '/shops/${Uri.encodeComponent(string(shop['slug']))}',
                  ),
                  child: Text(context.tr('shop.visit')),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class ShopTabs extends StatelessWidget {
  const ShopTabs({super.key, required this.slug, required this.selected});
  final String slug, selected;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 12),
    child: Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final entry in const {
          'products': 'shop.tabProducts',
          'reviews': 'shop.tabReviews',
          'about': 'shop.tabAbout',
        }.entries)
          ChoiceChip(
            label: Text(context.tr(entry.value)),
            selected: selected == entry.key,
            onSelected: (_) {
              if (entry.key == selected) return;
              final path = '/shops/${Uri.encodeComponent(slug)}';
              context.push(entry.key == 'about' ? path : '$path/${entry.key}');
            },
          ),
      ],
    ),
  );
}

Future<void> verifiedShopInfo(BuildContext context) =>
    showModalBottomSheet<void>(
      context: context,
      builder: (c) => SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(HelaSpacing.screen),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(
                Icons.verified_outlined,
                size: 48,
                color: HelaColors.teal,
              ),
              verticalGap(),
              Text(
                c.tr('shop.verified'),
                style: Theme.of(c).textTheme.titleLarge,
                textAlign: TextAlign.center,
              ),
              verticalGap(),
              Text(c.tr('shop.verifiedBody')),
              verticalGap(20),
              FilledButton(
                onPressed: () => Navigator.pop(c),
                child: Text(c.tr('shop.gotIt')),
              ),
            ],
          ),
        ),
      ),
    );
