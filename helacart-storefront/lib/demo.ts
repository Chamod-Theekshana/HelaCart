import images from "./stitch-images.json";
import type { Cart, Category, Order, Product } from "./types";

export const demoCategories: Category[] = [
  { id: "fashion", name: "Fashion & Apparel", slug: "fashion" },
  { id: "electronics", name: "Electronics & Tech", slug: "electronics" },
  { id: "home", name: "Home & Kitchen", slug: "home" },
  { id: "beauty", name: "Health & Beauty", slug: "beauty" },
  { id: "pantry", name: "Ceylon Pantry", slug: "pantry" },
  { id: "outdoor", name: "Sports & Outdoor", slug: "outdoor" },
];
function product(
  id: number,
  title: string,
  price: number,
  image: number,
  category: number,
  seller: string,
  description: string,
): Product {
  return {
    id: `preview-${id}`,
    title,
    slug: `preview-${id}`,
    description,
    imageUrls: [images[image]],
    priceLkrMinor: price * 100,
    category: demoCategories[category],
    seller: { name: seller, slug: seller.toLowerCase().replace(/\s+/g, "-") },
    variants: [
      {
        id: `preview-variant-${id}`,
        sku: `PREVIEW-${id}`,
        optionValues: {},
        priceLkrMinor: price * 100,
        availableQuantity: 9,
      },
    ],
  };
}
export const demoProducts: Product[] = [
  product(
    1,
    "Soundcore Life Q30 Wireless Headphones",
    24500,
    3,
    1,
    "Colombo Tech Hub",
    "Wireless over-ear headphones for everyday listening.",
  ),
  product(
    2,
    "Handwoven Premium Cotton Linen Shirt",
    4850,
    4,
    0,
    "Ceylon Threads",
    "A light, comfortable cotton linen shirt.",
  ),
  product(
    3,
    "Stainless Steel French Press Coffee Maker",
    3650,
    5,
    2,
    "Urban Living Store",
    "A glass and stainless-steel French press for your daily coffee.",
  ),
  product(
    4,
    "Organic Ceylon Cinnamon & Cardamom Set",
    2950,
    2,
    4,
    "Kandy Harvest Co.",
    "A pantry bundle inspired by Sri Lankan ingredients.",
  ),
  product(
    5,
    "Portable Bluetooth Speaker",
    8900,
    7,
    1,
    "Island Audio",
    "A compact wireless speaker for your next adventure.",
  ),
  product(
    6,
    "Fitness Smartwatch",
    12900,
    8,
    1,
    "ElectroLK Store",
    "Keep your essentials close throughout the day.",
  ),
  product(
    7,
    "Handmade Ceramic Dinner Set",
    6200,
    10,
    2,
    "Urban Living Store",
    "A versatile collection of ceramic plates and bowls.",
  ),
  product(
    8,
    "Virgin Coconut Oil",
    2150,
    13,
    3,
    "Island Organics",
    "A versatile coconut oil for everyday routines.",
  ),
  product(
    9,
    "Compact Power Bank",
    9450,
    16,
    1,
    "Colombo Tech Hub",
    "Portable charging when you need it.",
  ),
  product(
    10,
    "Artisan Batik Sarong",
    3850,
    17,
    0,
    "Lanka Heritage",
    "A richly patterned textile made in Sri Lanka.",
  ),
  product(
    11,
    "Cast Iron Skillet",
    6200,
    18,
    2,
    "Urban Living Store",
    "A sturdy pan ready for your kitchen.",
  ),
  product(
    12,
    "Botanical Face Wash & Gel Set",
    2450,
    19,
    3,
    "Island Organics",
    "A simple botanical daily-care set.",
  ),
];

export function demoCart(
  items: { productId: string; quantity: number }[],
): Cart {
  const rows = items.flatMap(({ productId, quantity }) => {
    const found = demoProducts.find((entry) => entry.id === productId);
    if (!found) return [];
    return [
      {
        variantId: found.variants[0].id,
        productId,
        sellerId: found.seller.slug ?? "",
        title: found.title,
        sku: found.variants[0].sku,
        optionValues: {},
        priceLkrMinor: found.priceLkrMinor,
        quantity,
        availableQuantity: 9,
        available: true,
        shippingConfigured: false,
      },
    ];
  });
  const subtotal = rows.reduce(
    (sum, row) => sum + row.priceLkrMinor * row.quantity,
    0,
  );
  return {
    items: rows,
    subtotalLkrMinor: subtotal,
    shippingLkrMinor: 0,
    totalLkrMinor: subtotal,
    canCheckout: false,
  };
}

export const demoOrders: Order[] = [
  {
    id: "PREVIEW-98241",
    createdAt: "2026-10-16T09:22:00.000Z",
    recipient: "Sample customer",
    line1: "Sample address",
    city: "Colombo",
    district: "Colombo",
    paymentMethod: "COD",
    subtotalLkrMinor: 2690000,
    shippingLkrMinor: 0,
    totalLkrMinor: 2690000,
    sellerOrders: [
      {
        id: "PREVIEW-S1",
        status: "SHIPPED",
        seller: { name: "Colombo Tech Hub", slug: "colombo-tech-hub" },
        statusReason: null,
        statusChangedAt: "2026-10-17T05:00:00.000Z",
        totalLkrMinor: 2690000,
        items: [
          {
            id: "item1",
            productTitle: demoProducts[0].title,
            sku: "PREVIEW-1",
            optionValues: {},
            unitLkrMinor: 2450000,
            quantity: 1,
            lineLkrMinor: 2450000,
          },
          {
            id: "item2",
            productTitle: "Headphone Stand",
            sku: "PREVIEW-2",
            optionValues: {},
            unitLkrMinor: 240000,
            quantity: 1,
            lineLkrMinor: 240000,
          },
        ],
      },
    ],
  },
  {
    id: "PREVIEW-98117",
    createdAt: "2026-10-12T07:10:00.000Z",
    recipient: "Sample customer",
    line1: "Sample address",
    city: "Kandy",
    district: "Kandy",
    paymentMethod: "COD",
    subtotalLkrMinor: 485000,
    shippingLkrMinor: 35000,
    totalLkrMinor: 520000,
    sellerOrders: [
      {
        id: "PREVIEW-S2",
        status: "DELIVERY_FAILED",
        seller: { name: "Ceylon Threads", slug: "ceylon-threads" },
        statusReason: "Courier could not reach the delivery phone number",
        statusChangedAt: "2026-10-15T10:30:00.000Z",
        totalLkrMinor: 520000,
        items: [
          {
            id: "item3",
            productTitle: demoProducts[1].title,
            sku: "PREVIEW-2",
            optionValues: {},
            unitLkrMinor: 485000,
            quantity: 1,
            lineLkrMinor: 485000,
          },
        ],
        events: [
          {
            id: "event1",
            fromStatus: "PACKED",
            toStatus: "SHIPPED",
            createdAt: "2026-10-13T08:00:00.000Z",
            reason: null,
          },
          {
            id: "event2",
            fromStatus: "SHIPPED",
            toStatus: "DELIVERY_FAILED",
            createdAt: "2026-10-15T10:30:00.000Z",
            reason: "Courier could not reach the delivery phone number",
          },
        ],
      },
    ],
  },
];
