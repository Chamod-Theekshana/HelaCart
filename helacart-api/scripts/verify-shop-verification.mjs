import 'reflect-metadata';
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../dist/prisma/prisma.service.js';
import { AuthService } from '../dist/auth/auth.service.js';
import { CatalogService } from '../dist/catalog/catalog.service.js';
import { ShopsService } from '../dist/shops/shops.service.js';
import { ShopVerificationService } from '../dist/sellers/shop-verification.service.js';
import { SellerApplicationsService } from '../dist/sellers/seller-applications.service.js';

// Temporary database fixtures only. No R2 files are uploaded and everything rolls back.
const prisma = new PrismaService(new ConfigService(process.env));
const prefix = `verification-audit-${randomUUID()}`;
const rollback = new Error('VERIFICATION_AUDIT_ROLLBACK');
let checks = 0;
const pass = (name) => { checks++; console.log('PASS ' + name); };
const identity = { uid: prefix, email: `${prefix}@example.com`, email_verified: true };
const reason = 'Identity front and back reviewed for this temporary audit.';
await prisma.$connect();
try {
  await prisma.$transaction(async (tx) => {
    const db = new Proxy(tx, { get(target, key) {
      if (key === '$transaction') return async (callback) => callback(tx);
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    const auth = new AuthService(db);
    const service = new ShopVerificationService(db, auth);
    const shops = new ShopsService(db, new CatalogService(db, auth));
    const shop = await tx.seller.create({ data: { name: prefix, slug: prefix, status: 'APPROVED' } });
    assert.equal(shop.isVerified, false); assert.equal(shop.verificationVersion, 0); assert.equal(shop.verifiedAt, null);
    pass('Approved shops default to unverified');
    const decide = (isVerified, expectedVersion) => service.update(shop.id, identity, { isVerified, expectedVersion, reason });
    await assert.rejects(() => decide(true, 0), { status: 409 });
    pass('Missing identity documents cannot be verified');
    await tx.seller.update({ where: { id: shop.id }, data: { identityDocumentType: 'DRIVING_LICENCE', documents: { create: { kind: 'IDENTITY_FRONT', storageKey: prefix + '/front', contentType: 'image/png', byteSize: 123 } } } });
    await assert.rejects(() => decide(true, 0), { status: 409 });
    pass('Identity back photo is mandatory');
    await tx.sellerApplicationDocument.create({ data: { sellerId: shop.id, kind: 'IDENTITY_BACK', storageKey: prefix + '/back', contentType: 'image/png', byteSize: 123 } });
    await tx.seller.update({ where: { id: shop.id }, data: { status: 'PENDING' } });
    await assert.rejects(() => decide(true, 0), { status: 409 });
    pass('Pending shops cannot receive a badge');
    await tx.seller.update({ where: { id: shop.id }, data: { status: 'APPROVED' } });
    const first = await decide(true, 0);
    assert.equal(first.isVerified, true); assert.equal(first.verificationVersion, 1); assert.ok(first.verifiedAt);
    assert.equal(first.verificationHistory[0].reviewer.email, identity.email);
    assert.equal(first.verificationHistory[0].reason, reason);
    pass('Admin verification succeeds with front/back and no business registration');
    await assert.rejects(() => decide(true, 0), { status: 409 });
    assert.equal(await tx.sellerVerification.count({ where: { sellerId: shop.id } }), 1);
    pass('Duplicate decisions do not add audit entries');
    const profile = await shops.profile(prefix);
    assert.equal(profile.isVerified, true);
    for (const key of ['verificationHistory', 'verificationVersion', 'verifiedAt', 'documents', 'identityDocumentType', 'contactPhone', 'pickupAddress']) assert.ok(!Object.hasOwn(profile, key));
    const directory = await shops.directory({ page: 1, limit: 12, q: prefix });
    assert.equal(directory.items[0].isVerified, true);
    pass('Public profile and cards receive the badge without private audit or documents');
    await tx.seller.update({ where: { id: shop.id }, data: { status: 'SUSPENDED' } });
    await assert.rejects(() => shops.profile(prefix), { status: 404 });
    assert.equal((await shops.directory({ page: 1, limit: 12, q: prefix })).items.length, 0);
    pass('Suspended verified shops remain absent publicly');
    const revoked = await decide(false, 1);
    assert.equal(revoked.isVerified, false); assert.equal(revoked.verifiedAt, null);
    pass('Admin can revoke a suspended shop');
    await tx.seller.update({ where: { id: shop.id }, data: { status: 'APPROVED' } });
    assert.equal((await shops.profile(prefix)).isVerified, false);
    await assert.rejects(() => decide(true, 0), { status: 409 });
    const second = await decide(true, 2);
    assert.equal(second.verificationVersion, 3); assert.equal(second.verificationHistory.length, 3);
    await assert.rejects(() => decide(false, 1), { status: 409 });
    pass('Version checks block old decisions even after revoke and reverify');
    const applications = new SellerApplicationsService(db, auth, {});
    const createPending = suffix => tx.seller.create({ data: {
      name: 'Temporary pending audit', slug: prefix + suffix, identityDocumentType: 'NATIONAL_ID',
      documents: { create: ['IDENTITY_FRONT', 'IDENTITY_BACK'].map(kind => ({ kind, storageKey: prefix + suffix + kind, contentType: 'image/png', byteSize: 123 })) },
    } });
    const pending = await createPending('-combined');
    const approved = await applications.review(pending.id, identity, 'APPROVED', undefined, { verifyShop: true, verificationReason: reason });
    assert.equal(approved.isVerified, true); assert.equal(approved.status, 'APPROVED');
    assert.equal(await tx.sellerVerification.count({ where: { sellerId: pending.id } }), 1);
    assert.equal(await tx.sellerReview.count({ where: { sellerId: pending.id } }), 1);
    pass('Combined approval and verification persist both audit decisions');
    const ordinary = await createPending('-ordinary');
    const plain = await applications.review(ordinary.id, identity, 'APPROVED');
    assert.equal(plain.isVerified, false);
    assert.equal(await tx.sellerVerification.count({ where: { sellerId: ordinary.id } }), 0);
    pass('Ordinary approval still does not award a badge');
    throw rollback;
  }, { timeout: 120000, maxWait: 15000 }).catch((error) => { if (error !== rollback) throw error; });
  assert.equal(await prisma.seller.count({ where: { slug: { startsWith: prefix } } }), 0);
  assert.equal(await prisma.user.count({ where: { firebaseUid: prefix } }), 0);
  pass('All temporary database fixtures rolled back');
} finally { await prisma.$disconnect(); }
console.log(JSON.stringify({ checks, rolledBack: true }));
