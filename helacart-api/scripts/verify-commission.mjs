import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../dist/auth/auth.service.js';
import { CatalogService } from '../dist/catalog/catalog.service.js';
import { CommerceService } from '../dist/commerce/commerce.service.js';
import { NotificationsService } from '../dist/notifications/notifications.service.js';
import { CommissionService } from '../dist/commission/commission.service.js';
import { CommissionReceiptsService } from '../dist/commission/commission-receipts.service.js';
import { accrueCommission } from '../dist/commission/commission-ledger.js';
import {
  isolatedOrderDatabase,
  seedOrderFixture,
} from './order-flow-fixture.mjs';

// All records and policies live in an isolated schema. Receipt storage is an
// in-memory adapter; this audit does not upload documents or transfer money.
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
    notices = new NotificationsService(p, auth);
  const config = new ConfigService({
    RETURN_WINDOW_DAYS: 14,
    ADMIN_FIREBASE_UIDS: [f.identities.admin.uid],
  });
  const validator = new CommissionReceiptsService(config),
    objects = new Map();
  const receipts = {
    validate: (file) => validator.validate(file),
    upload: async (sellerId, file) => {
      const receipt = {
        storageKey: `commission-receipts/${sellerId}/${randomUUID()}`,
        contentType: file.mimetype,
        byteSize: file.size,
      };
      objects.set(receipt.storageKey, file.buffer);
      return receipt;
    },
    remove: async (receipt) => {
      objects.delete(receipt.storageKey);
    },
    read: async (receipt) => ({
      bytes: objects.get(receipt.storageKey),
      contentType: receipt.contentType,
    }),
  };
  const service = new CommissionService(p, auth, receipts, notices, config),
    commerce = new CommerceService(p, auth, catalog, notices);
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const buffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5ncAAAAASUVORK5CYII=',
      'base64',
    ),
    file = { buffer, size: buffer.length, mimetype: 'image/png' };
  const query = (extra = {}) => ({
    page: 1,
    limit: 20,
    status: 'ALL',
    filter: 'ALL',
    ...extra,
  });
  const policy = {
    version: 0,
    paymentDays: 14,
    bankName: 'Audit bank',
    accountName: 'Audit platform',
    accountNumber: 'AUDIT-ONLY',
    instructions: 'Isolated test, do not pay',
    reason: 'Configure isolated audit commission policy',
  };
  assert.equal((await service.policy()).mode, 'PRODUCT');
  assert.equal(
    await p.product.count({ where: { commissionRateBps: { not: null } } }),
    0,
  );
  pass('New installations leave all products unassigned and inactive');
  await service.updatePolicy(f.identities.admin, policy);
  await assert.rejects(() => service.updatePolicy(f.identities.admin, policy), {
    status: 409,
  });
  assert.equal((await service.policyHistory()).length, 1);
  pass('Policy changes have immutable history and reject stale versions');

  async function delivered(sellerId, baseMinor, age = 35, rateBps = 500) {
    return p.$transaction(
      async (tx) => {
        const order = await tx.order.create({
          data: {
            buyerId: f.userIds.buyer,
            addressId: f.addresses.buyer,
            checkoutKey: randomUUID(),
            snapshotHash: 'audit',
            recipient: 'Audit buyer',
            phone: '0771234567',
            line1: 'Audit address',
            city: 'Kandy',
            district: 'Kandy',
            postalCode: '20000',
            subtotalLkrMinor: baseMinor,
            shippingLkrMinor: 35000,
            totalLkrMinor: baseMinor + 35000,
          },
        });
        const part = await tx.sellerOrder.create({
          data: {
            orderId: order.id,
            sellerId,
            status: 'DELIVERED',
            subtotalLkrMinor: baseMinor,
            shippingLkrMinor: 35000,
            totalLkrMinor: baseMinor + 35000,
            paymentCollectedAt: new Date(Date.now() - age * 86400000),
            commissionRateBps: rateBps,
            commissionPolicyVersion: 1,
            commissionReturnDays: 14,
            commissionPaymentDays: 14,
          },
        });
        await accrueCommission(tx, part.id);
        return tx.commissionCharge.findFirstOrThrow({
          where: { sellerOrderId: part.id },
        });
      },
      { timeout: 15000, maxWait: 10000 },
    );
  }
  const a = await delivered(f.sellers.a, 1000000),
    b = await delivered(f.sellers.b, 2000000),
    held = await delivered(f.sellers.a, 500000);
  await p.returnRequest.create({
    data: {
      sellerOrderId: held.sellerOrderId,
      buyerId: f.userIds.buyer,
      reason: 'Isolated pending return evidence',
    },
  });
  let balance = await service.sellerSummary(f.sellers.a, f.identities.sellerA);
  assert.equal(balance.chargedMinor, 75000);
  assert.equal(balance.payableMinor, 50000);
  assert.equal(balance.heldMinor, 25000);
  assert.equal(balance.overdueMinor, 50000);
  pass(
    'Balances exclude delivery and hold open return cases after the normal return window',
  );
  await assert.rejects(
    () => service.sellerSummary(f.sellers.a, f.identities.sellerB),
    { status: 403 },
  );
  await assert.rejects(
    () =>
      service.sellerSummary(f.sellers.a, {
        ...f.identities.sellerA,
        email_verified: false,
      }),
    { status: 403 },
  );
  pass('Shop finances require verified membership and never cross accounts');
  const pay = (amount, reference, key = randomUUID()) => ({
    requestKey: key,
    amountMinor: amount,
    reference,
    paidOn: today,
    note: 'Isolated payment audit',
  });
  const firstDto = pay(20000, 'AUDIT-PARTIAL'),
    first = await service.submit(
      f.sellers.a,
      f.identities.sellerA,
      firstDto,
      file,
    );
  balance = await service.sellerSummary(f.sellers.a, f.identities.sellerA);
  assert.equal(balance.outstandingMinor, 75000);
  assert.equal(balance.pendingMinor, 20000);
  assert.equal(balance.availableToSubmitMinor, 30000);
  assert.equal(
    (await service.submit(f.sellers.a, f.identities.sellerA, firstDto, file))
      .id,
    first.id,
  );
  await assert.rejects(
    () =>
      service.submit(
        f.sellers.a,
        f.identities.sellerA,
        { ...firstDto, amountMinor: 10000 },
        file,
      ),
    { status: 409 },
  );
  assert.equal(await p.commissionPayment.count(), 1);
  assert.equal(objects.size, 1);
  pass(
    'Receipt submissions reserve payable funds without reducing debt and retry idempotently',
  );
  await assert.rejects(
    () =>
      service.submit(
        f.sellers.a,
        f.identities.sellerA,
        pay(30001, 'AUDIT-EXCESS'),
        file,
      ),
    { status: 409 },
  );
  assert.equal(objects.size, 1);
  await assert.rejects(
    () => service.receipt(first.id, f.sellers.b, f.identities.sellerB),
    { status: 404 },
  );
  assert.deepEqual(
    (await service.receipt(first.id, f.sellers.a, f.identities.sellerA)).bytes,
    buffer,
  );
  pass(
    'Overpayments clean up their receipt and receipt reads enforce ownership',
  );
  await service.review(first.id, f.identities.admin, {
    decision: 'APPROVED',
    reason: 'Actual isolated transfer verified',
  });
  balance = await service.sellerSummary(f.sellers.a, f.identities.sellerA);
  assert.equal(balance.outstandingMinor, 55000);
  assert.equal(balance.paidMinor, 20000);
  assert.equal(balance.pendingMinor, 0);
  await assert.rejects(
    () =>
      service.review(first.id, f.identities.admin, {
        decision: 'APPROVED',
        reason: 'Attempted duplicate verification',
      }),
    { status: 409 },
  );
  pass(
    'Only owner confirmation reduces balances and the same transfer cannot be approved twice',
  );
  const raced = await Promise.allSettled([
    service.submit(
      f.sellers.a,
      f.identities.sellerA,
      pay(20000, 'AUDIT-RACE-1'),
      file,
    ),
    service.submit(
      f.sellers.a,
      f.identities.sellerA,
      pay(20000, 'AUDIT-RACE-2'),
      file,
    ),
  ]);
  assert.equal(raced.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(
    raced.filter((r) => r.status === 'rejected' && r.reason.status === 409)
      .length,
    1,
  );
  const pending = raced.find((r) => r.status === 'fulfilled').value;
  const decisions = await Promise.allSettled([
    service.review(pending.id, f.identities.admin, {
      decision: 'APPROVED',
      reason: 'Bank transfer verified in audit',
    }),
    service.review(pending.id, f.identities.admin, {
      decision: 'REJECTED',
      reason: 'Concurrent audit rejection attempt',
    }),
  ]);
  assert.equal(decisions.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(
    decisions.filter((r) => r.status === 'rejected' && r.reason.status === 409)
      .length,
    1,
  );
  pass('Concurrent submissions and opposing reviews cannot double count money');
  const creditDto = {
    requestKey: randomUUID(),
    chargeId: a.id,
    baseMinor: 200000,
    reference: '=AUDIT-REFUND',
    reason: 'Verified merchandise refund for isolated order',
  };
  const credit = await service.refund(
    f.sellers.a,
    f.identities.admin,
    creditDto,
  );
  assert.equal(credit.creditMinor, 10000);
  assert.equal(
    (await service.refund(f.sellers.a, f.identities.admin, creditDto)).id,
    credit.id,
  );
  await service.refund(f.sellers.a, f.identities.admin, {
    ...creditDto,
    requestKey: randomUUID(),
    baseMinor: 800000,
    reference: 'AUDIT-REFUND-REST',
  });
  await assert.rejects(
    () =>
      service.refund(f.sellers.a, f.identities.admin, {
        ...creditDto,
        requestKey: randomUUID(),
        baseMinor: 1,
        reference: 'AUDIT-REFUND-EXCESS',
      }),
    { status: 409 },
  );
  assert.equal(
    (
      await p.commissionRefund.aggregate({
        where: { chargeId: a.id },
        _sum: { creditMinor: true },
      })
    )._sum.creditMinor,
    50000,
  );
  balance = await service.sellerSummary(f.sellers.a, f.identities.sellerA);
  assert.equal(balance.balanceMinor, 25000 - balance.paidMinor);
  assert.equal(balance.payableMinor, 0);
  pass(
    'Partial and full refunds reverse original-rate commission and preserve any credit balance',
  );
  const refundRaces = await Promise.allSettled(
    ['A', 'B'].map((s) =>
      service.refund(f.sellers.b, f.identities.admin, {
        requestKey: randomUUID(),
        chargeId: b.id,
        baseMinor: 1200000,
        reference: 'AUDIT-REFUND-RACE-' + s,
        reason: 'Verified concurrent refund audit evidence',
      }),
    ),
  );
  assert.equal(refundRaces.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(
    refundRaces.filter(
      (r) => r.status === 'rejected' && r.reason.status === 409,
    ).length,
    1,
  );
  pass('Concurrent credits cannot refund more than the merchandise value');
  const small = await delivered(f.sellers.a, 101);
  await service.refund(f.sellers.a, f.identities.admin, {
    requestKey: randomUUID(),
    chargeId: small.id,
    baseMinor: 2,
    reference: 'AUDIT-ROUND-1',
    reason: 'Verified fractional commission credit',
  });
  await service.refund(f.sellers.a, f.identities.admin, {
    requestKey: randomUUID(),
    chargeId: small.id,
    baseMinor: 99,
    reference: 'AUDIT-ROUND-2',
    reason: 'Verified final merchandise refund',
  });
  assert.equal(
    (
      await p.commissionRefund.aggregate({
        where: { chargeId: small.id },
        _sum: { creditMinor: true },
      })
    )._sum.creditMinor,
    5,
  );
  pass('Cumulative rounding returns exactly the original fee on a full refund');
  assert.equal(
    (await service.remind(f.sellers.b, f.identities.admin)).sent,
    true,
  );
  assert.equal(
    (await service.remind(f.sellers.b, f.identities.admin)).sent,
    false,
  );
  pass('Overdue reminders are limited to one per shop per local day');
  const month = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date());
  const statement = await service.statement(
    f.sellers.a,
    query({ month }),
    f.identities.sellerA,
  );
  assert.equal(statement.closingMinor, balance.balanceMinor);
  const csv = (
    await service.exportStatement(
      f.sellers.a,
      query({ month }),
      f.identities.sellerA,
    )
  ).toString();
  assert.ok(csv.includes("'=AUDIT-REFUND"));
  assert.ok(
    !JSON.stringify(
      await service.payments(query(), f.sellers.a, f.identities.sellerA),
    ).includes('storageKey'),
  );
  pass(
    'Statements reconcile with balances, escape spreadsheet formulas and hide storage metadata',
  );
  await p.seller.update({
    where: { id: f.sellers.b },
    data: { status: 'SUSPENDED' },
  });
  assert.equal(
    (await service.sellerSummary(f.sellers.b, f.identities.sellerB)).name,
    'Audit shop B',
  );
  pass('Suspended shops retain access to their commission account');
  for (const sql of [
    p.$executeRaw`UPDATE "CommissionCharge" SET "amountMinor"=1 WHERE id=${a.id}::uuid`,
    p.$executeRaw`DELETE FROM "CommissionRefund" WHERE id=${credit.id}::uuid`,
    p.$executeRaw`UPDATE "CommissionPayment" SET "amountMinor"=1 WHERE id=${first.id}::uuid`,
    p.$executeRaw`UPDATE "SellerOrder" SET "commissionRateBps"=900 WHERE id=${a.sellerOrderId}::uuid`,
  ])
    await assert.rejects(() => sql);
  pass(
    'Database constraints preserve charges, credits, reviewed payments and rate snapshots',
  );
  await service.updateProduct(f.products[0], f.identities.admin, {
    version: 0,
    rateBps: 500,
    reason: 'Assign five percent to audit shirt',
  });
  await service.updateProduct(f.products[1], f.identities.admin, {
    version: 0,
    rateBps: 1000,
    reason: 'Assign ten percent to audit bag',
  });
  await assert.rejects(
    () =>
      service.updateProduct(f.products[0], f.identities.admin, {
        version: 0,
        rateBps: 600,
        reason: 'Stale product rate must be rejected',
      }),
    { status: 409 },
  );
  assert.equal((await service.productHistory(f.products[0])).length, 1);
  pass(
    'Per-product rates have an audit history and stale changes are rejected',
  );
  await commerce.setCartItem(f.identities.buyer, f.variants[0], 1);
  await commerce.setCartItem(f.identities.buyer, f.variants[1], 1);
  const cart = await commerce.cart(f.identities.buyer),
    checkout = await commerce.checkout(f.identities.buyer, {
      checkoutKey: randomUUID(),
      addressId: f.addresses.buyer,
      quote: cart.checkoutQuote,
    });
  const orderPart = checkout.sellerOrders[0];
  const saved = await p.sellerOrder.findUniqueOrThrow({
    where: { id: orderPart.id },
    include: { items: true },
  });
  assert.equal(saved.commissionRateBps, null);
  assert.deepEqual(
    saved.items.map((i) => i.commissionRateBps).sort((a, b) => a - b),
    [500, 1000],
  );
  assert.deepEqual(
    saved.items.map((i) => i.commissionAmountMinor).sort((a, b) => a - b),
    [1000, 3000],
  );
  assert.ok(saved.items.every((i) => i.commissionPaymentDays === 14));
  assert.ok(!('commissionRateBps' in orderPart));
  assert.ok(orderPart.items.every((i) => !('commissionRateBps' in i)));
  await service.updatePolicy(f.identities.admin, {
    ...policy,
    version: 1,
    paymentDays: 7,
  });
  await service.updateProduct(f.products[0], f.identities.admin, {
    version: 1,
    rateBps: 750,
    reason: 'Change future audit shirt rate only',
  });
  for (const status of ['ACCEPTED', 'PACKED', 'SHIPPED', 'DELIVERED'])
    await commerce.sellerStatus(
      f.sellers.a,
      orderPart.id,
      f.identities.sellerA,
      { status, ...(status === 'DELIVERED' ? { paymentCollected: true } : {}) },
    );
  const frozen = await p.commissionCharge.findFirstOrThrow({
    where: { sellerOrderId: orderPart.id },
    orderBy: { rateBps: 'asc' },
  });
  assert.equal(frozen.rateBps, 500);
  assert.equal(frozen.amountMinor, 1000);
  assert.equal(frozen.dueAt.getTime(), frozen.holdUntil.getTime());
  const deliveredOrder = await p.sellerOrder.findUniqueOrThrow({
    where: { id: orderPart.id },
  });
  assert.equal(
    frozen.dueAt.getTime() - deliveredOrder.paymentCollectedAt.getTime(),
    14 * 86400000,
  );
  pass(
    'Mixed-product checkout freezes item rates, amounts and exact delivery-based payment terms',
  );
  await assert.rejects(
    () =>
      commerce.sellerStatus(f.sellers.a, orderPart.id, f.identities.sellerA, {
        status: 'DELIVERED',
        paymentCollected: true,
      }),
    { status: 409 },
  );
  assert.equal(
    await p.commissionCharge.count({ where: { sellerOrderId: orderPart.id } }),
    2,
  );
  pass('Delivery retries cannot create duplicate commission charges');
  const listed = await service.charges(
    f.sellers.a,
    query({ limit: 1 }),
    f.identities.sellerA,
  );
  assert.ok(listed.total > 1);
  assert.equal(listed.items.length, 1);
  const overdue = await service.balances(query({ filter: 'OVERDUE' }));
  assert.ok(overdue.items.some((row) => row.id === f.sellers.b));
  pass('Account lists use server pagination and platform-wide overdue filters');
  const own = await p.commissionPayment.create({
    data: {
      sellerId: f.sellers.a,
      submitterId: f.userIds.admin,
      requestKey: randomUUID(),
      payloadHash: '0'.repeat(64),
      amountMinor: 1,
      reference: 'AUDIT-SELF',
      paidOn: today,
      storageKey: 'commission-receipts/audit-self',
      contentType: 'image/png',
      byteSize: buffer.length,
    },
  });
  await assert.rejects(
    () =>
      service.review(own.id, f.identities.admin, {
        decision: 'APPROVED',
        reason: 'Self verification is not permitted',
      }),
    { status: 403 },
  );
  pass('Administrators cannot verify their own seller payment submission');

  const correctionBefore = await service.sellerSummary(
    f.sellers.a,
    f.identities.sellerA,
  );
  const paymentCorrection = {
    requestKey: randomUUID(),
    kind: 'PAYMENT',
    targetId: first.id,
    reference: 'AUDIT-CORRECT-PAYMENT',
    reason: 'Reverse incorrectly matched bank transfer approval',
  };
  const correction = await service.correct(
    f.sellers.a,
    f.identities.admin,
    paymentCorrection,
  );
  assert.equal(correction.amountMinor, 20000);
  assert.equal(
    (await service.correct(f.sellers.a, f.identities.admin, paymentCorrection))
      .id,
    correction.id,
  );
  assert.equal(
    (await service.sellerSummary(f.sellers.a, f.identities.sellerA))
      .balanceMinor,
    correctionBefore.balanceMinor + 20000,
  );
  await assert.rejects(
    () =>
      service.correct(f.sellers.a, f.identities.admin, {
        ...paymentCorrection,
        requestKey: randomUUID(),
        reference: 'AUDIT-CORRECT-TWICE',
      }),
    { status: 409 },
  );
  pass(
    'Incorrect payment approvals reverse once without editing payment history',
  );
  const refundCorrection = await service.correct(
    f.sellers.a,
    f.identities.admin,
    {
      requestKey: randomUUID(),
      kind: 'REFUND',
      targetId: credit.id,
      reference: 'AUDIT-CORRECT-REFUND',
      reason: 'Verified original refund credit was entered incorrectly',
    },
  );
  assert.equal(refundCorrection.amountMinor, 10000);
  const correctedCharges = await service.charges(
    f.sellers.a,
    query(),
    f.identities.sellerA,
  );
  assert.equal(
    correctedCharges.items.find((c) => c.id === a.id).refundedBaseMinor,
    800000,
  );
  assert.equal(
    correctedCharges.items.find((c) => c.id === a.id).creditedMinor,
    40000,
  );
  pass(
    'Refund corrections restore merchandise eligibility and commission balances',
  );
  const adjusted = await service.statement(
    f.sellers.a,
    query({ month }),
    f.identities.sellerA,
  );
  assert.equal(
    adjusted.closingMinor,
    (await service.sellerSummary(f.sellers.a, f.identities.sellerA))
      .balanceMinor,
  );
  assert.ok(adjusted.items.some((e) => e.kind === 'ADJUSTMENT'));
  await assert.rejects(
    () =>
      p.$executeRaw`DELETE FROM "CommissionCorrection" WHERE id=${correction.id}::uuid`,
  );
  pass('Corrections appear in statements and cannot be deleted');

  const bBefore = await service.sellerSummary(
    f.sellers.b,
    f.identities.sellerB,
  );
  await service.hold(b.id, f.identities.admin, {
    version: 0,
    held: true,
    reason: 'Unresolved refund dispute awaiting review',
  });
  const bHeld = await service.sellerSummary(f.sellers.b, f.identities.sellerB);
  assert.equal(bHeld.payableMinor, 0);
  assert.equal(bHeld.overdueMinor, 0);
  await assert.rejects(
    () =>
      service.hold(b.id, f.identities.admin, {
        version: 0,
        held: false,
        reason: 'Stale hold release should be rejected',
      }),
    { status: 409 },
  );
  await p.returnRequest.create({
    data: {
      sellerOrderId: b.sellerOrderId,
      buyerId: f.userIds.buyer,
      reason: 'Pending merchandise refund for disputed order',
    },
  });
  await service.hold(b.id, f.identities.admin, {
    version: 1,
    held: false,
    reason: 'Dispute resolved but buyer return is still pending',
  });
  assert.equal(
    (await service.sellerSummary(f.sellers.b, f.identities.sellerB))
      .payableMinor,
    0,
  );
  await p.returnRequest.updateMany({
    where: { sellerOrderId: b.sellerOrderId },
    data: { status: 'RESOLVED' },
  });
  assert.equal(
    (await service.sellerSummary(f.sellers.b, f.identities.sellerB))
      .payableMinor,
    bBefore.payableMinor,
  );
  const bCharges = await service.charges(
    f.sellers.b,
    query(),
    f.identities.sellerB,
  );
  assert.equal(bCharges.items.find((c) => c.id === b.id).holds.length, 2);
  pass(
    'Dispute holds pause due commission, preserve history and cannot bypass open returns',
  );

  const mixedCharges = await p.commissionCharge.findMany({
    where: { sellerOrderId: orderPart.id },
    orderBy: { rateBps: 'asc' },
  });
  const itemCredit = await service.refund(f.sellers.a, f.identities.admin, {
    requestKey: randomUUID(),
    chargeId: mixedCharges[0].id,
    baseMinor: 20000,
    reference: 'ITEM-SHIRT-REFUND',
    reason: 'Verified full refund of the shirt merchandise',
  });
  const bagCredit = await service.refund(f.sellers.a, f.identities.admin, {
    requestKey: randomUUID(),
    chargeId: mixedCharges[1].id,
    baseMinor: 15000,
    reference: 'ITEM-BAG-REFUND',
    reason: 'Verified half refund of the bag merchandise',
  });
  assert.equal(itemCredit.creditMinor, 1000);
  assert.equal(bagCredit.creditMinor, 1500);
  await assert.rejects(
    () =>
      service.refund(f.sellers.a, f.identities.admin, {
        requestKey: randomUUID(),
        chargeId: mixedCharges[0].id,
        baseMinor: 1,
        reference: 'ITEM-OVER-REFUND',
        reason: 'Should reject refund beyond this specific item',
      }),
    { status: 409 },
  );
  pass(
    'Mixed-rate refunds use the specific item rate and cap that item independently',
  );
  await service.hold(mixedCharges[0].id, f.identities.admin, {
    version: 0,
    held: true,
    reason: 'Pause entire mixed rate order for a buyer dispute',
  });
  const mixedHeld = await p.commissionHoldEvent.findMany({
    where: { chargeId: { in: mixedCharges.map((c) => c.id) } },
    orderBy: { version: 'desc' },
  });
  assert.equal(mixedHeld.length, 2);
  assert.ok(mixedHeld.every((h) => h.held && h.version === 1));
  await service.hold(mixedCharges[1].id, f.identities.admin, {
    version: 1,
    held: false,
    reason: 'Release the entire mixed rate order after review',
  });
  const mixedReleased = await p.commissionHoldEvent.findMany({
    where: { chargeId: { in: mixedCharges.map((c) => c.id) }, version: 2 },
  });
  assert.equal(mixedReleased.length, 2);
  assert.ok(mixedReleased.every((h) => !h.held));
  pass(
    'One admin hold or release applies atomically to every mixed-rate order item',
  );

  await assert.rejects(
    () =>
      p.$executeRaw`UPDATE "OrderItem" SET "commissionAmountMinor"=1 WHERE id=${saved.items[0].id}::uuid`,
  );
  const rateHistory = await service.productHistory(f.products[0]);
  await assert.rejects(
    () =>
      p.$executeRaw`DELETE FROM "ProductCommissionChange" WHERE id=${rateHistory[0].id}::uuid`,
  );
  await assert.rejects(
    () =>
      p.$executeRaw`DELETE FROM "CommissionHoldEvent" WHERE "chargeId"=${b.id}::uuid`,
  );
  pass(
    'Database rejects changes to item snapshots, rate decisions and hold history',
  );

  await assert.rejects(
    () => service.products(query(), f.sellers.a, f.identities.sellerB),
    { status: 403 },
  );
  const ownRates = await service.products(
    query(),
    f.sellers.a,
    f.identities.sellerA,
  );
  assert.equal(ownRates.total, 2);
  assert.ok(ownRates.items.every((row) => row.seller.name === 'Audit shop A'));
  assert.equal((await service.products(query({ q: 'cotton shirt' }))).total, 1);
  pass(
    'Product rate search is paginated and sellers can read only their shop rates',
  );

  await service.updateProduct(f.products[0], f.identities.admin, {
    version: 2,
    rateBps: null,
    reason: 'Remove rate assignment from future shirt orders',
  });
  await commerce.setCartItem(f.identities.buyerTwo, f.variants[0], 1);
  await commerce.setCartItem(f.identities.buyerTwo, f.variants[1], 1);
  const secondCart = await commerce.cart(f.identities.buyerTwo);
  const secondCheckout = await commerce.checkout(f.identities.buyerTwo, {
    checkoutKey: randomUUID(),
    addressId: f.addresses.buyerTwo,
    quote: secondCart.checkoutQuote,
  });
  const secondPart = secondCheckout.sellerOrders[0];
  const secondItems = await p.orderItem.findMany({
    where: { sellerOrderId: secondPart.id },
    orderBy: { sku: 'asc' },
  });
  assert.equal(secondItems[0].commissionRateBps, null);
  assert.equal(secondItems[0].commissionAmountMinor, null);
  assert.equal(secondItems[1].commissionRateBps, 1000);
  assert.equal(secondItems[1].commissionAmountMinor, 3000);
  assert.equal(secondItems[1].commissionPaymentDays, 7);
  for (const status of ['ACCEPTED', 'PACKED', 'SHIPPED', 'DELIVERED'])
    await commerce.sellerStatus(
      f.sellers.a,
      secondPart.id,
      f.identities.sellerA,
      { status, ...(status === 'DELIVERED' ? { paymentCollected: true } : {}) },
    );
  const secondCharge = await p.commissionCharge.findFirstOrThrow({
    where: { sellerOrderId: secondPart.id },
  });
  const secondDelivered = await p.sellerOrder.findUniqueOrThrow({
    where: { id: secondPart.id },
  });
  assert.equal(
    await p.commissionCharge.count({ where: { sellerOrderId: secondPart.id } }),
    1,
  );
  assert.equal(
    secondCharge.dueAt.getTime() - secondDelivered.paymentCollectedAt.getTime(),
    7 * 86400000,
  );
  assert.equal(
    (await p.orderItem.findUniqueOrThrow({ where: { id: saved.items[0].id } }))
      .commissionPaymentDays,
    14,
  );
  pass(
    'Cleared rates become inactive and changed payment days affect only future checkouts',
  );
} finally {
  await db.close();
}
console.log(
  JSON.stringify({
    checks,
    isolatedSchemaRemoved: true,
    customerDataUntouched: true,
    receiptStorage: 'in-memory',
  }),
);
