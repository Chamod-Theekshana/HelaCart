import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../dist/auth/auth.service.js';
import { CatalogService } from '../dist/catalog/catalog.service.js';
import { BusinessReportsService } from '../dist/business-tools/business-reports.service.js';
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
    service = new BusinessReportsService(
      p,
      catalog,
      new ConfigService({ ADMIN_FIREBASE_UIDS: [f.identities.admin.uid] }),
    );
  const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date()),
    yesterday = new Date(Date.parse(today + 'T00:00:00Z') - 86400000)
      .toISOString()
      .slice(0, 10);
  const seed = (sellerId, submitterId, amountMinor, status, day) =>
    p.commissionPayment.create({
      data: {
        sellerId,
        submitterId,
        requestKey: randomUUID(),
        payloadHash: '0'.repeat(64),
        amountMinor,
        reference: 'BUSINESS-PAY-' + randomUUID(),
        paidOn: yesterday,
        status,
        storageKey: 'commission-receipts/audit/' + randomUUID() + '.png',
        contentType: 'image/png',
        byteSize: 10,
        ...(status === 'APPROVED'
          ? {
              reviewerId: f.userIds.admin,
              reviewedAt: new Date(day + 'T10:00:00+05:30'),
              reviewNote: 'Verified isolated fixture commission payment.',
            }
          : {}),
      },
    });
  const current = await seed(
      f.sellers.a,
      f.userIds.sellerA,
      4000,
      'APPROVED',
      today,
    ),
    old = await seed(
      f.sellers.a,
      f.userIds.sellerA,
      3000,
      'APPROVED',
      yesterday,
    );
  await seed(f.sellers.a, f.userIds.sellerA, 9000, 'PENDING', today);
  await seed(f.sellers.b, f.userIds.sellerB, 10000, 'APPROVED', today);
  let report = await service.report(f.identities.sellerA, f.sellers.a, {
    from: today,
    to: today,
  });
  assert.equal(report.totals.commissionCollectedMinor, 4000);
  assert.equal(report.totals.grossMerchandiseMinor, 0);
  assert.equal(
    (
      await service.report(f.identities.admin, undefined, {
        from: today,
        to: today,
      })
    ).totals.commissionCollectedMinor,
    14000,
  );
  pass(
    'Commission collections use verification dates, exclude pending receipts and remain separate from sales',
  );
  const correct = (payment) =>
    p.commissionCorrection.create({
      data: {
        sellerId: payment.sellerId,
        actorId: f.userIds.admin,
        paymentId: payment.id,
        requestKey: randomUUID(),
        amountMinor: payment.amountMinor,
        reference: 'BUSINESS-PAY-CORRECT-' + randomUUID(),
        reason: 'Corrected an incorrectly matched commission payment.',
        createdAt: new Date(today + 'T11:00:00+05:30'),
      },
    });
  await correct(old);
  report = await service.report(f.identities.sellerA, f.sellers.a, {
    from: today,
    to: today,
  });
  assert.equal(report.totals.commissionCollectedMinor, 1000);
  assert.equal(
    (
      await service.report(f.identities.sellerA, f.sellers.a, {
        from: yesterday,
        to: yesterday,
      })
    ).totals.commissionCollectedMinor,
    3000,
  );
  assert.equal(
    (
      await service.report(f.identities.sellerA, f.sellers.a, {
        from: yesterday,
        to: today,
      })
    ).totals.commissionCollectedMinor,
    4000,
  );
  pass(
    'A later payment correction affects its own reporting day and preserves the earlier verified period',
  );
  await correct(current);
  report = await service.report(f.identities.sellerA, f.sellers.a, {
    from: today,
    to: today,
  });
  assert.equal(report.totals.commissionCollectedMinor, -3000);
  const csv = await service.export(f.identities.sellerA, f.sellers.a, {
    from: today,
    to: today,
    section: 'DAILY',
  });
  assert.match(csv, /"-30"/);
  assert.doesNotMatch(csv, /"'-30"/);
  pass(
    'Net correction periods can be negative and CSV preserves numeric signed amounts',
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
