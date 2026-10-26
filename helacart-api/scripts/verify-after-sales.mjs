import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../dist/auth/auth.service.js';
import { CatalogService } from '../dist/catalog/catalog.service.js';
import { NotificationsService } from '../dist/notifications/notifications.service.js';
import { AfterSalesService } from '../dist/after-sales/after-sales.service.js';
import { OperationsService } from '../dist/operations/operations.service.js';
import { CommissionService } from '../dist/commission/commission.service.js';
import { accrueCommission } from '../dist/commission/commission-ledger.js';
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
      RETURN_WINDOW_DAYS: 14,
    }),
    notices = new NotificationsService(p, auth, config),
    service = new AfterSalesService(p, auth, catalog, notices, config),
    operations = new OperationsService(p, auth, notices, config),
    commission = new CommissionService(p, auth, {}, notices, config);
  const q = (extra = {}) => ({ page: 1, limit: 20, status: 'ALL', ...extra }),
    buyer = { role: 'BUYER' },
    seller = { role: 'SELLER', sellerId: f.sellers.a },
    admin = { role: 'ADMIN' };
  const old = new Date(Date.now() - 3 * 86400000),
    delivered = new Date(Date.now() - 2 * 86400000);
  const order = await p.order.create({
    data: {
      buyerId: f.userIds.buyer,
      addressId: f.addresses.buyer,
      checkoutKey: randomUUID(),
      snapshotHash: 'audit',
      recipient: 'Audit buyer',
      phone: '0771234567',
      line1: '12 Audit Road',
      city: 'Kandy',
      district: 'Kandy',
      postalCode: '20000',
      subtotalLkrMinor: 120000,
      shippingLkrMinor: 35000,
      totalLkrMinor: 155000,
      createdAt: old,
      sellerOrders: {
        create: {
          sellerId: f.sellers.a,
          status: 'DELIVERED',
          subtotalLkrMinor: 120000,
          shippingLkrMinor: 35000,
          totalLkrMinor: 155000,
          paymentCollectedAt: delivered,
          createdAt: old,
          items: {
            create: [
              {
                variantId: f.variants[0],
                productTitle: 'Audit cotton shirt',
                sku: 'AUDIT-0',
                optionValues: {},
                unitLkrMinor: 20000,
                quantity: 3,
                lineLkrMinor: 60000,
                commissionRateBps: 1000,
                commissionAmountMinor: 6000,
                commissionProductVersion: 1,
                commissionPaymentDays: 1,
                commissionPolicyVersion: 0,
              },
              {
                variantId: f.variants[1],
                productTitle: 'Audit cotton bag',
                sku: 'AUDIT-1',
                optionValues: {},
                unitLkrMinor: 30000,
                quantity: 2,
                lineLkrMinor: 60000,
                commissionRateBps: 500,
                commissionAmountMinor: 3000,
                commissionProductVersion: 1,
                commissionPaymentDays: 1,
                commissionPolicyVersion: 0,
              },
            ],
          },
          events: {
            create: {
              actorUserId: f.userIds.sellerA,
              fromStatus: 'SHIPPED',
              toStatus: 'DELIVERED',
              createdAt: delivered,
            },
          },
        },
      },
    },
    include: { sellerOrders: { include: { items: true } } },
  });
  const part = order.sellerOrders[0],
    shirt = part.items.find((i) => i.sku === 'AUDIT-0');
  await p.$transaction((tx) => accrueCommission(tx, part.id), {
    timeout: 30000,
  });
  assert.equal(
    (await commission.sellerSummary(f.sellers.a, f.identities.sellerA))
      .payableMinor,
    9000,
  );
  const caseDto = {
    requestKey: randomUUID(),
    sellerOrderId: part.id,
    title: 'Question about this delivered order',
    category: 'REFUND',
    body: 'Please help resolve a refund issue with this order.',
  };
  const support = await service.createCase(f.identities.buyer, buyer, caseDto);
  assert.equal(
    (await service.createCase(f.identities.buyer, buyer, caseDto)).id,
    support.id,
  );
  await service.caseDetail(support.id, f.identities.sellerA, seller);
  await assert.rejects(
    () => service.caseDetail(support.id, f.identities.buyerTwo, buyer),
    { status: 404 },
  );
  await assert.rejects(
    () =>
      service.caseDetail(support.id, f.identities.sellerB, {
        role: 'SELLER',
        sellerId: f.sellers.b,
      }),
    { status: 404 },
  );
  pass(
    'Order support cases retry idempotently and remain private to their buyer, shop and admin',
  );
  const message = {
    requestKey: randomUUID(),
    body: 'I can provide the order details for review.',
  };
  const sent = await service.addMessage(
    support.id,
    f.identities.buyer,
    buyer,
    message,
  );
  assert.equal(
    (await service.addMessage(support.id, f.identities.buyer, buyer, message))
      .id,
    sent.id,
  );
  await service.addMessage(support.id, f.identities.sellerA, seller, {
    requestKey: randomUUID(),
    body: 'We are checking the refund with the buyer.',
  });
  await assert.rejects(
    () =>
      service.decideCase(support.id, f.identities.admin, {
        version: 0,
        status: 'RESOLVED',
        financeHold: false,
        reason: 'Stale decision must not hide a new reply',
      }),
    { status: 409 },
  );
  assert.equal(
    (
      await service.caseMessages(
        support.id,
        f.identities.admin,
        admin,
        q({ limit: 2 }),
      )
    ).total,
    3,
  );
  pass(
    'Support replies are idempotent, paginated and prevent decisions against unseen replies',
  );
  let detail = await service.caseDetail(support.id, f.identities.admin, admin);
  await service.decideCase(support.id, f.identities.admin, {
    version: detail.version,
    status: 'UNDER_REVIEW',
    financeHold: true,
    reason: 'Hold commission while the refund dispute is reviewed',
  });
  assert.equal(
    (await commission.sellerSummary(f.sellers.a, f.identities.sellerA))
      .payableMinor,
    0,
  );
  detail = await service.caseDetail(support.id, f.identities.admin, admin);
  await service.decideCase(support.id, f.identities.admin, {
    version: detail.version,
    status: 'RESOLVED',
    financeHold: false,
    reason: 'Support review completed and temporary hold released',
  });
  assert.equal(
    (await commission.sellerSummary(f.sellers.a, f.identities.sellerA))
      .payableMinor,
    9000,
  );
  await service.addMessage(support.id, f.identities.buyer, buyer, {
    requestKey: randomUUID(),
    body: 'I need some further help with the item return.',
  });
  assert.equal(
    (await service.caseDetail(support.id, f.identities.admin, admin)).status,
    'OPEN',
  );
  detail = await service.caseDetail(support.id, f.identities.admin, admin);
  await service.decideCase(support.id, f.identities.admin, {
    version: detail.version,
    status: 'CLOSED',
    financeHold: false,
    reason: 'Conversation completed; further issues can use a new case',
  });
  await assert.rejects(
    () =>
      service.addMessage(support.id, f.identities.buyer, buyer, {
        requestKey: randomUUID(),
        body: 'Must not post in a closed conversation',
      }),
    { status: 409 },
  );
  pass(
    'Admin case holds pause commission, resolution releases only that hold and closed cases refuse replies',
  );
  const firstDto = {
    requestKey: randomUUID(),
    sellerOrderId: part.id,
    reason: 'Two shirts need a return after inspection',
    items: [{ orderItemId: shirt.id, quantity: 2 }],
  };
  const first = await operations.requestReturn(f.identities.buyer, firstDto);
  assert.equal(
    (await operations.requestReturn(f.identities.buyer, firstDto)).id,
    first.id,
  );
  await assert.rejects(
    () =>
      operations.requestReturn(f.identities.buyer, {
        ...firstDto,
        reason: 'Changed details with the original request key',
      }),
    { status: 409 },
  );
  const options = await service.options(f.identities.buyer, part.id);
  assert.equal(
    options.items.find((i) => i.orderItemId === shirt.id).remainingQuantity,
    1,
  );
  const races = await Promise.allSettled(
    ['A', 'B'].map((s) =>
      operations.requestReturn(f.identities.buyer, {
        requestKey: randomUUID(),
        sellerOrderId: part.id,
        reason: 'Concurrent remaining shirt return request ' + s,
        items: [{ orderItemId: shirt.id, quantity: 1 }],
      }),
    ),
  );
  assert.equal(races.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(
    races.filter((r) => r.status === 'rejected' && r.reason.status === 409)
      .length,
    1,
  );
  await assert.rejects(
    () =>
      operations.requestReturn(f.identities.buyerTwo, {
        ...firstDto,
        requestKey: randomUUID(),
      }),
    { status: 404 },
  );
  pass(
    'Partial item returns reserve quantities, reject over-allocation and enforce buyer ownership',
  );
  await operations.reviewReturn(first.id, f.identities.admin, 'APPROVED');
  const returnItem = first.items[0],
    today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  const refundDto = {
    requestKey: randomUUID(),
    returnItemId: returnItem.id,
    merchandiseMinor: 10000,
    shippingMinor: 5000,
    method: 'BANK_TRANSFER',
    reference: 'REFUND-TEST-ONE',
    paidOn: today,
    note: 'Actual refund recorded in an isolated test',
  };
  const pending = await service.submitRefund(
    f.sellers.a,
    f.identities.sellerA,
    refundDto,
  );
  assert.equal(
    (await service.submitRefund(f.sellers.a, f.identities.sellerA, refundDto))
      .id,
    pending.id,
  );
  await assert.rejects(
    () =>
      service.submitRefund(f.sellers.a, f.identities.sellerA, {
        ...refundDto,
        requestKey: randomUUID(),
        reference: 'OVER-MERCH',
        merchandiseMinor: 30001,
      }),
    { status: 409 },
  );
  await assert.rejects(
    () =>
      service.submitRefund(f.sellers.a, f.identities.sellerA, {
        ...refundDto,
        requestKey: randomUUID(),
        reference: 'OVER-SHIPPING',
        merchandiseMinor: 0,
        shippingMinor: 30001,
      }),
    { status: 409 },
  );
  assert.equal(await p.commissionRefund.count(), 0);
  pass(
    'Pending cash refund records reserve item and shipping budgets without crediting commission',
  );
  await service.reviewRefund(pending.id, f.identities.admin, {
    decision: 'APPROVED',
    reason: 'Verified the actual buyer refund against the bank record',
  });
  assert.equal(
    (await commission.sellerSummary(f.sellers.a, f.identities.sellerA))
      .creditedMinor,
    1000,
  );
  await assert.rejects(
    () =>
      service.reviewRefund(pending.id, f.identities.admin, {
        decision: 'APPROVED',
        reason: 'Duplicate approval must not create another credit',
      }),
    { status: 409 },
  );
  pass(
    'Only admin verification confirms a refund and credits the original item commission once',
  );
  const reversal = {
    requestKey: randomUUID(),
    reference: 'REVERSAL-TEST-ONE',
    reason: 'Incorrect refund record verified; preserve and reverse it',
  };
  await service.reverseRefund(pending.id, f.identities.admin, reversal);
  await service.reverseRefund(pending.id, f.identities.admin, reversal);
  assert.equal(
    (await commission.sellerSummary(f.sellers.a, f.identities.sellerA))
      .creditedMinor,
    0,
  );
  const full = await service.submitRefund(f.sellers.a, f.identities.sellerA, {
    ...refundDto,
    requestKey: randomUUID(),
    reference: 'REFUND-TEST-FULL',
    merchandiseMinor: 40000,
    shippingMinor: 35000,
  });
  await assert.rejects(
    () =>
      operations.resolveReturn(
        first.id,
        f.identities.admin,
        'Complete only after this refund is verified',
        'REFUNDED',
      ),
    { status: 409 },
  );
  await service.reviewRefund(full.id, f.identities.admin, {
    decision: 'APPROVED',
    reason: 'Verified full merchandise and delivery refund to buyer',
  });
  assert.equal(
    (await commission.sellerSummary(f.sellers.a, f.identities.sellerA))
      .creditedMinor,
    4000,
  );
  await operations.resolveReturn(
    first.id,
    f.identities.admin,
    'Full verified item refund recorded and case completed',
    'REFUNDED',
  );
  const other = await p.returnRequest.findMany({
    where: { sellerOrderId: part.id, id: { not: first.id }, status: 'PENDING' },
  });
  for (const row of other)
    await operations.reviewReturn(
      row.id,
      f.identities.admin,
      'REJECTED',
      'Duplicate remaining-item request rejected after review',
    );
  assert.equal(
    (await service.options(f.identities.buyer, part.id)).items.find(
      (i) => i.orderItemId === shirt.id,
    ).remainingQuantity,
    1,
  );
  pass(
    'Refund reversals restore budgets and commission; return completion requires verified refund evidence',
  );
  await service.reverseRefund(full.id, f.identities.admin, {
    requestKey: randomUUID(),
    reference: 'REVERSAL-TEST-FULL',
    reason: 'Full refund record correction for the remaining workflow test',
  });
  const later = await service.submitRefund(f.sellers.a, f.identities.sellerA, {
    ...refundDto,
    requestKey: randomUUID(),
    reference: 'REFUND-AFTER-RESOLUTION',
    merchandiseMinor: 40000,
    shippingMinor: 0,
  });
  assert.equal(
    (await commission.sellerSummary(f.sellers.a, f.identities.sellerA))
      .payableMinor,
    0,
  );
  await service.reviewRefund(later.id, f.identities.admin, {
    decision: 'REJECTED',
    reason: 'Refund evidence did not match the submitted transaction',
  });
  assert.equal(
    (await commission.sellerSummary(f.sellers.a, f.identities.sellerA))
      .payableMinor,
    9000,
  );
  const buyerRefunds = await service.refunds(f.identities.buyer, buyer, q());
  assert.equal(buyerRefunds.total, 3);
  assert.equal(
    (await service.refunds(f.identities.buyerTwo, buyer, q())).total,
    0,
  );
  assert.ok(buyerRefunds.items.every((r) => !('commissionRefundId' in r)));
  pass(
    'Pending refunds hold even resolved returns; rejection releases the hold and buyer refund lists stay private',
  );
  const listedReturns = await service.returns(f.identities.buyer, buyer, q());
  assert.equal(
    listedReturns.items.find((r) => r.id === first.id).remainingShippingMinor,
    35000,
  );
  assert.ok(
    listedReturns.items
      .flatMap((r) => r.items)
      .flatMap((i) => i.refunds)
      .every((r) => !('commissionRefundId' in r)),
  );
  pass(
    'Return lists show the shared remaining delivery refund budget without exposing internal commission links',
  );
  for (const sql of [
    p.$executeRaw`UPDATE "ReturnItem" SET quantity=1 WHERE id=${returnItem.id}::uuid`,
    p.$executeRaw`DELETE FROM "SupportMessage" WHERE id=${sent.id}::uuid`,
    p.$executeRaw`UPDATE "RefundRecord" SET "amountMinor"=1 WHERE id=${pending.id}::uuid`,
  ])
    await assert.rejects(() => sql);
  pass(
    'Database protects return quantities, support history and reviewed financial records',
  );
} catch (error) {
  console.error(
    JSON.stringify({ auditFailure: error.message, code: error.code ?? null }),
  );
  process.exitCode = 1;
} finally {
  await db.close();
}
console.log(
  JSON.stringify({
    checks,
    isolatedSchemaRemoved: true,
    customerDataUntouched: true,
    externalPaymentsOrMessages: false,
  }),
);
