import 'dart:convert';

import 'package:helacart_buyer_mobile_app/core/data/json.dart';
import 'package:helacart_buyer_mobile_app/core/data/models.dart';
import 'package:helacart_buyer_mobile_app/core/data/preview_repository.dart';

import 'fakes.dart';

const fixtureAddress = '8b0c8b96-8531-4a62-9f96-2ce6fd046a50';
const fixtureOrder = '9e6e62da-9dfa-452a-a09b-9ae20b2c74da';
const fixturePackage = 'd29678fc-f38e-48f4-a1ef-8030f47db52d';
const fixtureCase = 'b8524d17-9097-4668-b4e0-8bd3f5a1243a';
const fixtureItem = 'aaf2ea65-e8a8-42a1-97dd-f00a3eff6d28';

class BuyerFixture extends FakeRepository {
  BuyerFixture() {
    onRead = respond;
    onWrite = (path, method, data) async => {
      'id': path.endsWith('checkout') ? fixtureOrder : fixtureCase,
    };
  }
  final preview = PreviewRepository();
  final quoteValue = CartData(
    items: const [
      {
        'variantId': 'preview-m',
        'productId': 'preview-shirt',
        'sellerId': 'shop-a',
        'sellerName': 'Ceylon Threads',
        'sellerSlug': 'ceylon-threads',
        'title': 'Handwoven Premium Cotton Linen Shirt',
        'priceLkrMinor': 436500,
        'quantity': 2,
        'availableQuantity': 6,
        'available': true,
        'shippingConfigured': true,
        'optionValues': {'Size': 'M'},
      },
      {
        'variantId': 'preview-600',
        'productId': 'preview-coffee',
        'sellerId': 'shop-b',
        'sellerName': 'Urban Living Store',
        'title': 'French Press Coffee Maker',
        'priceLkrMinor': 365000,
        'quantity': 1,
        'availableQuantity': 12,
        'available': true,
        'shippingConfigured': true,
        'optionValues': {'Capacity': '600 ml'},
      },
    ],
    subtotalLkrMinor: 1238000,
    shippingLkrMinor: 80000,
    totalLkrMinor: 1318000,
    canCheckout: true,
    deliveryQuoted: true,
    addressId: fixtureAddress,
    checkoutQuote: List.filled(64, 'a').join(),
    deliveryBySeller: const [
      {
        'sellerId': 'shop-a',
        'available': true,
        'feeMinor': 35000,
        'freeDelivery': false,
        'minDays': 2,
        'maxDays': 5,
      },
      {
        'sellerId': 'shop-b',
        'available': true,
        'feeMinor': 45000,
        'freeDelivery': false,
      },
    ],
  );
  static final order = <String, dynamic>{
    'id': fixtureOrder,
    'createdAt': '2026-10-27T10:00:00Z',
    'recipient': 'Kasun Perera',
    'phone': '+94 77 123 4567',
    'line1': '42 Galle Road',
    'city': 'Colombo 04',
    'district': 'Colombo',
    'postalCode': '00400',
    'paymentMethod': 'COD',
    'subtotalLkrMinor': 1238000,
    'shippingLkrMinor': 80000,
    'totalLkrMinor': 1318000,
    'sellerOrders': [
      {
        'id': fixturePackage,
        'status': 'PLACED',
        'seller': {'name': 'Ceylon Threads', 'slug': 'ceylon-threads'},
        'shippingLkrMinor': 35000,
        'subtotalLkrMinor': 873000,
        'totalLkrMinor': 908000,
        'items': [
          {
            'id': fixtureItem,
            'productTitle': 'Handwoven Premium Cotton Linen Shirt',
            'sku': 'CT-M',
            'quantity': 2,
            'unitLkrMinor': 436500,
            'lineLkrMinor': 873000,
            'optionValues': {'Size': 'M'},
            'variant': {'productId': 'preview-shirt'},
          },
        ],
        'events': [
          {'toStatus': 'PLACED', 'createdAt': '2026-10-27T10:00:00Z'},
        ],
      },
      {
        'id': 'package-b',
        'status': 'SHIPPED',
        'seller': {'name': 'Urban Living Store', 'slug': 'urban-living-store'},
        'shippingLkrMinor': 45000,
        'subtotalLkrMinor': 365000,
        'totalLkrMinor': 410000,
        'items': [
          {
            'id': 'item-b',
            'productTitle': 'French Press Coffee Maker',
            'quantity': 1,
            'lineLkrMinor': 365000,
            'optionValues': {},
          },
        ],
        'shipment': {
          'courierName': 'Shop delivery',
          'trackingNumber': 'TRACK-123',
          'shippedAt': '2026-10-28T09:00:00Z',
        },
        'events': [],
      },
    ],
  };
  static Json page(List<Json> items) => {
    'items': items,
    'total': items.length,
    'page': 1,
    'pages': 1,
  };
  @override
  Future<CartData> cart([String? addressId]) async => quoteValue;
  @override
  Future<List<BuyerAddress>> addresses() async => const [
    BuyerAddress(
      id: fixtureAddress,
      recipient: 'Kasun Perera',
      phone: '+94 77 123 4567',
      line1: '42 Galle Road',
      city: 'Colombo 04',
      district: 'Colombo',
      postalCode: '00400',
    ),
  ];
  @override
  Future<List<Json>> categories() => preview.categories();
  @override
  Future<Product> product(String id) => preview.product(id);
  @override
  Future<PageData<Product>> products(String query) => preview.products(query);
  Future<Object?> respond(String path) async {
    final uri = Uri.parse(path);
    final p = uri.path;
    if (p == '/auth/me') {
      return {
        'id': 'buyer-a',
        'firebaseUid': 'buyer-a',
        'name': 'Kasun Perera',
        'email': 'kasun@example.test',
        'phone': '+94 77 123 4567',
        'emailVerified': true,
        'hasPhoto': false,
        'updatedAt': '2026-10-29T00:00:00Z',
      };
    }
    if (p == '/workspace/me/summary') {
      return {
        'orders': 1,
        'activeSellerOrders': 2,
        'addresses': 1,
        'unreadNotifications': 1,
      };
    }
    if (p == '/me/favorites/summary') {
      return {
        'items': [
          {'id': 'favorite-a', 'productId': 'preview-shirt'},
        ],
        'total': 1,
      };
    }
    if (p == '/me/favorites') {
      return page([
        {
          'id': 'favorite-a',
          'title': 'Handwoven Premium Cotton Linen Shirt',
          'product': jsonDecode(
            jsonEncode(PreviewRepository.productRows.first.toJson()),
          ),
          'priceAlerts': false,
          'restockAlerts': false,
          'alertVersion': 3,
        },
      ]);
    }
    if (p == '/workspace/me/orders') return page([order]);
    if (p == '/me/orders/$fixtureOrder') return order;
    if (p.endsWith('/customer-reviews/access')) {
      return {'eligible': true, 'review': null};
    }
    if (p == '/me/product-reviews') return page([]);
    if (p == '/me/after-sales/return-options/$fixturePackage') {
      return {
        'eligible': true,
        'sellerOrderId': fixturePackage,
        'closesAt': '2026-11-10T00:00:00Z',
        'items': [
          {
            'orderItemId': fixtureItem,
            'productTitle': 'Handwoven Premium Cotton Linen Shirt',
            'sku': 'CT-M',
            'quantity': 2,
            'remainingQuantity': 2,
            'unitMinor': 436500,
          },
        ],
      };
    }
    if (p == '/me/after-sales/returns') {
      return page([
        {
          'id': 'return-a',
          'status': 'PENDING',
          'reason': 'Wrong size delivered',
          'createdAt': '2026-10-29T00:00:00Z',
          'sellerOrder': {
            'id': fixturePackage,
            'orderId': fixtureOrder,
            'seller': {'name': 'Ceylon Threads'},
          },
          'items': [
            {
              'id': 'return-item-a',
              'quantity': 1,
              'baseMinor': 436500,
              'orderItem': {
                'productTitle': 'Handwoven Premium Cotton Linen Shirt',
              },
              'refunds': [],
            },
          ],
        },
      ]);
    }
    if (p == '/me/after-sales/refunds') {
      return page([
        {
          'id': 'refund-a',
          'status': 'APPROVED',
          'method': 'CASH',
          'reference': 'REF-123',
          'paidOn': '2026-10-29',
          'merchandiseMinor': 436500,
          'shippingMinor': 0,
          'amountMinor': 436500,
          'createdAt': '2026-10-29T00:00:00Z',
        },
      ]);
    }
    if (p == '/me/after-sales/support') {
      return page([
        {
          'id': fixtureCase,
          'title': 'Question about my delivery',
          'category': 'DELIVERY',
          'status': 'OPEN',
          'updatedAt': '2026-10-29T00:00:00Z',
        },
      ]);
    }
    if (p == '/me/after-sales/support/$fixtureCase') {
      return {
        'id': fixtureCase,
        'title': 'Question about my delivery',
        'status': 'OPEN',
        'events': [],
      };
    }
    if (p == '/me/after-sales/support/$fixtureCase/messages') {
      return page([
        {
          'id': 'message-a',
          'body': 'Please help me confirm the delivery details.',
          'authorRole': 'BUYER',
          'author': {'name': 'Kasun Perera'},
          'createdAt': '2026-10-29T00:00:00Z',
        },
      ]);
    }
    if (p == '/me/notifications/inbox') return {'items': [], 'unreadCount': 1};
    if (p == '/workspace/me/notifications') {
      return page([
        {
          'id': 'notice-a',
          'message': 'Your shop package has shipped',
          'href': '/orders?order=$fixtureOrder',
          'createdAt': '2026-10-29T00:00:00Z',
        },
      ]);
    }
    return preview.read(path);
  }
}
