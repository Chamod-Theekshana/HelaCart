import '../network/api_client.dart';
import 'buyer_repository.dart';
import 'json.dart';
import 'models.dart';

/// Explicit, read-only design preview. Never substitutes for a failed live API.
class PreviewRepository implements BuyerRepository {
  static const categoryRows = [
    {
      'id': 'fashion',
      'slug': 'fashion',
      'name': 'Fashion & Apparel',
      'asset': 'assets/images/category-fashion.jpg',
    },
    {
      'id': 'home',
      'slug': 'home',
      'name': 'Home & Kitchen',
      'asset': 'assets/images/category-kitchen.jpg',
    },
    {
      'id': 'pantry',
      'slug': 'pantry',
      'name': 'Ceylon Pantry',
      'asset': 'assets/images/category-pantry.jpg',
    },
    {
      'id': 'beauty',
      'slug': 'beauty',
      'name': 'Health & Beauty',
      'asset': 'assets/images/category-wellness.jpg',
    },
  ];
  static final productRows = <Product>[
    Product(
      id: 'preview-shirt',
      title: 'Handwoven Premium Cotton Linen Shirt',
      description: 'A light, comfortable linen blend for slow mornings and everyday adventures.',
      brand: 'Ceylon Threads',
      imageUrls: const ['asset:assets/images/preview-shirt.jpg'],
      priceLkrMinor: 436500,
      originalPriceLkrMinor: 485000,
      category: categoryRows[0],
      seller: const {
        'id': 'preview-shop-a',
        'name': 'Ceylon Threads',
        'slug': 'ceylon-threads',
      },
      variants: const [
        Variant(
          id: 'preview-m',
          sku: 'CT-NAT-M',
          optionValues: {'Color': 'Natural', 'Size': 'M'},
          priceLkrMinor: 436500,
          originalPriceLkrMinor: 485000,
          availableQuantity: 6,
        ),
        Variant(
          id: 'preview-l',
          sku: 'CT-NAT-L',
          optionValues: {'Color': 'Natural', 'Size': 'L'},
          priceLkrMinor: 436500,
          availableQuantity: 0,
        ),
      ],
      promotion: const {
        'id': 'preview-offer',
        'name': 'Local finds · 10% off',
        'discountBps': 1000,
      },
      specifications: const [
        {'name': 'Material', 'value': 'Cotton linen blend'},
      ],
    ),
    Product(
      id: 'preview-coffee',
      title: 'Stainless Steel French Press Coffee Maker',
      description: 'A considered addition to your morning ritual.',
      imageUrls: const ['asset:assets/images/preview-coffee.jpg'],
      priceLkrMinor: 365000,
      category: categoryRows[1],
      seller: const {
        'id': 'preview-shop-b',
        'name': 'Urban Living Store',
        'slug': 'urban-living-store',
      },
      variants: const [
        Variant(
          id: 'preview-600',
          sku: 'UL-FP-600',
          optionValues: {'Capacity': '600 ml'},
          priceLkrMinor: 365000,
          availableQuantity: 12,
        ),
      ],
    ),
    Product(
      id: 'preview-pantry',
      title: 'Organic Ceylon Pantry Collection',
      description: 'Everyday favourites from independent Sri Lankan shops.',
      imageUrls: const ['asset:assets/images/preview-tea.jpg'],
      priceLkrMinor: 295000,
      category: categoryRows[2],
      seller: const {'name': 'Kandy Harvest Co.', 'slug': 'kandy-harvest'},
      variants: const [
        Variant(id: 'preview-p', priceLkrMinor: 295000, availableQuantity: 9),
      ],
    ),
    Product(
      id: 'preview-wellness',
      title: 'Botanical Everyday Care Set',
      imageUrls: const ['asset:assets/images/category-wellness.jpg'],
      priceLkrMinor: 245000,
      category: categoryRows[3],
      seller: const {'name': 'Island Organics', 'slug': 'island-organics'},
      variants: const [
        Variant(id: 'preview-w', priceLkrMinor: 245000, availableQuantity: 8),
      ],
    ),
  ];
  static final shops = <Json>[
    {
      'id': 'preview-shop-a',
      'name': 'Ceylon Threads',
      'slug': 'ceylon-threads',
      'description': 'Everyday pieces, thoughtfully chosen.',
      'publicLocation': 'Kandy, Sri Lanka',
      'isVerified': true,
      'productCount': 1,
      'rating': {'total': 0, 'average': 0, 'breakdown': []},
      'categories': [categoryRows[0]],
      'shippingFeeLkrMinor': 35000,
    },
    {
      'id': 'preview-shop-b',
      'name': 'Urban Living Store',
      'slug': 'urban-living-store',
      'description': 'Good things for the place you call home.',
      'publicLocation': 'Colombo, Sri Lanka',
      'isVerified': false,
      'productCount': 1,
      'rating': {'total': 0, 'average': 0, 'breakdown': []},
      'categories': [categoryRows[1]],
      'shippingFeeLkrMinor': 45000,
    },
    {
      'id': 'preview-shop-c',
      'name': 'Kandy Harvest Co.',
      'slug': 'kandy-harvest',
      'description': 'Small-batch pantry favourites from the hill country.',
      'publicLocation': 'Kandy, Sri Lanka',
      'isVerified': false,
      'productCount': 1,
      'rating': {'total': 0, 'average': 0, 'breakdown': []},
      'categories': [categoryRows[2]],
      'shippingFeeLkrMinor': 35000,
    },
    {
      'id': 'preview-shop-d',
      'name': 'Island Organics',
      'slug': 'island-organics',
      'description': 'Thoughtful everyday care, inspired by island living.',
      'publicLocation': 'Galle, Sri Lanka',
      'isVerified': false,
      'productCount': 1,
      'rating': {'total': 0, 'average': 0, 'breakdown': []},
      'categories': [categoryRows[3]],
      'shippingFeeLkrMinor': 40000,
    },
  ];
  @override
  Future<List<Json>> categories() async => categoryRows;
  @override
  Future<Product> product(String id) async => productRows.firstWhere(
    (p) => p.id == id,
    orElse: () => throw const AppFailure(
      'This preview product is unavailable.',
      status: 404,
    ),
  );
  @override
  Future<PageData<Product>> products(String query) async {
    final q = Uri.splitQueryString(query);
    var result = productRows
        .where(
          (p) =>
              (q['q'] == null ||
                  '${p.title} ${p.shopName}'.toLowerCase().contains(
                    q['q']!.toLowerCase(),
                  )) &&
              (q['category'] == null || p.category['slug'] == q['category']) &&
              (q['deals'] != 'true' || p.promotion != null) &&
              (q['minPrice'] == null ||
                  p.displayPrice >= int.parse(q['minPrice']!)) &&
              (q['maxPrice'] == null ||
                  p.displayPrice <= int.parse(q['maxPrice']!)),
        )
        .toList();
    if (q['sort'] == 'price-asc') {
      result.sort((a, b) => a.displayPrice.compareTo(b.displayPrice));
    }
    if (q['sort'] == 'price-desc') {
      result.sort((a, b) => b.displayPrice.compareTo(a.displayPrice));
    }
    if (q['sort'] == 'name') {
      result.sort((a, b) => a.title.compareTo(b.title));
    }
    return PageData(result, total: result.length);
  }

  @override
  Future<Object?> read(String path, {bool private = false}) async {
    if (private) {
      throw const AppFailure(
        'Sign in with a configured live app to use account features.',
      );
    }
    final uri = Uri.parse(path);
    if (uri.path == '/storefront/hero') {
      return {
        'title': 'Good finds.',
        'accent': 'Local roots.',
        'description': 'Discover everyday favourites from independent shops across Sri Lanka.',
        'buttonLabel': 'Shop now',
        'buttonHref': '/products',
      };
    }
    if (uri.path == '/shops') {
      return {'items': shops, 'total': shops.length, 'pages': 1};
    }
    if (uri.path.startsWith('/shops/')) {
      final slug = uri.pathSegments[1];
      final shop = shops.firstWhere(
        (s) => s['slug'] == slug,
        orElse: () => throw const AppFailure('Shop unavailable.', status: 404),
      );
      if (uri.path.endsWith('/products')) {
        final list = productRows
            .where((p) => p.shopSlug == slug)
            .map(
              (p) => {
                ...p.toJson(),
                'variants': p.variants.map((v) => v.toJson()).toList(),
              },
            )
            .toList();
        return {'items': list, 'total': list.length, 'pages': 1};
      }
      if (uri.path.endsWith('/reviews')) {
        return {
          'items': [],
          'total': 0,
          'pages': 1,
          'summary': {'total': 0, 'average': 0, 'breakdown': []},
        };
      }
      return shop;
    }
    if (uri.path.contains('customer-reviews')) {
      return {
        'items': [],
        'pages': 1,
        'summary': {'total': 0, 'average': 0, 'breakdown': []},
      };
    }
    if (uri.path == '/discovery/suggestions') {
      return {
        'products': productRows
            .where(
              (p) => p.title.toLowerCase().contains(
                (uri.queryParameters['q'] ?? '').toLowerCase(),
              ),
            )
            .map(
              (p) => {
                ...p.toJson(),
                'variants': p.variants.map((v) => v.toJson()).toList(),
              },
            )
            .toList(),
        'categories': [],
      };
    }
    if (uri.path.contains('recommendations')) {
      return {
        'items': productRows
            .map(
              (p) => {
                ...p.toJson(),
                'variants': p.variants.map((v) => v.toJson()).toList(),
              },
            )
            .toList(),
        'basis': 'RECENT_DELIVERED_POPULARITY',
      };
    }
    throw const AppFailure('This destination needs a configured live API.');
  }

  @override
  Future<Object?> write(String path, String method, [Object? data]) async =>
      throw const AppFailure('Design preview is read-only.');
  @override
  Future<CartData> cart([String? addressId]) async =>
      throw const AppFailure('Sign in to view your live cart.');
  @override
  Future<List<BuyerAddress>> addresses() async =>
      throw const AppFailure('Sign in to view addresses.');
}
