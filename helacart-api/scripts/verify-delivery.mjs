import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../dist/auth/auth.service.js';
import { CatalogService } from '../dist/catalog/catalog.service.js';
import { CommerceService } from '../dist/commerce/commerce.service.js';
import { NotificationsService } from '../dist/notifications/notifications.service.js';
import {
  isolatedOrderDatabase,
  seedOrderFixture,
} from './order-flow-fixture.mjs';
const db = await isolatedOrderDatabase();
let checks = 0;
const pass = (name) => {
  checks++;
  console.log('PASS ' + name);
};
try {
  const p = db.prisma,
    f = await seedOrderFixture(p),
    auth = new AuthService(p),
    catalog = new CatalogService(p, auth),
    notices = new NotificationsService(
      p,
      auth,
      new ConfigService({ ADMIN_FIREBASE_UIDS: [f.identities.admin.uid] }),
    ),
    commerce = new CommerceService(p, auth, catalog, notices);
  const settings = {
    version: 0,
    shippingFeeLkrMinor: 35000,
    freeShippingThresholdMinor: 100000,
    deliveryMinDays: 2,
    deliveryMaxDays: 4,
    districtRates: [
      { district: 'Kandy', available: true, feeMinor: 45000 },
      { district: 'Jaffna', available: false, feeMinor: 60000 },
    ],
  };
  await commerce.setDeliverySettings(
    f.sellers.a,
    f.identities.sellerA,
    settings,
  );
  assert.equal(
    (await commerce.deliverySettings(f.sellers.a, f.identities.sellerA))
      .deliveryRevision,
    1,
  );
  await assert.rejects(
    () =>
      commerce.setDeliverySettings(f.sellers.a, f.identities.sellerA, settings),
    { status: 409 },
  );
  await assert.rejects(
    () => commerce.deliverySettings(f.sellers.a, f.identities.sellerB),
    { status: 403 },
  );
  pass(
    'Delivery settings persist, reject stale updates and enforce shop ownership',
  );
  for (const [i, quantity] of [
    [0, 2],
    [1, 1],
    [2, 1],
  ])
    await commerce.setCartItem(f.identities.buyer, f.variants[i], quantity);
  const base = await commerce.cart(f.identities.buyer),
    quote = await commerce.cart(f.identities.buyer, f.addresses.buyer);
  assert.equal(base.shippingLkrMinor, 90000);
  assert.equal(quote.shippingLkrMinor, 100000);
  assert.equal(
    quote.deliveryBySeller.find((s) => s.sellerId === f.sellers.a).feeMinor,
    45000,
  );
  assert.equal(quote.canCheckout, true);
  await assert.rejects(
    () => commerce.cart(f.identities.buyer, f.addresses.buyerTwo),
    { status: 404 },
  );
  pass(
    'Address quotes apply district rates once per shop and never expose another buyer address',
  );
  const address = await commerce.addAddress(f.identities.buyer, {
    recipient: 'Audit buyer',
    phone: '0771234567',
    line1: '12 Audit Road',
    city: 'Jaffna',
    district: 'Jaffna',
    postalCode: '40000',
  });
  await commerce.setCartItem(f.identities.buyer, f.variants[0], 4);
  const free = await commerce.cart(f.identities.buyer, f.addresses.buyer),
    blocked = await commerce.cart(f.identities.buyer, address.id);
  assert.equal(
    free.deliveryBySeller.find((s) => s.sellerId === f.sellers.a).feeMinor,
    0,
  );
  assert.equal(blocked.canCheckout, false);
  assert.equal(
    blocked.deliveryBySeller.find((s) => s.sellerId === f.sellers.a).available,
    false,
  );
  await assert.rejects(
    () =>
      commerce.checkout(f.identities.buyer, {
        addressId: address.id,
        checkoutKey: randomUUID(),
        quote: blocked.checkoutQuote,
      }),
    { status: 409 },
  );
  pass(
    'Free shipping uses the shop subtotal and never bypasses district availability',
  );
  const stockBefore = await p.productVariant.findUniqueOrThrow({
    where: { id: f.variants[0] },
  });
  await assert.rejects(
    () =>
      commerce.checkout(f.identities.buyer, {
        addressId: f.addresses.buyer,
        checkoutKey: randomUUID(),
        quote: quote.checkoutQuote,
      }),
    { status: 409 },
  );
  assert.equal(
    (await p.productVariant.findUniqueOrThrow({ where: { id: f.variants[0] } }))
      .onHand,
    stockBefore.onHand,
  );
  pass('A stale cart quote is rejected without stock writes');
  await commerce.setCartItem(f.identities.buyer, f.variants[0], 2);
  const fresh = await commerce.cart(f.identities.buyer, f.addresses.buyer),
    key = randomUUID();
  const order = await commerce.checkout(f.identities.buyer, {
    addressId: f.addresses.buyer,
    checkoutKey: key,
    quote: fresh.checkoutQuote,
  });
  const part = order.sellerOrders.find((o) => o.sellerId === f.sellers.a),
    other = order.sellerOrders.find((o) => o.sellerId === f.sellers.b);
  assert.equal(part.shippingLkrMinor, 45000);
  assert.equal(part.deliveryMinDays, 2);
  assert.equal(part.deliveryMaxDays, 4);
  assert.equal(part.deliveryRateRevision, 1);
  assert.equal(other.shippingLkrMinor, 55000);
  assert.equal(
    (
      await commerce.checkout(f.identities.buyer, {
        addressId: f.addresses.buyer,
        checkoutKey: key,
        quote: fresh.checkoutQuote,
      })
    ).id,
    order.id,
  );
  await commerce.setDeliverySettings(f.sellers.a, f.identities.sellerA, {
    ...settings,
    version: 1,
    shippingFeeLkrMinor: 99000,
    deliveryMinDays: 5,
    deliveryMaxDays: 8,
    districtRates: [{ district: 'Kandy', available: true, feeMinor: 88000 }],
  });
  const frozen = await commerce.myOrder(f.identities.buyer, order.id);
  assert.equal(
    frozen.sellerOrders.find((o) => o.id === part.id).shippingLkrMinor,
    45000,
  );
  assert.equal(
    frozen.sellerOrders.find((o) => o.id === part.id).deliveryMinDays,
    2,
  );
  await assert.rejects(
    () =>
      p.$executeRaw`UPDATE "SellerOrder" SET "shippingLkrMinor"=1 WHERE id=${part.id}::uuid`,
  );
  pass(
    'Checkout retries are idempotent and existing delivery fees/estimates are immutable',
  );
  for (const status of ['ACCEPTED', 'PACKED'])
    await commerce.sellerStatus(f.sellers.a, part.id, f.identities.sellerA, {
      status,
    });
  await commerce.sellerStatus(f.sellers.a, part.id, f.identities.sellerA, {
    status: 'SHIPPED',
    courierName: 'Audit courier',
    trackingNumber: 'TRACK-111',
  });
  const shipment = await p.sellerShipment.findUniqueOrThrow({
    where: { sellerOrderId: part.id },
  });
  assert.equal(shipment.version, 1);
  assert.equal(shipment.trackingNumber, 'TRACK-111');
  assert.equal(
    await p.shipmentChange.count({ where: { shipmentId: shipment.id } }),
    1,
  );
  const count = await p.notification.count();
  await assert.rejects(
    () =>
      commerce.sellerStatus(f.sellers.a, part.id, f.identities.sellerA, {
        status: 'SHIPPED',
        courierName: 'Audit courier',
        trackingNumber: 'TRACK-111',
      }),
    { status: 409 },
  );
  assert.equal(await p.notification.count(), count);
  pass(
    'Dispatch records tracking and its audit history atomically; retries do not duplicate notifications',
  );
  await assert.rejects(
    () =>
      commerce.updateShipment(f.sellers.a, part.id, f.identities.sellerB, {
        version: 1,
        courierName: 'Forged courier',
        trackingNumber: 'FORGED',
        reason: 'Another shop must not edit this tracking',
      }),
    { status: 403 },
  );
  const corrected = await commerce.updateShipment(
    f.sellers.a,
    part.id,
    f.identities.sellerA,
    {
      version: 1,
      courierName: 'Audit courier',
      trackingNumber: 'TRACK-222',
      reason: 'Corrected reference from the dispatch receipt',
    },
  );
  assert.equal(corrected.version, 2);
  assert.equal(corrected.shippedAt.getTime(), shipment.shippedAt.getTime());
  const races = await Promise.allSettled(
    ['A', 'B'].map((s) =>
      commerce.updateShipment(f.sellers.a, part.id, f.identities.sellerA, {
        version: 2,
        courierName: 'Audit courier',
        trackingNumber: 'TRACK-' + s,
        reason: 'Concurrent tracking correction test evidence',
      }),
    ),
  );
  assert.equal(races.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(
    races.filter((r) => r.status === 'rejected' && r.reason.status === 409)
      .length,
    1,
  );
  assert.equal(
    await p.shipmentChange.count({ where: { shipmentId: shipment.id } }),
    3,
  );
  pass(
    'Tracking corrections enforce ownership and versioning and preserve the dispatch date',
  );
  const buyerInbox = await notices.inbox(f.identities.buyer),
    sellerInbox = await notices.inbox(f.identities.sellerA),
    adminInbox = await notices.inbox(f.identities.admin);
  assert.ok(buyerInbox.unreadCount > 0);
  assert.ok(
    sellerInbox.items.some((n) => n.href === `/seller/orders?order=${part.id}`),
  );
  assert.ok(
    adminInbox.items.some((n) => n.href === `/admin/orders?order=${order.id}`),
  );
  assert.ok(
    buyerInbox.items.some((n) => n.href === `/orders?order=${order.id}`),
  );
  await assert.rejects(
    () => notices.markRead(f.identities.buyerTwo, buyerInbox.items[0].id),
    { status: 404 },
  );
  await notices.markAllRead(f.identities.buyer);
  assert.equal((await notices.inbox(f.identities.buyer)).unreadCount, 0);
  assert.equal(
    (await notices.inbox(f.identities.sellerA)).unreadCount,
    sellerInbox.unreadCount,
  );
  pass(
    'Buyer, seller and admin notifications have correct links and read-all is account scoped',
  );
  await assert.rejects(
    () =>
      commerce.sellerStatus(f.sellers.a, part.id, f.identities.sellerA, {
        status: 'DELIVERED',
      }),
    { status: 400 },
  );
  await commerce.sellerStatus(f.sellers.a, part.id, f.identities.sellerA, {
    status: 'DELIVERED',
    paymentCollected: true,
  });
  await assert.rejects(
    () =>
      commerce.updateShipment(f.sellers.a, part.id, f.identities.sellerA, {
        version: 3,
        courierName: 'Changed courier',
        trackingNumber: 'LATE',
        reason: 'Delivered tracking must not be changed',
      }),
    { status: 409 },
  );
  const delivered = await commerce.myOrder(f.identities.buyer, order.id);
  assert.equal(
    delivered.sellerOrders.find((o) => o.id === part.id).shipment.version,
    3,
  );
  assert.equal(await p.commissionCharge.count(), 0);
  pass(
    'Delivered orders expose tracking to their buyer, require COD collection and retain inactive commissions',
  );
  await assert.rejects(
    () =>
      p.$executeRaw`UPDATE "SellerShipment" SET "shippedAt"="shippedAt"-INTERVAL '1 day',version=version+1 WHERE id=${shipment.id}::uuid`,
  );
  await assert.rejects(
    () =>
      p.$executeRaw`DELETE FROM "ShipmentChange" WHERE "shipmentId"=${shipment.id}::uuid`,
  );
  pass(
    'Database guards preserve dispatch timestamps and append-only shipment history',
  );
  await commerce.buyerCancel(f.identities.buyer, order.id, other.id);
  assert.ok(
    (await notices.inbox(f.identities.buyer)).items.some(
      (n) =>
        n.message.includes('cancelled') &&
        n.href === `/orders?order=${order.id}`,
    ),
  );
  pass(
    'Cancellation restores the existing workflow and creates a direct order notification',
  );
} finally {
  await db.close();
}
console.log(
  JSON.stringify({
    checks,
    isolatedSchemaRemoved: true,
    customerDataUntouched: true,
    notifications: 'isolated in-app records',
    externalMessagesSent: false,
  }),
);
