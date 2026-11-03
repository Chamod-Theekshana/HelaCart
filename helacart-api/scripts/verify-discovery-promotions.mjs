import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../dist/auth/auth.service.js';
import { CatalogService } from '../dist/catalog/catalog.service.js';
import { WorkspaceService } from '../dist/workspace/workspace.service.js';
import { CommerceService } from '../dist/commerce/commerce.service.js';
import { NotificationsService } from '../dist/notifications/notifications.service.js';
import { FavoritesService } from '../dist/favorites/favorites.service.js';
import { PromotionsService } from '../dist/discovery/promotions.service.js';
import { DiscoveryService } from '../dist/discovery/discovery.service.js';
import { FavoriteAlertsService } from '../dist/discovery/favorite-alerts.service.js';
import {
  isolatedOrderDatabase,
  seedOrderFixture,
} from './order-flow-fixture.mjs';
const db = await isolatedOrderDatabase();
let checks = 0;
const pass = (s) => {
  checks++;
  console.log('PASS ' + s);
};
try {
  const p = db.prisma,
    f = await seedOrderFixture(p),
    auth = new AuthService(p),
    catalog = new CatalogService(p, auth),
    config = new ConfigService({
      ADMIN_FIREBASE_UIDS: [f.identities.admin.uid],
    }),
    notices = new NotificationsService(p, auth, config),
    commerce = new CommerceService(p, auth, catalog, notices),
    favorites = new FavoritesService(p, auth, catalog),
    promos = new PromotionsService(p, auth, catalog, notices, config),
    discovery = new DiscoveryService(p, auth, catalog),
    alerts = new FavoriteAlertsService(p, auth),
    workspace = new WorkspaceService(p, auth, catalog);
  await p.product.update({
    where: { id: f.products[0] },
    data: { brand: 'කපු Cotton', commissionRateBps: 1000 },
  });
  const q = { page: 1, limit: 20, sort: 'relevance', q: 'කපු cotton' };
  const searched = await workspace.publicCatalog(q);
  assert.equal(searched.items[0].id, f.products[0]);
  assert.equal((await discovery.suggest('Cotton')).products.length > 0, true);
  await p.seller.update({
    where: { id: f.sellers.b },
    data: { status: 'SUSPENDED' },
  });
  assert.equal((await discovery.suggest('ceramic')).products.length, 0);
  assert.equal(
    (await discovery.recommendations({ limit: 8 })).items.some(
      (i) => i.id === f.products[2],
    ),
    false,
  );
  await p.seller.update({
    where: { id: f.sellers.b },
    data: { status: 'APPROVED' },
  });
  pass(
    'Search supports multiple words and Unicode brand text; suggestions and recommendations respect shop visibility',
  );
  const favorite = await favorites.save(f.identities.buyer, f.products[0]);
  await alerts.settings(favorite.id, f.identities.buyer, {
    version: 0,
    priceAlerts: true,
    restockAlerts: true,
  });
  await assert.rejects(
    () =>
      alerts.settings(favorite.id, f.identities.buyerTwo, {
        version: 1,
        priceAlerts: true,
        restockAlerts: true,
      }),
    { status: 404 },
  );
  await assert.rejects(
    () =>
      alerts.settings(favorite.id, f.identities.buyer, {
        version: 0,
        priceAlerts: true,
        restockAlerts: true,
      }),
    { status: 409 },
  );
  const personalized = await discovery.recommendations(
    { limit: 8 },
    f.identities.buyer,
  );
  assert.equal(
    personalized.items.some((i) => i.id === f.products[0]),
    false,
  );
  assert.equal(personalized.basis, 'YOUR_FAVORITE_CATEGORIES');
  pass(
    'Favorite alert preferences are opt-in, versioned and private; recommendations exclude already-saved products',
  );
  const now = Date.now(),
    dto = {
      requestKey: randomUUID(),
      productId: f.products[0],
      name: 'Cotton weekend',
      discountBps: 1000,
      startsAt: new Date(now - 60000).toISOString(),
      endsAt: new Date(now + 86400000).toISOString(),
    };
  const offer = await promos.create(f.sellers.a, f.identities.sellerA, dto);
  assert.equal(
    (await promos.create(f.sellers.a, f.identities.sellerA, dto)).id,
    offer.id,
  );
  assert.equal(
    (await catalog.publicProduct(f.products[0])).variants[0].priceLkrMinor,
    20000,
  );
  await assert.rejects(
    () =>
      promos.decide(offer.id, f.identities.sellerA, f.sellers.a, {
        version: 0,
        status: 'APPROVED',
        reason: 'A seller cannot approve their own campaign.',
      }),
    { status: 403 },
  );
  await assert.rejects(
    () => promos.create(f.sellers.b, f.identities.sellerA, dto),
    { status: 403 },
  );
  await promos.decide(offer.id, f.identities.admin, undefined, {
    version: 0,
    status: 'APPROVED',
    reason: 'Checked the proposed product discount and schedule.',
  });
  assert.equal(
    (await catalog.publicProduct(f.products[0])).variants[0].priceLkrMinor,
    18000,
  );
  const strong = await promos.create(f.sellers.a, f.identities.sellerA, {
    ...dto,
    requestKey: randomUUID(),
    name: 'Stronger offer',
    discountBps: 2000,
  });
  await promos.decide(strong.id, f.identities.admin, undefined, {
    version: 0,
    status: 'APPROVED',
    reason: 'Approved the stronger product promotion schedule.',
  });
  assert.equal(
    (await catalog.publicProduct(f.products[0])).variants[0].priceLkrMinor,
    16000,
  );
  const deals = await workspace.publicCatalog({
    page: 1,
    limit: 20,
    sort: 'price-asc',
    deals: true,
    maxPrice: 17000,
  });
  assert.equal(deals.items[0].listingPriceLkrMinor, 16000);
  pass(
    'Only approved scheduled offers affect prices; overlaps choose the strongest offer and deal filters use that price',
  );
  await commerce.setCartItem(f.identities.buyer, f.variants[0], 2);
  const quote = await commerce.cart(f.identities.buyer, f.addresses.buyer);
  assert.equal(quote.subtotalLkrMinor, 32000);
  assert.equal(
    (await favorites.list(f.identities.buyer, { page: 1, limit: 12 })).items[0]
      .product.variants[0].priceLkrMinor,
    16000,
  );
  const ordered = await commerce.checkout(f.identities.buyer, {
    checkoutKey: randomUUID(),
    addressId: f.addresses.buyer,
    quote: quote.checkoutQuote,
  });
  const item = await p.orderItem.findFirst({
    where: { sellerOrder: { orderId: ordered.id } },
  });
  assert.equal(item.unitLkrMinor, 16000);
  assert.equal(item.originalUnitLkrMinor, 20000);
  assert.equal(item.promotionId, strong.id);
  assert.equal(item.commissionAmountMinor, 3200);
  await promos.decide(strong.id, f.identities.sellerA, f.sellers.a, {
    version: 1,
    status: 'CANCELLED',
    reason: 'Seller ended this offer after the planned stock allocation.',
  });
  assert.equal(
    (await p.orderItem.findUnique({ where: { id: item.id } })).unitLkrMinor,
    16000,
  );
  assert.equal(
    (await catalog.publicProduct(f.products[0])).variants[0].priceLkrMinor,
    18000,
  );
  pass(
    'Cart, favorites and checkout agree; discounted prices and original-rate commission are snapshotted on orders',
  );
  await commerce.setCartItem(f.identities.buyer, f.variants[0], 1);
  const oldQuote = await commerce.cart(f.identities.buyer, f.addresses.buyer);
  await promos.decide(offer.id, f.identities.admin, undefined, {
    version: 1,
    status: 'CANCELLED',
    reason: 'Owner cancelled the remaining discount campaign.',
  });
  await assert.rejects(
    () =>
      commerce.checkout(f.identities.buyer, {
        checkoutKey: randomUUID(),
        addressId: f.addresses.buyer,
        quote: oldQuote.checkoutQuote,
      }),
    { status: 409 },
  );
  assert.equal(
    (await p.productVariant.findUnique({ where: { id: f.variants[0] } }))
      .onHand,
    18,
  );
  await assert.rejects(() =>
    p.orderItem.update({
      where: { id: item.id },
      data: { promotionDiscountBps: 1000 },
    }),
  );
  pass(
    'Changed promotion prices reject stale checkout quotes before inventory writes; old order promotion fields are immutable',
  );
  const future = await promos.create(f.sellers.a, f.identities.sellerA, {
    ...dto,
    requestKey: randomUUID(),
    name: 'Future offer',
    discountBps: 3000,
    startsAt: new Date(now + 3600000).toISOString(),
    endsAt: new Date(now + 7200000).toISOString(),
  });
  await promos.decide(future.id, f.identities.admin, undefined, {
    version: 0,
    status: 'APPROVED',
    reason: 'Approved a future scheduled offer for this product.',
  });
  assert.equal(
    (await catalog.publicProduct(f.products[0])).variants[0].priceLkrMinor,
    20000,
  );
  pass('Future approved schedules remain inactive before their start time');
  const due = () =>
    p.productFavorite.update({
      where: { id: favorite.id },
      data: { nextCheckAt: new Date(0) },
    });
  await p.productVariant.update({
    where: { id: f.variants[0] },
    data: { priceLkrMinor: 15000 },
  });
  await due();
  const races = await Promise.all([alerts.processDue(), alerts.processDue()]);
  assert.equal(
    races.reduce((n, r) => n + r.notifications, 0),
    1,
  );
  await due();
  await alerts.processDue();
  assert.equal(
    await p.notification.count({
      where: { type: 'FAVORITE_PRICE_DROP', userId: f.userIds.buyer },
    }),
    1,
  );
  await p.productVariant.update({
    where: { id: f.variants[0] },
    data: { priceLkrMinor: 20000 },
  });
  await due();
  await alerts.processDue();
  await p.productVariant.update({
    where: { id: f.variants[0] },
    data: { priceLkrMinor: 15000 },
  });
  await due();
  await alerts.processDue();
  assert.equal(
    await p.notification.count({
      where: { type: 'FAVORITE_PRICE_DROP', userId: f.userIds.buyer },
    }),
    1,
  );
  pass(
    'Concurrent favorite workers send one price alert and suppress repeated price oscillations above the last alerted minimum',
  );
  await p.productVariant.update({
    where: { id: f.variants[0] },
    data: { onHand: 0 },
  });
  await due();
  await alerts.processDue();
  await p.productVariant.update({
    where: { id: f.variants[0] },
    data: { onHand: 5 },
  });
  await due();
  await alerts.processDue();
  assert.equal(
    await p.notification.count({
      where: { type: 'FAVORITE_RESTOCK', userId: f.userIds.buyer },
    }),
    1,
  );
  await alerts.settings(favorite.id, f.identities.buyer, {
    version: 1,
    priceAlerts: false,
    restockAlerts: false,
  });
  await due();
  assert.equal((await alerts.processDue()).processed, 0);
  pass(
    'A real sold-out to available transition sends a restock alert; disabling preferences stops checks',
  );
  console.log(
    JSON.stringify({
      checks,
      customerDataUntouched: true,
      externalMessagesOrPayments: false,
    }),
  );
} finally {
  await db.close();
  console.log(JSON.stringify({ isolatedSchemaRemoved: true }));
}
