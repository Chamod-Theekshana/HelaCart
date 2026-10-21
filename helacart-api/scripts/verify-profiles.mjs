import 'reflect-metadata';
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../dist/prisma/prisma.service.js';
import { AuthService } from '../dist/auth/auth.service.js';
import { ProfilePhotosService } from '../dist/auth/profile-photos.service.js';
import { ProfilePhotoStorageService } from '../dist/auth/profile-photo-storage.service.js';
import { CatalogService } from '../dist/catalog/catalog.service.js';
import { ShopsService } from '../dist/shops/shops.service.js';

// Use only temporary identities. Database changes always roll back; private R2
// objects are tracked separately and removed even when an assertion fails.
const config = new ConfigService(process.env);
const prisma = new PrismaService(config);
const storage = new ProfilePhotoStorageService(config);
const stored = [];
const trackedStorage = new Proxy(storage, {
  get(target, key) {
    if (key === 'upload') return async (...args) => {
      const photo = await target.upload(...args); stored.push(photo); return photo;
    };
    const value = Reflect.get(target, key);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});
const prefix = `profile-audit-${randomUUID()}`;
const rollback = new Error('PROFILE_AUDIT_ROLLBACK');
let checks = 0;
const pass = (name) => { checks++; console.log('PASS ' + name); };
const identity = { uid: prefix, email: `${prefix}@example.com`, email_verified: true, name: 'Original login name' };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=', 'base64');
const file = { buffer: png, size: png.length, mimetype: 'image/png' };
await prisma.$connect();
try {
  await prisma.$transaction(async (tx) => {
    const auth = new AuthService(tx);
    const photos = new ProfilePhotosService(tx, auth, trackedStorage);
    const catalog = new CatalogService(tx, auth);
    const shops = new ShopsService(tx, catalog);
    const initial = await auth.getOrCreateProfile(identity);
    assert.equal(initial.name, identity.name);
    assert.equal(initial.hasPhoto, false);
    pass('New account profile defaults');
    const edited = await auth.updateProfile(identity, { name: 'Edited profile name', phone: '+94 77 123 4567' });
    assert.equal(edited.name, 'Edited profile name'); assert.equal(edited.phone, '+94 77 123 4567');
    const reread = await auth.getOrCreateProfile(identity);
    assert.equal(reread.name, 'Edited profile name');
    assert.ok(!Object.hasOwn(reread, 'avatarStorageKey'));
    pass('Saved name survives stale login claims and reads stay private');
    await auth.updateProfile(identity, { phone: '' });
    assert.equal((await auth.getOrCreateProfile(identity)).phone, null);
    pass('Optional phone can be cleared');
    await photos.upload(identity, file);
    assert.equal((await auth.getOrCreateProfile(identity)).hasPhoto, true);
    assert.deepEqual((await photos.read(identity)).bytes, png);
    pass('Real private R2 photo upload and authenticated service read');
    await photos.upload(identity, file);
    assert.equal((await auth.getOrCreateProfile(identity)).photoVersion, 2);
    await assert.rejects(() => storage.read(stored[0]));
    pass('Replacing a profile photo deletes the old R2 object');
    const other = { ...identity, uid: prefix + '-other', email: `${prefix}-other@example.com` };
    await assert.rejects(() => photos.read(other), { status: 404 });
    pass('Another identity cannot read this profile photo');
    await photos.remove(identity);
    assert.equal((await auth.getOrCreateProfile(identity)).hasPhoto, false);
    await assert.rejects(() => photos.read(identity), { status: 404 });
    await assert.rejects(() => storage.read(stored[1]));
    pass('Removing a photo clears metadata and private R2 object');
    const seller = await tx.seller.create({ data: { name: 'Temporary audit shop', slug: prefix, status: 'APPROVED', members: { create: { userId: initial.id, role: 'OWNER' } } } });
    const business = await shops.updateBusiness(seller.id, identity, { contactPhone: '0771234567', pickupAddress: 'Temporary pickup address, Kandy' });
    assert.equal(business.contactPhone, '0771234567');
    assert.equal((await shops.privateProfile(seller.id, identity)).pickupAddress, 'Temporary pickup address, Kandy');
    const publicShop = await shops.profile(prefix);
    for (const field of ['contactPhone', 'pickupAddress', 'documents', 'identityDocumentType']) assert.ok(!Object.hasOwn(publicShop, field));
    pass('Private business edits persist without exposing them on the public shop');
    await assert.rejects(() => shops.updateBusiness(seller.id, other, { contactPhone: '0771234567', pickupAddress: 'Unauthorized pickup address' }), { status: 403 });
    pass('Foreign shop edits are refused on the real database');
    throw rollback;
  }, { timeout: 120000, maxWait: 15000 }).catch((error) => { if (error !== rollback) throw error; });
  assert.equal(await prisma.user.count({ where: { firebaseUid: { startsWith: prefix } } }), 0);
  assert.equal(await prisma.seller.count({ where: { slug: prefix } }), 0);
  pass('All temporary database records rolled back');
} finally {
  const cleanup = await Promise.allSettled(stored.map((photo) => storage.remove(photo.storageKey)));
  await prisma.$disconnect();
  assert.equal(cleanup.filter((result) => result.status === 'rejected').length, 0, 'Private R2 cleanup must succeed');
}
console.log(JSON.stringify({ checks, rolledBack: true, temporaryPhotosRemoved: stored.length }));
