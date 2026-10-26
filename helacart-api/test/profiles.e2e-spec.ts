import { AccountAccessService } from '../src/auth/account-access.service.js';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { FirebaseAdminService } from '../src/auth/firebase-admin.service.js';
import { ProfilePhotoStorageService } from '../src/auth/profile-photo-storage.service.js';
import { configureApp } from '../src/configure-app.js';

describe('Private account and shop profiles', () => {
  let app: INestApplication<Server>;
  const userId = '5720886d-9210-461c-9e93-d0176b019eed';
  const sellerId = 'c68e7c7c-7ad8-40b8-b2a1-a76c9a7b931c';
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]);
  const oldKey = `profile-photos/${userId}/old.png`;
  const newKey = `profile-photos/${userId}/new.png`;
  let profile: {
    name: string;
    phone: string | null;
    avatarContentType: string | null;
    photoVersion: number;
  };
  const db = {
    user: {
      upsert: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
    },
    sellerMember: { findUnique: vi.fn() },
    seller: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  };
  const firebase = { verifyIdToken: vi.fn() };
  const storage = {
    validate: new ProfilePhotoStorageService({} as never).validate,
    upload: vi.fn(),
    remove: vi.fn(),
    read: vi.fn(),
  };
  const publicShop = {
    id: sellerId,
    name: 'Island Crafts',
    slug: 'island-crafts',
    description: 'Local goods',
    publicLocation: 'Kandy',
    logoUrl: null,
    coverUrl: null,
    createdAt: '2026-10-21T00:00:00Z',
    shippingFeeLkrMinor: 35000,
  };
  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .overrideProvider(AccountAccessService)
      .useValue({ assertActive: async () => {} })
      .overrideProvider(FirebaseAdminService)
      .useValue(firebase)
      .overrideProvider(ProfilePhotoStorageService)
      .useValue(storage)
      .compile();
    app = fixture.createNestApplication();
    configureApp(app);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    vi.resetAllMocks();
    profile = {
      name: 'Saved buyer name',
      phone: '+94 77 123 4567',
      avatarContentType: null,
      photoVersion: 0,
    };
    firebase.verifyIdToken.mockImplementation((token: string) =>
      Promise.resolve({
        uid: token,
        email: `${token}@example.com`,
        email_verified: token !== 'unverified',
        name: 'Outdated login name',
      }),
    );
    db.user.upsert.mockImplementation(() =>
      Promise.resolve({
        id: userId,
        firebaseUid: 'buyer',
        email: 'buyer@example.com',
        emailVerified: true,
        ...profile,
        memberships: [],
      }),
    );
    db.user.update.mockImplementation(
      ({ data }: { data: Partial<typeof profile> }) => {
        Object.assign(profile, data);
        return db.user.upsert();
      },
    );
    db.user.findUniqueOrThrow.mockResolvedValue({
      id: userId,
      avatarStorageKey: oldKey,
      avatarContentType: 'image/png',
      avatarByteSize: png.length,
    });
    db.user.updateMany.mockImplementation(
      ({ data }: { data: { avatarContentType: string | null } }) => {
        profile.avatarContentType = data.avatarContentType;
        profile.photoVersion++;
        return Promise.resolve({ count: 1 });
      },
    );
    db.sellerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      seller: { status: 'APPROVED' },
    });
    db.seller.findUniqueOrThrow.mockResolvedValue({
      ...publicShop,
      status: 'APPROVED',
      contactPhone: '+94 77 123 4567',
      pickupAddress: '12 Temple Road, Kandy',
      identityDocumentType: 'NATIONAL_ID',
      documents: [
        { kind: 'IDENTITY_FRONT', contentType: 'image/png', byteSize: 100 },
      ],
    });
    db.seller.update.mockResolvedValue({
      ...publicShop,
      contactPhone: '0771234567',
      pickupAddress: 'Updated pickup address, Kandy',
    });
    storage.upload.mockResolvedValue({
      storageKey: newKey,
      contentType: 'image/png',
      byteSize: png.length,
    });
    storage.remove.mockResolvedValue(undefined);
    storage.read.mockResolvedValue({ bytes: png, contentType: 'image/png' });
  });
  const endpoint = '/api/v1/auth/me';
  it('requires authentication for every profile/photo route', async () => {
    await request(app.getHttpServer()).get(endpoint).expect(401);
    await request(app.getHttpServer())
      .patch(endpoint)
      .send({ name: 'Buyer' })
      .expect(401);
    await request(app.getHttpServer())
      .post(endpoint + '/photo')
      .expect(401);
    await request(app.getHttpServer())
      .get(endpoint + '/photo')
      .expect(401);
    await request(app.getHttpServer())
      .delete(endpoint + '/photo')
      .expect(401);
    expect(db.user.upsert).not.toHaveBeenCalled();
  });
  it('allows reading an unverified account but refuses edits and photos', async () => {
    await request(app.getHttpServer())
      .get(endpoint)
      .auth('unverified', { type: 'bearer' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(endpoint)
      .auth('unverified', { type: 'bearer' })
      .send({ name: 'Buyer' })
      .expect(403);
    await request(app.getHttpServer())
      .post(endpoint + '/photo')
      .auth('unverified', { type: 'bearer' })
      .attach('photo', png, { filename: 'photo.png', contentType: 'image/png' })
      .expect(403);
    await request(app.getHttpServer())
      .delete(endpoint + '/photo')
      .auth('unverified', { type: 'bearer' })
      .expect(403);
    expect(db.user.update).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
  });
  it('keeps the saved profile name when a stale Firebase token is read', async () => {
    const response = await request(app.getHttpServer())
      .get(endpoint)
      .auth('buyer', { type: 'bearer' })
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(response.body.name).toBe('Saved buyer name');
    expect(firebase.verifyIdToken).toHaveBeenCalledTimes(1);
    expect(response.body).not.toHaveProperty('avatarContentType');
    expect(response.body).not.toHaveProperty('avatarStorageKey');
    expect(db.user.upsert.mock.calls[0][0].update).not.toHaveProperty('name');
    expect(db.user.upsert.mock.calls[0][0].create.name).toBe(
      'Outdated login name',
    );
  });
  it('saves only the token owner profile, trims values and clears an optional phone', async () => {
    const response = await request(app.getHttpServer())
      .patch(endpoint)
      .auth('buyer', { type: 'bearer' })
      .send({ name: '  New buyer name  ', phone: '  ' })
      .expect(200);
    expect(response.body).toMatchObject({
      name: 'New buyer name',
      phone: null,
    });
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: userId },
        data: { name: 'New buyer name', phone: null },
      }),
    );
  });
  it('rejects role/email injection, null values, blank names and invalid phone numbers', async () => {
    for (const body of [
      { name: 'Buyer', role: 'ADMIN' },
      { email: 'other@example.com' },
      { name: null },
      { name: ' ' },
      { phone: 'abcdefghi' },
    ])
      await request(app.getHttpServer())
        .patch(endpoint)
        .auth('buyer', { type: 'bearer' })
        .send(body)
        .expect(400);
    expect(db.user.update).not.toHaveBeenCalled();
  });
  it('rejects spoofed, missing and oversized profile photos before storage writes', async () => {
    await request(app.getHttpServer())
      .post(endpoint + '/photo')
      .auth('buyer', { type: 'bearer' })
      .attach('photo', Buffer.from('<svg/>'), {
        filename: 'fake.png',
        contentType: 'image/png',
      })
      .expect(400);
    await request(app.getHttpServer())
      .post(endpoint + '/photo')
      .auth('buyer', { type: 'bearer' })
      .expect(400);
    await request(app.getHttpServer())
      .post(endpoint + '/photo')
      .auth('buyer', { type: 'bearer' })
      .attach('photo', Buffer.alloc(3 * 1024 * 1024 + 1), {
        filename: 'large.png',
        contentType: 'image/png',
      })
      .expect(413);
    expect(storage.upload).not.toHaveBeenCalled();
  });
  it('replaces a photo, removes the old private object and returns no storage keys', async () => {
    const response = await request(app.getHttpServer())
      .post(endpoint + '/photo')
      .auth('buyer', { type: 'bearer' })
      .attach('photo', png, {
        filename: 'avatar.png',
        contentType: 'image/png',
      })
      .expect(201);
    expect(response.body).toMatchObject({ hasPhoto: true, photoVersion: 1 });
    expect(JSON.stringify(response.body)).not.toContain('profile-photos/');
    expect(storage.remove).toHaveBeenCalledWith(oldKey);
    expect(db.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: userId, avatarStorageKey: oldKey },
      }),
    );
  });
  it('cleans the new object after a concurrent replacement and keeps the other update', async () => {
    db.user.updateMany.mockResolvedValue({ count: 0 });
    await request(app.getHttpServer())
      .post(endpoint + '/photo')
      .auth('buyer', { type: 'bearer' })
      .attach('photo', png, {
        filename: 'avatar.png',
        contentType: 'image/png',
      })
      .expect(409);
    expect(storage.remove).toHaveBeenCalledWith(newKey);
    expect(storage.remove).not.toHaveBeenCalledWith(oldKey);
  });
  it('serves a photo through the authenticated owner route with private caching', async () => {
    await request(app.getHttpServer())
      .get(endpoint + '/photo')
      .auth('buyer', { type: 'bearer' })
      .expect(200)
      .expect('Content-Type', /image\/png/)
      .expect('Cache-Control', 'private, no-store');
    expect(db.user.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: userId } }),
    );
    db.user.findUniqueOrThrow.mockResolvedValue({
      id: userId,
      avatarStorageKey: null,
    });
    await request(app.getHttpServer())
      .get(endpoint + '/photo')
      .auth('another-buyer', { type: 'bearer' })
      .expect(404);
  });
  it('removes photo metadata and its private object', async () => {
    const response = await request(app.getHttpServer())
      .delete(endpoint + '/photo')
      .auth('buyer', { type: 'bearer' })
      .expect(200);
    expect(response.body.hasPhoto).toBe(false);
    expect(storage.remove).toHaveBeenCalledWith(oldKey);
    expect(db.user.updateMany.mock.calls[0][0].data).toMatchObject({
      avatarStorageKey: null,
      avatarContentType: null,
      avatarByteSize: null,
    });
  });
  it('returns private shop details only after membership checks with document metadata', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/sellers/${sellerId}/shop`)
      .auth('buyer', { type: 'bearer' })
      .expect(200);
    expect(response.body).toHaveProperty('pickupAddress');
    expect(
      db.seller.findUniqueOrThrow.mock.calls[0][0].select.documents.select,
    ).not.toHaveProperty('storageKey');
    db.sellerMember.findUnique.mockResolvedValue(null);
    db.seller.findUniqueOrThrow.mockClear();
    await request(app.getHttpServer())
      .get(`/api/v1/sellers/${sellerId}/shop`)
      .auth('outsider', { type: 'bearer' })
      .expect(403);
    expect(db.seller.findUniqueOrThrow).not.toHaveBeenCalled();
  });
  it('updates private business fields without changing public identity or verification', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/sellers/${sellerId}/shop/business`)
      .auth('buyer', { type: 'bearer' })
      .send({
        contactPhone: '0771234567',
        pickupAddress: 'Updated pickup address, Kandy',
      })
      .expect(200);
    expect(db.seller.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: sellerId, status: 'APPROVED' },
        data: {
          contactPhone: '0771234567',
          pickupAddress: 'Updated pickup address, Kandy',
        },
      }),
    );
    db.sellerMember.findUnique.mockResolvedValue(null);
    db.seller.update.mockClear();
    await request(app.getHttpServer())
      .patch(`/api/v1/sellers/${sellerId}/shop/business`)
      .auth('outsider', { type: 'bearer' })
      .send({
        contactPhone: '0771234567',
        pickupAddress: 'Updated pickup address, Kandy',
      })
      .expect(403);
    expect(db.seller.update).not.toHaveBeenCalled();
  });
});
