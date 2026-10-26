import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../dist/auth/auth.service.js';
import { CatalogService } from '../dist/catalog/catalog.service.js';
import { AccountAccessService } from '../dist/auth/account-access.service.js';
import { AccountPermissionsService } from '../dist/account-permissions/account-permissions.service.js';
import { ProductFeedbackService } from '../dist/product-feedback/product-feedback.service.js';
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
    }),
    permissions = new AccountPermissionsService(p, auth, config),
    access = new AccountAccessService(p),
    reviews = new ProductFeedbackService(p, auth, catalog);
  const q = { page: 1, limit: 10, sort: 'newest' };
  const seedPurchase = async (
    identityRole = 'buyer',
    variantIndex = 0,
    status = 'DELIVERED',
  ) => {
    const item = {
      variantId: f.variants[variantIndex],
      productTitle: 'Purchased product snapshot',
      sku: 'AUDIT-' + variantIndex,
      optionValues: { Size: 'Medium' },
      unitLkrMinor: 20000,
      quantity: 1,
      lineLkrMinor: 20000,
    };
    return p.order.create({
      data: {
        buyerId: f.userIds[identityRole],
        addressId: f.addresses[identityRole] ?? f.addresses.buyer,
        checkoutKey: randomUUID(),
        snapshotHash: 'package4-audit',
        recipient: 'Audit buyer',
        phone: '0771234567',
        line1: '12 Audit Road',
        city: 'Kandy',
        district: 'Kandy',
        postalCode: '20000',
        subtotalLkrMinor: 20000,
        shippingLkrMinor: 35000,
        totalLkrMinor: 55000,
        sellerOrders: {
          create: {
            sellerId: variantIndex < 2 ? f.sellers.a : f.sellers.b,
            status,
            subtotalLkrMinor: 20000,
            shippingLkrMinor: 35000,
            totalLkrMinor: 55000,
            ...(status === 'DELIVERED'
              ? { paymentCollectedAt: new Date() }
              : {}),
            items: { create: item },
          },
        },
      },
      include: { sellerOrders: { include: { items: true } } },
    });
  };
  const order = await seedPurchase(),
    item = order.sellerOrders[0].items[0];
  await seedPurchase('buyerTwo', 1, 'SHIPPED');
  assert.equal(
    (await reviews.access(f.products[0], f.identities.buyer)).eligible,
    true,
  );
  assert.equal(
    (await reviews.access(f.products[0], f.identities.buyerTwo)).eligible,
    false,
  );
  assert.equal(
    (await reviews.access(f.products[1], f.identities.buyerTwo)).eligible,
    false,
  );
  await assert.rejects(
    () =>
      reviews.save(f.products[0], f.identities.buyerTwo, {
        version: 0,
        rating: 5,
        comment: 'Not a verified delivered purchase.',
      }),
    { status: 403 },
  );
  await assert.rejects(
    () =>
      reviews.save(f.products[1], f.identities.buyerTwo, {
        version: 0,
        rating: 5,
        comment: 'The order has not yet been delivered.',
      }),
    { status: 403 },
  );
  await assert.rejects(
    () =>
      reviews.access(f.products[0], {
        ...f.identities.buyer,
        email_verified: false,
      }),
    { status: 403 },
  );
  pass(
    'Review eligibility requires a verified buyer and that exact product in their delivered order',
  );
  await reviews.save(f.products[0], f.identities.buyer, {
    version: 0,
    rating: 4,
    comment: 'Good quality cotton and a comfortable fit.',
  });
  const mine = (await reviews.access(f.products[0], f.identities.buyer)).review;
  assert.equal(mine.version, 1);
  assert.equal(mine.variantLabel, 'Medium');
  const publicReviews = await reviews.list(f.products[0], q);
  assert.equal(publicReviews.summary.total, 1);
  assert.equal(publicReviews.summary.average, 4);
  for (const key of [
    'buyerId',
    'orderItemId',
    'email',
    'version',
    'replyUserId',
  ])
    assert.equal(key in publicReviews.items[0], false);
  assert.equal(
    (await p.customerProductReview.findUnique({ where: { id: mine.id } }))
      .orderItemId,
    item.id,
  );
  pass(
    'Published feedback uses purchased variant snapshots and excludes private buyer and order identifiers',
  );
  await assert.rejects(
    () =>
      reviews.save(f.products[0], f.identities.buyer, {
        version: 0,
        rating: 5,
        comment: 'Attempting an outdated second review.',
      }),
    { status: 409 },
  );
  await reviews.save(f.products[0], f.identities.buyer, {
    version: 1,
    rating: 5,
    comment: 'Updated after using this product for a week.',
  });
  assert.equal(
    await p.customerProductReview.count({
      where: { productId: f.products[0], buyerId: f.userIds.buyer },
    }),
    1,
  );
  await assert.rejects(
    () => reviews.remove(f.products[0], f.identities.buyerTwo, { version: 2 }),
    { status: 409 },
  );
  assert.equal((await reviews.list(f.products[0], q)).summary.average, 5);
  pass(
    'One review per buyer/product supports safe edits and rejects stale or foreign deletion',
  );
  const outcomes = await Promise.allSettled([
    reviews.save(f.products[0], f.identities.buyer, {
      version: 2,
      rating: 3,
      comment: 'Concurrent edit from the first browser.',
    }),
    reviews.save(f.products[0], f.identities.buyer, {
      version: 2,
      rating: 4,
      comment: 'Concurrent edit from another browser.',
    }),
  ]);
  assert.equal(outcomes.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal(
    outcomes.find((x) => x.status === 'rejected').reason.status,
    409,
  );
  pass('Concurrent buyer edits cannot silently overwrite each other');
  await assert.rejects(
    () =>
      reviews.reply(f.sellers.b, mine.id, f.identities.sellerB, {
        version: 3,
        reply: 'Reply from a different shop.',
      }),
    { status: 409 },
  );
  await assert.rejects(
    () => reviews.sellerList(f.sellers.a, f.identities.sellerB, q),
    { status: 403 },
  );
  await reviews.reply(f.sellers.a, mine.id, f.identities.sellerA, {
    version: 3,
    reply: 'Thank you for sharing your experience.',
  });
  assert.equal(
    (await reviews.list(f.products[0], q)).items[0].reply,
    'Thank you for sharing your experience.',
  );
  await assert.rejects(
    () =>
      reviews.save(f.products[0], f.identities.buyer, {
        version: 3,
        rating: 5,
        comment: 'Stale buyer edit after a seller reply.',
      }),
    { status: 409 },
  );
  await reviews.reply(f.sellers.a, mine.id, f.identities.sellerA, {
    version: 4,
    reply: '',
  });
  assert.equal((await reviews.list(f.products[0], q)).items[0].reply, null);
  pass(
    'Only the matching shop can reply or remove its reply, with review version checks',
  );
  await reviews.remove(f.products[0], f.identities.buyer, { version: 5 });
  assert.equal((await reviews.list(f.products[0], q)).summary.total, 0);
  await reviews.save(f.products[0], f.identities.buyer, {
    version: 6,
    rating: 4,
    comment: 'Rewritten review after reconsidering my experience.',
  });
  assert.equal(
    (await reviews.access(f.products[0], f.identities.buyer)).review.id,
    mine.id,
  );
  pass(
    'Soft deletion removes ratings and rewriting retains the original verified purchase',
  );
  await reviews.report(f.products[0], mine.id, f.identities.other, {
    reason: 'Please review this feedback for personal information.',
  });
  await assert.rejects(
    () =>
      reviews.report(f.products[0], mine.id, f.identities.other, {
        reason: 'Repeated report for the same buyer feedback.',
      }),
    { status: 409 },
  );
  await assert.rejects(
    () =>
      reviews.report(f.products[0], mine.id, f.identities.buyer, {
        reason: 'Reporting my own buyer feedback is not allowed.',
      }),
    { status: 403 },
  );
  const report = (await reviews.reports({ ...q, status: 'OPEN' })).items[0];
  await reviews.save(f.products[0], f.identities.buyer, {
    version: 7,
    rating: 5,
    comment: 'Buyer edited feedback after it was reported.',
  });
  assert.equal(
    (await reviews.reports({ ...q, status: 'OPEN' })).items[0].commentSnapshot,
    'Rewritten review after reconsidering my experience.',
  );
  await reviews.moderate(report.id, f.identities.admin, {
    action: 'HIDE',
    note: 'Reviewed and removed personal information from publication.',
  });
  assert.equal((await reviews.list(f.products[0], q)).summary.total, 0);
  await assert.rejects(
    () =>
      reviews.moderate(report.id, f.identities.admin, {
        action: 'DISMISS',
        note: 'Attempting a second decision on a closed report.',
      }),
    { status: 409 },
  );
  await assert.rejects(
    () =>
      reviews.save(f.products[0], f.identities.buyer, {
        version: 9,
        rating: 5,
        comment: 'Attempt to restore a moderated product review.',
      }),
    { status: 403 },
  );
  assert.equal(
    (await reviews.access(f.products[0], f.identities.buyer)).eligible,
    false,
  );
  pass(
    'Reports retain immutable snapshots; admin hiding removes ratings and cannot be undone by a buyer',
  );
  await p.product.update({
    where: { id: f.products[0] },
    data: { status: 'HIDDEN' },
  });
  await assert.rejects(() => reviews.list(f.products[0], q), { status: 404 });
  await p.product.update({
    where: { id: f.products[0] },
    data: { status: 'APPROVED' },
  });
  await p.seller.update({
    where: { id: f.sellers.a },
    data: { status: 'SUSPENDED' },
  });
  await assert.rejects(() => reviews.list(f.products[0], q), { status: 404 });
  await p.seller.update({
    where: { id: f.sellers.a },
    data: { status: 'APPROVED' },
  });
  pass('Feedback does not expose hidden listings or suspended shops publicly');
  const details = {
    brand: 'Audit maker',
    warranty: 'Six months for manufacturing defects.',
    specifications: [
      { name: 'Material', value: 'Cotton' },
      { name: 'Care', value: 'Hand wash' },
    ],
  };
  const edited = await catalog.editProduct(
    f.sellers.a,
    f.products[0],
    f.identities.sellerA,
    details,
  );
  assert.equal(edited.status, 'DRAFT');
  assert.deepEqual(edited.specifications, details.specifications);
  await assert.rejects(() => catalog.publicProduct(f.products[0]), {
    status: 404,
  });
  await catalog
    .submitProduct(f.sellers.a, f.products[0], f.identities.sellerA)
    .then(() => assert.fail('Empty-image audit listing must not be approved'))
    .catch((error) => assert.equal(error.status, 400));
  await p.product.update({
    where: { id: f.products[0] },
    data: { status: 'APPROVED' },
  });
  const detail = await catalog.publicProduct(f.products[0]);
  assert.equal(detail.brand, details.brand);
  assert.equal(detail.warranty, details.warranty);
  assert.deepEqual(detail.specifications, details.specifications);
  pass(
    'Structured details persist and editing them requires the existing listing approval flow',
  );
  await assert.rejects(
    () => permissions.team(f.sellers.a, f.identities.sellerB),
    { status: 403 },
  );
  await assert.rejects(
    () =>
      permissions.add(f.sellers.a, f.identities.buyerTwo, {
        email: f.identities.other.email,
        reason: 'Trying to add a manager to someone else’s shop.',
      }),
    { status: 403 },
  );
  await permissions.add(f.sellers.a, f.identities.sellerA, {
    email: f.identities.other.email.toUpperCase(),
    reason: 'Helping with daily stock and order handling.',
  });
  const team = await permissions.team(f.sellers.a, f.identities.sellerA),
    manager = team.members.find((m) => m.user.id === f.userIds.other),
    owner = team.members.find((m) => m.role === 'OWNER');
  assert.equal(manager.role, 'MANAGER');
  await catalog.sellerProduct(f.sellers.a, f.products[0], f.identities.other);
  await assert.rejects(
    () => permissions.team(f.sellers.a, f.identities.other),
    { status: 403 },
  );
  await assert.rejects(
    () =>
      permissions.add(f.sellers.a, f.identities.other, {
        email: f.identities.buyerTwo.email,
        reason: 'Managers cannot add their own colleagues.',
      }),
    { status: 403 },
  );
  await assert.rejects(
    () =>
      permissions.remove(f.sellers.a, owner.id, f.identities.sellerA, {
        reason: 'Owner must remain assigned to this shop.',
      }),
    { status: 403 },
  );
  pass(
    'Only the shop owner grants manager access; managers cannot inspect team identities or remove owners',
  );
  await seedPurchase('other');
  await assert.rejects(
    () =>
      reviews.save(f.products[0], f.identities.other, {
        version: 0,
        rating: 5,
        comment: 'Manager reviewing an item from their own shop.',
      }),
    { status: 403 },
  );
  assert.equal(
    (await reviews.access(f.products[0], f.identities.other)).eligible,
    false,
  );
  pass(
    'Delivered purchases do not allow shop staff to review their own products',
  );
  await permissions.remove(f.sellers.a, manager.id, f.identities.sellerA, {
    reason: 'Manager no longer works with this shop.',
  });
  await assert.rejects(
    () => catalog.sellerProduct(f.sellers.a, f.products[0], f.identities.other),
    { status: 403 },
  );
  assert.equal(
    (await permissions.team(f.sellers.a, f.identities.sellerA)).history.length,
    2,
  );
  await access.assertActive(f.identities.other.uid);
  pass(
    'Removing a manager immediately revokes shop access while preserving their buyer account and audit history',
  );
  await assert.rejects(
    () =>
      permissions.decide(f.userIds.admin, f.identities.admin, {
        version: 0,
        status: 'SUSPENDED',
        reason: 'An admin cannot accidentally lock themselves out.',
      }),
    { status: 403 },
  );
  await assert.rejects(
    () =>
      permissions.decide(f.userIds.other, f.identities.buyer, {
        version: 0,
        status: 'SUSPENDED',
        reason: 'A buyer must not control account access.',
      }),
    { status: 403 },
  );
  await permissions.decide(f.userIds.other, f.identities.admin, {
    version: 0,
    status: 'SUSPENDED',
    reason: 'Access restricted while an abuse complaint is reviewed.',
  });
  await assert.rejects(() => access.assertActive(f.identities.other.uid), {
    status: 403,
  });
  await assert.rejects(() => auth.getOrCreateProfile(f.identities.other), {
    status: 403,
  });
  await assert.rejects(
    () =>
      permissions.add(f.sellers.a, f.identities.sellerA, {
        email: f.identities.other.email,
        reason: 'A suspended account cannot be given manager access.',
      }),
    { status: 400 },
  );
  await assert.rejects(
    () =>
      permissions.decide(f.userIds.other, f.identities.admin, {
        version: 0,
        status: 'ACTIVE',
        reason: 'Stale access decisions must be refused.',
      }),
    { status: 409 },
  );
  await permissions.decide(f.userIds.other, f.identities.admin, {
    version: 1,
    status: 'ACTIVE',
    reason: 'Complaint resolved and account access restored.',
  });
  await access.assertActive(f.identities.other.uid);
  const listed = await permissions.accounts({
    page: 1,
    limit: 20,
    q: f.identities.other.email,
  });
  assert.equal(listed.total, 1);
  assert.equal(listed.items[0].accessChanges.length, 2);
  assert.equal('firebaseUid' in listed.items[0], false);
  pass(
    'Admin suspension and restoration enforce versions, preserve history and protect owner/admin access',
  );
  const rejectDb = async (promise) => assert.rejects(promise);
  await rejectDb(
    p.customerProductReview.create({
      data: {
        productId: f.products[2],
        buyerId: f.userIds.buyerTwo,
        orderItemId: item.id,
        buyerName: 'Wrong purchase',
        rating: 5,
        comment: 'Invalid verified purchase from a different product.',
        variantLabel: 'Standard',
      },
    }),
  );
  await rejectDb(
    p.customerProductReview.update({
      where: { id: mine.id },
      data: { isHidden: false, version: { increment: 1 } },
    }),
  );
  await rejectDb(
    p.customerProductReviewReport.update({
      where: { id: report.id },
      data: {
        commentSnapshot: 'Attempt to change the reported text snapshot.',
      },
    }),
  );
  await rejectDb(
    p.accountAccessChange.updateMany({
      where: { userId: f.userIds.other },
      data: { reason: 'Attempt to rewrite the account audit history.' },
    }),
  );
  await rejectDb(
    p.sellerTeamChange.deleteMany({ where: { sellerId: f.sellers.a } }),
  );
  pass(
    'Database constraints prevent forged verified purchases, unhidden moderated reviews and rewritten access history',
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
