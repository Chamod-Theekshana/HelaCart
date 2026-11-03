import { AccountAccessService } from '../src/auth/account-access.service.js';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { FirebaseAdminService } from '../src/auth/firebase-admin.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { CommerceService } from '../src/commerce/commerce.service.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';
import { configureApp } from '../src/configure-app.js';
describe('Delivery and notification request boundaries', () => {
  let app: INestApplication;
  const id = 'c68e7c7c-7ad8-40b8-b2a1-a76c9a7b931c';
  const commerce = Object.fromEntries(
    [
      'cart',
      'deliverySettings',
      'setDeliverySettings',
      'updateShipment',
      'sellerStatus',
    ].map((k) => [k, vi.fn()]),
  );
  const notifications = Object.fromEntries(
    ['inbox', 'markAllRead'].map((k) => [k, vi.fn()]),
  );
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(AccountAccessService)
      .useValue({ assertActive: async () => {} })
      .overrideProvider(FirebaseAdminService)
      .useValue({
        verifyIdToken: async (token: string) => ({
          uid: token,
          email: `${token}@example.com`,
          email_verified: true,
        }),
      })
      .overrideProvider(CommerceService)
      .useValue(commerce)
      .overrideProvider(NotificationsService)
      .useValue(notifications)
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    vi.resetAllMocks();
    for (const method of [
      ...Object.values(commerce),
      ...Object.values(notifications),
    ])
      method.mockResolvedValue({});
  });
  const settings = {
    version: 0,
    shippingFeeLkrMinor: 35000,
    freeShippingThresholdMinor: null,
    deliveryMinDays: 2,
    deliveryMaxDays: 5,
    districtRates: [{ district: 'Kandy', available: true, feeMinor: 45000 }],
  };
  const root = `/api/v1/sellers/${id}`;
  it.each(['/api/v1/me/notifications/inbox', `${root}/delivery-settings`])(
    'requires identity for %s',
    async (path) => {
      await request(app.getHttpServer()).get(path).expect(401);
    },
  );
  it('forwards only the signed-in identity and validated address for quotes', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/me/cart?addressId=${id}`)
      .auth('buyer', { type: 'bearer' })
      .expect(200);
    expect(commerce.cart).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'buyer' }),
      id,
    );
    await request(app.getHttpServer())
      .get('/api/v1/me/cart?addressId=invalid')
      .auth('buyer', { type: 'bearer' })
      .expect(400);
    await request(app.getHttpServer())
      .get(`/api/v1/me/cart?buyerId=${id}`)
      .auth('buyer', { type: 'bearer' })
      .expect(400);
  });
  it('accepts versioned delivery settings and nested district overrides', async () => {
    await request(app.getHttpServer())
      .put(root + '/delivery-settings')
      .auth('seller', { type: 'bearer' })
      .send(settings)
      .expect(200);
    expect(commerce.setDeliverySettings).toHaveBeenCalledWith(
      id,
      expect.objectContaining({ uid: 'seller' }),
      expect.objectContaining(settings),
    );
  });
  it.each([
    { shippingFeeLkrMinor: -1 },
    { version: -1 },
    { freeShippingThresholdMinor: 0 },
    { deliveryMinDays: 0 },
    { deliveryMaxDays: 61 },
    { sellerId: id },
    { districtRates: [{ district: 'Unknown', available: true, feeMinor: 1 }] },
    { districtRates: [{ district: 'Kandy', available: 'yes', feeMinor: 1 }] },
    {
      districtRates: [
        { district: 'Kandy', available: true, feeMinor: 1 },
        { district: 'Kandy', available: false, feeMinor: 0 },
      ],
    },
  ])('rejects invalid delivery settings %j', async (override) => {
    await request(app.getHttpServer())
      .put(root + '/delivery-settings')
      .auth('seller', { type: 'bearer' })
      .send({ ...settings, ...override })
      .expect(400);
    expect(commerce.setDeliverySettings).not.toHaveBeenCalled();
  });
  it('validates tracking versions and refuses forged dispatch dates', async () => {
    const data = {
      version: 1,
      courierName: 'Audit courier',
      trackingNumber: 'TRACK-123',
      reason: 'Corrected tracking reference from dispatch receipt',
    };
    await request(app.getHttpServer())
      .patch(root + `/orders/${id}/shipment`)
      .auth('seller', { type: 'bearer' })
      .send(data)
      .expect(200);
    expect(commerce.updateShipment).toHaveBeenCalledWith(
      id,
      id,
      expect.objectContaining({ uid: 'seller' }),
      expect.objectContaining(data),
    );
    await request(app.getHttpServer())
      .patch(root + `/orders/${id}/shipment`)
      .auth('seller', { type: 'bearer' })
      .send({ ...data, shippedAt: '2026-01-01' })
      .expect(400);
  });
  it('allows courier details in a shipped status request', async () => {
    await request(app.getHttpServer())
      .patch(root + `/orders/${id}/status`)
      .auth('seller', { type: 'bearer' })
      .send({
        status: 'SHIPPED',
        courierName: 'Own shop delivery',
        trackingNumber: '',
      })
      .expect(200);
  });
  it('uses authenticated private notification inbox and read-all routes', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/me/notifications/inbox')
      .auth('buyer', { type: 'bearer' })
      .expect('Cache-Control', 'private, no-store')
      .expect(200);
    expect(notifications.inbox).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'buyer' }),
    );
    await request(app.getHttpServer())
      .patch('/api/v1/me/notifications/read-all')
      .auth('buyer', { type: 'bearer' })
      .expect(200);
    expect(notifications.markAllRead).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'buyer' }),
    );
    await request(app.getHttpServer())
      .patch('/api/v1/me/notifications/read-all')
      .expect(401);
  });
});
