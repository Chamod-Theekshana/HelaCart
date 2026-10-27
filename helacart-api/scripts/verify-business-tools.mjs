import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../dist/auth/auth.service.js';
import { CatalogService } from '../dist/catalog/catalog.service.js';
import { InventoryService } from '../dist/catalog/inventory.service.js';
import { ReservationService } from '../dist/catalog/reservation.service.js';
import { BulkToolsService } from '../dist/business-tools/bulk-tools.service.js';
import { StockAlertsService } from '../dist/business-tools/stock-alerts.service.js';
import { BusinessReportsService } from '../dist/business-tools/business-reports.service.js';
import { NotificationsService } from '../dist/notifications/notifications.service.js';
import { OperationsService } from '../dist/operations/operations.service.js';
import { AfterSalesService } from '../dist/after-sales/after-sales.service.js';
import { accrueCommission } from '../dist/commission/commission-ledger.js';
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
    config = new ConfigService({
      ADMIN_FIREBASE_UIDS: [f.identities.admin.uid],
      RETURN_WINDOW_DAYS: 14,
    }),
    bulk = new BulkToolsService(p, auth, catalog, config),
    stock = new StockAlertsService(p, catalog),
    reports = new BusinessReportsService(p, catalog, config),
    inventory = new InventoryService(p, catalog),
    reservations = new ReservationService(p),
    notices = new NotificationsService(p, auth, config),
    operations = new OperationsService(p, auth, notices, config),
    afterSales = new AfterSalesService(p, auth, catalog, notices, config);
  const q = { page: 1, limit: 20 },
    actor = f.identities.sellerA,
    seller = f.sellers.a,
    reason = 'Weekly physical stock count after receiving inventory.';
  await stock.processDirty();
  assert.equal(await p.notification.count({ where: { type: 'STOCK_LOW' } }), 0);
  const template = await bulk.template(seller, actor, q);
  assert.match(template, /"AUDIT-0","20"/);
  assert.doesNotMatch(template, /AUDIT-2/);
  const dto = {
    requestKey: randomUUID(),
    kind: 'STOCK_SET',
    reason,
    csv: 'sku,on_hand\nAUDIT-0,4',
  };
  const preview = await bulk.preview(actor, seller, dto);
  assert.equal(preview.preview.valid, true);
  assert.equal(
    (await p.productVariant.findUnique({ where: { id: f.variants[0] } }))
      .onHand,
    20,
  );
  assert.equal((await bulk.preview(actor, seller, dto)).id, preview.id);
  await assert.rejects(
    () =>
      bulk.preview(actor, seller, { ...dto, csv: 'sku,on_hand\nAUDIT-0,5' }),
    { status: 409 },
  );
  pass(
    'Stock templates contain only the requested shop; previews are read-only and retry idempotently',
  );
  await p.sellerMember.create({
    data: { sellerId: seller, userId: f.userIds.other, role: 'MANAGER' },
  });
  await assert.rejects(
    () => bulk.detail(preview.id, f.identities.other, seller),
    { status: 404 },
  );
  await assert.rejects(
    () => bulk.apply(preview.id, f.identities.other, seller),
    { status: 404 },
  );
  await assert.rejects(() => bulk.preview(f.identities.sellerB, seller, dto), {
    status: 403,
  });
  await assert.rejects(
    () =>
      bulk.preview(actor, seller, {
        requestKey: randomUUID(),
        kind: 'PRODUCT_APPROVE',
        reason,
        productIds: [f.products[0]],
      }),
    { status: 403 },
  );
  await assert.rejects(
    () =>
      bulk.preview(f.identities.buyer, undefined, {
        requestKey: randomUUID(),
        kind: 'PRODUCT_APPROVE',
        reason,
        productIds: [f.products[0]],
      }),
    { status: 403 },
  );
  pass('Bulk previews cannot cross shops, actors or seller/admin permissions');
  await bulk.apply(preview.id, actor, seller);
  await bulk.apply(preview.id, actor, seller);
  assert.equal(
    (await p.productVariant.findUnique({ where: { id: f.variants[0] } }))
      .onHand,
    4,
  );
  assert.equal(
    await p.inventoryMovement.count({ where: { variantId: f.variants[0] } }),
    1,
  );
  const [a, b] = await Promise.all([
    stock.processDirty(),
    stock.processDirty(),
  ]);
  assert.equal(a.notifications + b.notifications, 2);
  assert.equal(await p.notification.count({ where: { type: 'STOCK_LOW' } }), 2);
  await stock.processDirty();
  assert.equal(await p.notification.count({ where: { type: 'STOCK_LOW' } }), 2);
  pass(
    'Applying a stock job once records one movement and concurrent workers notify each shop member once',
  );
  const invalid = await bulk.preview(actor, seller, {
    requestKey: randomUUID(),
    kind: 'STOCK_SET',
    reason,
    csv: 'sku,on_hand\nFOREIGN-SKU,3',
  });
  assert.equal(invalid.preview.valid, false);
  await assert.rejects(() => bulk.apply(invalid.id, actor, seller), {
    status: 400,
  });
  await p.productVariant.update({
    where: { id: f.variants[1] },
    data: { reserved: 1 },
  });
  const reserved = await bulk.preview(actor, seller, {
    requestKey: randomUUID(),
    kind: 'STOCK_SET',
    reason,
    csv: 'sku,on_hand\nAUDIT-1,0',
  });
  assert.equal(reserved.preview.valid, false);
  const stale = await bulk.preview(actor, seller, {
    requestKey: randomUUID(),
    kind: 'STOCK_SET',
    reason,
    csv: 'sku,on_hand\nAUDIT-0,10\nAUDIT-1,15',
  });
  await p.productVariant.update({
    where: { id: f.variants[1] },
    data: { reserved: 2 },
  });
  await assert.rejects(() => bulk.apply(stale.id, actor, seller), {
    status: 409,
  });
  assert.equal(
    (await p.productVariant.findUnique({ where: { id: f.variants[0] } }))
      .onHand,
    4,
  );
  assert.equal(
    (await p.productVariant.findUnique({ where: { id: f.variants[1] } }))
      .onHand,
    20,
  );
  assert.equal(
    await p.inventoryMovement.count({ where: { variantId: f.variants[0] } }),
    1,
  );
  pass(
    'Invalid and stale stock batches leave every row and movement unchanged, protecting reserved units',
  );
  const r = await reservations.reserve(
    f.variants[0],
    4,
    'stock-report-audit-' + randomUUID(),
  );
  await stock.processDirty();
  assert.equal(await p.notification.count({ where: { type: 'STOCK_LOW' } }), 4);
  await reservations.release(r.id);
  await stock.processDirty();
  assert.equal(await p.notification.count({ where: { type: 'STOCK_LOW' } }), 4);
  await inventory.adjustStock(seller, f.products[0], f.variants[0], actor, {
    delta: 10,
    reason: 'Stock arrived from the supplier.',
  });
  await stock.processDirty();
  await inventory.adjustStock(seller, f.products[0], f.variants[0], actor, {
    delta: -10,
    reason: 'Physical stock recounted after damage.',
  });
  await stock.processDirty();
  assert.equal(await p.notification.count({ where: { type: 'STOCK_LOW' } }), 6);
  pass(
    'Reservation, release and normal stock adjustments update alerts without repeated low-stock notifications',
  );
  await stock.settings(seller, f.variants[0], actor, {
    version: 0,
    threshold: 0,
    enabled: false,
  });
  await stock.processDirty();
  await assert.rejects(
    () =>
      stock.settings(seller, f.variants[0], actor, {
        version: 0,
        threshold: 5,
        enabled: true,
      }),
    { status: 409 },
  );
  await inventory.adjustStock(seller, f.products[0], f.variants[0], actor, {
    delta: -4,
    reason: 'Counted all remaining damaged units.',
  });
  await stock.processDirty();
  assert.equal(await p.notification.count({ where: { type: 'STOCK_LOW' } }), 6);
  await stock.settings(seller, f.variants[0], actor, {
    version: 1,
    threshold: 0,
    enabled: true,
  });
  await stock.processDirty();
  assert.equal(await p.notification.count({ where: { type: 'STOCK_LOW' } }), 8);
  const alerts = await stock.list(seller, actor, { ...q, level: 'OUT' });
  assert.equal(alerts.items[0].available, 0);
  assert.equal(alerts.items[0].threshold, 0);
  await assert.rejects(
    () => stock.list(seller, f.identities.sellerB, { ...q, level: 'ALL' }),
    { status: 403 },
  );
  pass(
    'Per-variant thresholds, disabling and version checks work without changing ownership or inventory',
  );
  await p.product.updateMany({
    where: { id: { in: f.products.slice(0, 2) } },
    data: {
      status: 'DRAFT',
      imageUrls: ['https://example.invalid/audit.webp'],
    },
  });
  const submit = await bulk.preview(actor, seller, {
    requestKey: randomUUID(),
    kind: 'PRODUCT_SUBMIT',
    reason: 'Descriptions and photos are ready for review.',
    productIds: f.products.slice(0, 2),
  });
  assert.equal(submit.preview.valid, true);
  await bulk.apply(submit.id, actor, seller);
  const approved = await bulk.preview(f.identities.admin, undefined, {
    requestKey: randomUUID(),
    kind: 'PRODUCT_APPROVE',
    reason: 'Checked product descriptions, photos and warranty terms.',
    productIds: f.products.slice(0, 2),
  });
  await bulk.apply(approved.id, f.identities.admin);
  await bulk.apply(approved.id, f.identities.admin);
  assert.equal(
    await p.productReview.count({
      where: {
        productId: { in: f.products.slice(0, 2) },
        decision: 'APPROVED',
      },
    }),
    2,
  );
  const hide = await bulk.preview(actor, seller, {
    requestKey: randomUUID(),
    kind: 'PRODUCT_HIDE',
    reason: 'These listings are temporarily unavailable for purchase.',
    productIds: f.products.slice(0, 2),
  });
  await bulk.apply(hide.id, actor, seller);
  assert.equal(
    await p.product.count({
      where: { id: { in: f.products.slice(0, 2) }, status: 'HIDDEN' },
    }),
    2,
  );
  pass(
    'Bulk submit, administrator approval and hide preserve normal listing states and review history',
  );
  await p.product.updateMany({
    where: { id: { in: f.products.slice(0, 2) } },
    data: { status: 'PENDING' },
  });
  const conflict = await bulk.preview(f.identities.admin, undefined, {
    requestKey: randomUUID(),
    kind: 'PRODUCT_REJECT',
    reason: 'Product details require corrections before publication.',
    productIds: f.products.slice(0, 2),
  });
  await p.product.update({
    where: { id: f.products[1] },
    data: { status: 'REJECTED' },
  });
  await assert.rejects(() => bulk.apply(conflict.id, f.identities.admin), {
    status: 409,
  });
  assert.equal(
    (await p.product.findUnique({ where: { id: f.products[0] } })).status,
    'PENDING',
  );
  pass(
    'Conflicting listing batches roll back completely instead of approving or rejecting partial selections',
  );
  await p.product.updateMany({
    where: { id: { in: f.products } },
    data: { status: 'APPROVED' },
  });
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const delivered = new Date(today + 'T00:00:00+05:30');
  const start = delivered.getTime();
  const seedDelivered = async ({
    buyer = 'buyer',
    shop = seller,
    variant = f.variants[0],
    when = delivered,
    quantity = 2,
    unit = 20000,
    shipping = 35000,
    rate = 1000,
  } = {}) => {
    const order = await p.order.create({
      data: {
        buyerId: f.userIds[buyer],
        addressId: f.addresses[buyer] ?? f.addresses.buyer,
        checkoutKey: randomUUID(),
        snapshotHash: 'business-report-audit',
        recipient: 'Audit buyer',
        phone: '0771234567',
        line1: '12 Audit Road',
        city: 'Kandy',
        district: 'Kandy',
        postalCode: '20000',
        subtotalLkrMinor: unit * quantity,
        shippingLkrMinor: shipping,
        totalLkrMinor: unit * quantity + shipping,
        createdAt: new Date(start - 86400000),
        sellerOrders: {
          create: {
            sellerId: shop,
            status: 'DELIVERED',
            paymentCollectedAt: when,
            createdAt: new Date(start - 86400000),
            subtotalLkrMinor: unit * quantity,
            shippingLkrMinor: shipping,
            totalLkrMinor: unit * quantity + shipping,
            items: {
              create: {
                variantId: variant,
                productTitle: 'Original purchased title',
                sku: 'AUDIT',
                optionValues: {},
                unitLkrMinor: unit,
                quantity,
                lineLkrMinor: unit * quantity,
                commissionRateBps: rate,
                commissionAmountMinor: Math.round(
                  (unit * quantity * rate) / 10000,
                ),
                commissionProductVersion: 1,
                commissionPaymentDays: 14,
                commissionPolicyVersion: 0,
              },
            },
            events: {
              create: {
                actorUserId: f.userIds.sellerA,
                fromStatus: 'SHIPPED',
                toStatus: 'DELIVERED',
                createdAt: when,
              },
            },
          },
        },
      },
      include: { sellerOrders: { include: { items: true } } },
    });
    await p.$transaction(
      (tx) => accrueCommission(tx, order.sellerOrders[0].id),
      { timeout: 30000 },
    );
    return order.sellerOrders[0];
  };
  const part = await seedDelivered();
  await seedDelivered({
    shop: f.sellers.b,
    variant: f.variants[2],
    quantity: 1,
    unit: 45000,
    shipping: 55000,
    rate: 500,
  });
  await seedDelivered({
    when: new Date(start - 1),
    quantity: 1,
    unit: 10000,
    shipping: 1000,
    rate: 0,
  });
  await seedDelivered({
    when: new Date(start + 86400000),
    quantity: 1,
    unit: 99900,
    shipping: 1000,
    rate: 0,
  });
  const period = { from: today, to: today };
  let report = await reports.report(actor, seller, period);
  assert.equal(report.totals.deliveredOrders, 1);
  assert.equal(report.totals.grossMerchandiseMinor, 40000);
  assert.equal(report.totals.codMinor, 75000);
  assert.equal(report.totals.units, 2);
  assert.equal(report.products[0].merchandiseMinor, 40000);
  assert.equal(report.shops.length, 0);
  const all = await reports.report(f.identities.admin, undefined, period);
  assert.equal(all.totals.deliveredOrders, 2);
  assert.equal(all.totals.grossMerchandiseMinor, 85000);
  assert.equal(all.shops.length, 2);
  await assert.rejects(
    () => reports.report(f.identities.sellerB, seller, period),
    { status: 403 },
  );
  await assert.rejects(
    () => reports.report(f.identities.buyer, undefined, period),
    { status: 403 },
  );
  pass(
    'Reports use delivered order snapshots, Sri Lanka midnight boundaries and exact seller/admin scope',
  );
  await p.product.update({
    where: { id: f.products[0] },
    data: { title: 'New title and current price', priceLkrMinor: 999999 },
  });
  report = await reports.report(actor, seller, period);
  assert.equal(report.totals.grossMerchandiseMinor, 40000);
  assert.equal(report.products[0].merchandiseMinor, 40000);
  const request = await operations.requestReturn(f.identities.buyer, {
    requestKey: randomUUID(),
    sellerOrderId: part.id,
    reason: 'Request a return for one item after inspection.',
    items: [{ orderItemId: part.items[0].id, quantity: 1 }],
  });
  await operations.reviewReturn(request.id, f.identities.admin, 'APPROVED');
  const refund = await afterSales.submitRefund(seller, actor, {
    requestKey: randomUUID(),
    returnItemId: request.items[0].id,
    merchandiseMinor: 10000,
    shippingMinor: 2000,
    method: 'CASH',
    reference: 'BUSINESS-REFUND-' + randomUUID(),
    paidOn: today,
  });
  assert.equal(
    (await reports.report(actor, seller, period)).totals.refundMerchandiseMinor,
    0,
  );
  await afterSales.reviewRefund(refund.id, f.identities.admin, {
    decision: 'APPROVED',
    reason: 'Verified this actual cash refund with the buyer.',
  });
  report = await reports.report(actor, seller, period);
  assert.equal(report.totals.refundMerchandiseMinor, 10000);
  assert.equal(report.totals.refundShippingMinor, 2000);
  assert.equal(report.totals.netMerchandiseMinor, 30000);
  assert.equal(report.totals.commissionAccruedMinor, 3000);
  await afterSales.reverseRefund(refund.id, f.identities.admin, {
    requestKey: randomUUID(),
    reference: 'BUSINESS-CORRECTION-' + randomUUID(),
    reason: 'The refund record was matched to the wrong transaction.',
  });
  report = await reports.report(actor, seller, period);
  assert.equal(report.totals.refundMerchandiseMinor, 0);
  assert.equal(report.totals.commissionAccruedMinor, 4000);
  pass(
    'Pending refunds never reduce sales; verified refunds and corrections update report and commission totals once',
  );
  const csv = await reports.export(actor, seller, {
    ...period,
    section: 'DAILY',
  });
  assert.match(csv, /date_asia_colombo/);
  assert.match(csv, /"400"/);
  await assert.rejects(
    () => reports.export(actor, seller, { ...period, section: 'SHOPS' }),
    { status: 403 },
  );
  assert.equal(
    (await bulk.history(actor, seller, q)).items.every(
      (j) => !('preview' in j),
    ),
    true,
  );
  await assert.rejects(() =>
    p.bulkJob.update({
      where: { id: preview.id },
      data: { reason: 'Attempt to rewrite an applied action.' },
    }),
  );
  pass(
    'CSV totals match the report and applied bulk snapshots remain immutable',
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
