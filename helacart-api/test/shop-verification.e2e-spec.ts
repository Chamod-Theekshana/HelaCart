import { AccountAccessService } from '../src/auth/account-access.service.js';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { FirebaseAdminService } from '../src/auth/firebase-admin.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { configureApp } from '../src/configure-app.js';

describe('Admin shop verification boundaries', () => {
  let app: INestApplication<Server>;
  const sellerId = 'c68e7c7c-7ad8-40b8-b2a1-a76c9a7b931c';
  const reviewerId = '5720886d-9210-461c-9e93-d0176b019eed';
  const endpoint = `/api/v1/admin/seller-applications/${sellerId}/verification`;
  const body = {
    isVerified: true,
    expectedVersion: 0,
    reason: 'Reviewed front and back identity photos.',
  };
  const database = {
    user: { upsert: vi.fn() },
    seller: {
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    sellerVerification: { create: vi.fn() },
    sellerReview: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  const firebase = { verifyIdToken: vi.fn() };
  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(database)
      .overrideProvider(AccountAccessService)
      .useValue({ assertActive: async () => {} })
      .overrideProvider(FirebaseAdminService)
      .useValue(firebase)
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
    firebase.verifyIdToken.mockImplementation(
      (token: string, revoked?: boolean) => {
        if (token === 'revoked' && revoked)
          return Promise.reject(new Error('Revoked'));
        return Promise.resolve({
          uid: token,
          email: `${token}@example.com`,
          email_verified: token !== 'unverified',
        });
      },
    );
    database.user.upsert.mockResolvedValue({ id: reviewerId });
    database.seller.updateMany.mockResolvedValue({ count: 1 });
    database.seller.findUnique.mockResolvedValue({ id: sellerId });
    database.seller.findUniqueOrThrow.mockResolvedValue({
      isVerified: true,
      verificationVersion: 1,
      verificationHistory: [],
    });
    database.$transaction.mockImplementation(
      (callback: (tx: typeof database) => unknown) => callback(database),
    );
  });
  it('requires authentication', async () => {
    await request(app.getHttpServer()).patch(endpoint).send(body).expect(401);
    expect(database.seller.updateMany).not.toHaveBeenCalled();
  });
  it.each(['buyer-uid', 'seller-uid', 'unverified'])(
    'rejects %s',
    async (token) => {
      await request(app.getHttpServer())
        .patch(endpoint)
        .auth(token, { type: 'bearer' })
        .send(body)
        .expect(403);
      expect(database.seller.updateMany).not.toHaveBeenCalled();
    },
  );
  it('checks token revocation for admin decisions', async () => {
    await request(app.getHttpServer())
      .patch(endpoint)
      .auth('revoked', { type: 'bearer' })
      .send(body)
      .expect(401);
  });
  it.each([
    { ...body, isVerified: 'true' },
    { ...body, expectedVersion: -1 },
    { ...body, expectedVersion: 0.5 },
    { ...body, reason: '          ' },
    { ...body, reason: 'a'.repeat(501) },
    { ...body, reviewerUserId: 'forged' },
  ])('rejects an invalid or forged decision %#', async (invalid) => {
    await request(app.getHttpServer())
      .patch(endpoint)
      .auth('admin-uid', { type: 'bearer' })
      .send(invalid)
      .expect(400);
    expect(database.seller.updateMany).not.toHaveBeenCalled();
  });
  it('awards verification with mandatory identity photos and a server-derived actor', async () => {
    const result = await request(app.getHttpServer())
      .patch(endpoint)
      .auth('admin-uid', { type: 'bearer' })
      .send(body)
      .expect(200);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(database.seller.updateMany).toHaveBeenCalledWith({
      where: {
        id: sellerId,
        isVerified: false,
        verificationVersion: 0,
        status: 'APPROVED',
        identityDocumentType: { not: null },
        AND: [
          { documents: { some: { kind: 'IDENTITY_FRONT' } } },
          { documents: { some: { kind: 'IDENTITY_BACK' } } },
        ],
      },
      data: {
        isVerified: true,
        verifiedAt: expect.any(Date),
        verificationVersion: { increment: 1 },
      },
    });
    expect(database.sellerVerification.create).toHaveBeenCalledWith({
      data: {
        sellerId,
        reviewerUserId: reviewerId,
        isVerified: true,
        version: 1,
        reason: body.reason,
        createdAt: expect.any(Date),
      },
    });
    expect(firebase.verifyIdToken).toHaveBeenCalledWith('admin-uid', true);
  });
  it('allows revocation even if the shop is no longer approved', async () => {
    await request(app.getHttpServer())
      .patch(endpoint)
      .auth('admin-uid', { type: 'bearer' })
      .send({ ...body, isVerified: false, expectedVersion: 3 })
      .expect(200);
    expect(database.seller.updateMany.mock.calls[0][0].where).toEqual({
      id: sellerId,
      isVerified: true,
      verificationVersion: 3,
    });
    expect(
      database.seller.updateMany.mock.calls[0][0].data.verifiedAt,
    ).toBeNull();
  });
  it('rejects stale, duplicate or ineligible decisions without appending history', async () => {
    database.seller.updateMany.mockResolvedValue({ count: 0 });
    await request(app.getHttpServer())
      .patch(endpoint)
      .auth('admin-uid', { type: 'bearer' })
      .send(body)
      .expect(409);
    expect(database.sellerVerification.create).not.toHaveBeenCalled();
  });
  it('returns not found for a missing shop', async () => {
    database.seller.updateMany.mockResolvedValue({ count: 0 });
    database.seller.findUnique.mockResolvedValue(null);
    await request(app.getHttpServer())
      .patch(endpoint)
      .auth('admin-uid', { type: 'bearer' })
      .send(body)
      .expect(404);
  });
  it('rejects verification fields in seller-controlled shop edits', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/sellers/${sellerId}/shop`)
      .auth('seller-uid', { type: 'bearer' })
      .send({ name: 'My shop', isVerified: true })
      .expect(400);
    expect(database.seller.updateMany).not.toHaveBeenCalled();
  });
  it('can approve and verify in the same transaction with separate audit decisions', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/seller-applications/${sellerId}/approve`)
      .auth('admin-uid', { type: 'bearer' })
      .send({ verifyShop: true, verificationReason: body.reason })
      .expect(200);
    expect(database.seller.updateMany.mock.calls[0][0]).toMatchObject({
      where: { status: 'PENDING', isVerified: false, verificationVersion: 0 },
      data: { status: 'APPROVED', isVerified: true, verificationVersion: 1 },
    });
    expect(database.sellerReview.create).toHaveBeenCalledOnce();
    expect(database.sellerVerification.create).toHaveBeenCalledWith({
      data: {
        sellerId,
        reviewerUserId: reviewerId,
        isVerified: true,
        version: 1,
        reason: body.reason,
        createdAt: expect.any(Date),
      },
    });
    expect(database.$transaction).toHaveBeenCalledOnce();
  });
  it('keeps ordinary approval unverified', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/seller-applications/${sellerId}/approve`)
      .auth('admin-uid', { type: 'bearer' })
      .expect(200);
    expect(database.seller.updateMany.mock.calls[0][0].data).toEqual({
      status: 'APPROVED',
    });
    expect(database.sellerVerification.create).not.toHaveBeenCalled();
  });
  it.each([
    { verifyShop: true },
    { verifyShop: true, verificationReason: '   ' },
    { verifyShop: 'true', verificationReason: body.reason },
  ])('validates optional verification at approval %#', async (invalid) => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/seller-applications/${sellerId}/approve`)
      .auth('admin-uid', { type: 'bearer' })
      .send(invalid)
      .expect(400);
    expect(database.seller.updateMany).not.toHaveBeenCalled();
  });
});
