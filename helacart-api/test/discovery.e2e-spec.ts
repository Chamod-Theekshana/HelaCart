import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { FirebaseAdminService } from '../src/auth/firebase-admin.service.js';
import { AccountAccessService } from '../src/auth/account-access.service.js';
import { DiscoveryService } from '../src/discovery/discovery.service.js';
import { PromotionsService } from '../src/discovery/promotions.service.js';
import { FavoriteAlertsService } from '../src/discovery/favorite-alerts.service.js';
import { configureApp } from '../src/configure-app.js';
describe('Discovery, favorite alerts and promotion HTTP boundaries', () => {
  let app: INestApplication;
  const id = 'c68e7c7c-7ad8-40b8-b2a1-a76c9a7b931c';
  const discovery = { suggest: vi.fn(), recommendations: vi.fn() },
    promos = { list: vi.fn(), create: vi.fn(), decide: vi.fn() },
    alerts = { settings: vi.fn() };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(FirebaseAdminService)
      .useValue({
        verifyIdToken: async (token: string) => ({
          uid: token,
          email: token + '@example.com',
          email_verified: token !== 'unverified',
        }),
      })
      .overrideProvider(AccountAccessService)
      .useValue({ assertActive: async () => {} })
      .overrideProvider(DiscoveryService)
      .useValue(discovery)
      .overrideProvider(PromotionsService)
      .useValue(promos)
      .overrideProvider(FavoriteAlertsService)
      .useValue(alerts)
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  let time = Date.now();
  beforeEach(() => {
    vi.resetAllMocks();
    time += 61000;
    vi.spyOn(Date, 'now').mockReturnValue(time);
    for (const fn of [
      ...Object.values(discovery),
      ...Object.values(promos),
      ...Object.values(alerts),
    ])
      fn.mockResolvedValue({});
  });
  afterEach(() => vi.restoreAllMocks());
  it('allows public suggestions while validating bounded user text', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/discovery/suggestions?q=cotton')
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(discovery.suggest).toHaveBeenCalledWith('cotton');
    await request(app.getHttpServer())
      .get('/api/v1/discovery/suggestions?q=x')
      .expect(400);
  });
  it.each([
    '/api/v1/me/recommendations',
    `/api/v1/sellers/${id}/promotions`,
    '/api/v1/admin/promotions',
  ])('requires authentication %s', async (path) => {
    await request(app.getHttpServer()).get(path).expect(401);
  });
  it('keeps personalized recommendations tied to the verified token owner', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/me/recommendations?limit=4')
      .auth('buyer', { type: 'bearer' })
      .expect(200)
      .expect('Cache-Control', 'private, no-store');
    expect(discovery.recommendations).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 4 }),
      expect.objectContaining({ uid: 'buyer' }),
    );
    await request(app.getHttpServer())
      .get(`/api/v1/me/recommendations?userId=${id}`)
      .auth('buyer', { type: 'bearer' })
      .expect(400);
  });
  it.each(['limit=13', 'productId=bad', 'limit=-1'])(
    'rejects invalid recommendation input %s',
    async (q) => {
      await request(app.getHttpServer())
        .get('/api/v1/discovery/recommendations?' + q)
        .expect(400);
    },
  );
  const offer = {
    requestKey: id,
    productId: id,
    name: 'Weekend finds',
    discountBps: 1000,
    startsAt: '2026-11-01T00:00:00+05:30',
    endsAt: '2026-11-08T00:00:00+05:30',
  };
  it('submits seller offers with explicit seller scope', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/sellers/${id}/promotions`)
      .auth('seller', { type: 'bearer' })
      .send(offer)
      .expect(201);
    expect(promos.create).toHaveBeenCalledWith(
      id,
      expect.objectContaining({ uid: 'seller' }),
      expect.objectContaining(offer),
    );
  });
  it.each([
    { discountBps: 0 },
    { discountBps: 9001 },
    { discountBps: 1.5 },
    { sellerId: id },
    { status: 'APPROVED' },
    { version: 1 },
    { startsAt: 'bad' },
    { requestKey: 'bad' },
  ])('rejects forged promotion data %j', async (override) => {
    await request(app.getHttpServer())
      .post(`/api/v1/sellers/${id}/promotions`)
      .auth('seller', { type: 'bearer' })
      .send({ ...offer, ...override })
      .expect(400);
    expect(promos.create).not.toHaveBeenCalled();
  });
  it('keeps approval behind verified administrator guards and validates reasons', async () => {
    const path = `/api/v1/admin/promotions/${id}`,
      body = {
        version: 0,
        status: 'APPROVED',
        reason: 'Reviewed offer terms and product eligibility.',
      };
    await request(app.getHttpServer())
      .patch(path)
      .auth('seller', { type: 'bearer' })
      .send(body)
      .expect(403);
    await request(app.getHttpServer())
      .patch(path)
      .auth('unverified', { type: 'bearer' })
      .send(body)
      .expect(403);
    await request(app.getHttpServer())
      .patch(path)
      .auth('admin-uid', { type: 'bearer' })
      .send({ ...body, reason: 'short' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(path)
      .auth('admin-uid', { type: 'bearer' })
      .send(body)
      .expect(200);
    expect(promos.decide).toHaveBeenCalledWith(
      id,
      expect.objectContaining({ uid: 'admin-uid' }),
      undefined,
      expect.objectContaining(body),
    );
  });
  it.each([
    { priceAlerts: 'true' },
    { restockAlerts: 1 },
    { version: -1 },
    { userId: id },
    { observedPriceMinor: 1 },
  ])('rejects forged alert preferences %j', async (override) => {
    await request(app.getHttpServer())
      .patch(`/api/v1/me/favorites/${id}/alerts`)
      .auth('buyer', { type: 'bearer' })
      .send({ version: 0, priceAlerts: true, restockAlerts: true, ...override })
      .expect(400);
    expect(alerts.settings).not.toHaveBeenCalled();
  });
  it('binds favorite settings to request identity and version', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/me/favorites/${id}/alerts`)
      .auth('buyer', { type: 'bearer' })
      .send({ version: 2, priceAlerts: true, restockAlerts: false })
      .expect(200);
    expect(alerts.settings).toHaveBeenCalledWith(
      id,
      expect.objectContaining({ uid: 'buyer' }),
      expect.objectContaining({ version: 2, priceAlerts: true }),
    );
  });
});
