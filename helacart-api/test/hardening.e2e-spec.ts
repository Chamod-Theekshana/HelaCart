import { AccountAccessService } from '../src/auth/account-access.service.js';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { FirebaseAdminService } from '../src/auth/firebase-admin.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { CommerceService } from '../src/commerce/commerce.service.js';
import { PhoneVerificationService } from '../src/phone-verification/phone-verification.service.js';
import { NotificationSettingsService } from '../src/notifications/notification-settings.service.js';
import { AccountService } from '../src/account/account.service.js';
import { SellerStatusService } from '../src/sellers/seller-status.service.js';
import { AuditService } from '../src/audit/audit.service.js';
import { configureApp } from '../src/configure-app.js';

describe('November 2026 hardening HTTP boundaries (services mocked)', () => {
  let app: INestApplication;
  const id = 'c68e7c7c-7ad8-40b8-b2a1-a76c9a7b931c';
  const other = '0daa6d81-a735-436d-afad-1a999c283a9e';
  const mock = (names: string[]) =>
    Object.fromEntries(names.map((name) => [name, vi.fn()]));
  const commerce = mock([
    'updateAddress',
    'buyerCancel',
    'confirmReceipt',
    'sellerStatus',
    'adminAction',
    'attention',
  ]);
  const phones = mock(['start', 'confirm', 'verifiedPhones']);
  const settings = mock([
    'registerDevice',
    'unregisterDevice',
    'preferences',
    'savePreferences',
  ]);
  const account = mock(['exportData', 'deleteAccount']);
  const sellers = mock(['list', 'update']);
  const audit = mock(['list', 'actor', 'record']);
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
      .overrideProvider(PhoneVerificationService)
      .useValue(phones)
      .overrideProvider(NotificationSettingsService)
      .useValue(settings)
      .overrideProvider(AccountService)
      .useValue(account)
      .overrideProvider(SellerStatusService)
      .useValue(sellers)
      .overrideProvider(AuditService)
      .useValue(audit)
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
    // Each test gets a fresh rate-limit window.
    time += 61_000;
    vi.spyOn(Date, 'now').mockReturnValue(time);
    for (const fn of [
      ...Object.values(commerce),
      ...Object.values(phones),
      ...Object.values(settings),
      ...Object.values(account),
      ...Object.values(sellers),
      ...Object.values(audit),
    ])
      fn.mockResolvedValue({});
  });
  afterEach(() => vi.restoreAllMocks());
  const server = () => app.getHttpServer();

  it('accepts partial address updates with isDefault and rejects unknown fields', async () => {
    await request(server())
      .patch(`/api/v1/me/addresses/${id}`)
      .auth('buyer', { type: 'bearer' })
      .send({ isDefault: true, city: '  Kandy  ' })
      .expect(200);
    expect(commerce.updateAddress).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'buyer' }),
      id,
      expect.objectContaining({ isDefault: true, city: 'Kandy' }),
    );
    await request(server())
      .patch(`/api/v1/me/addresses/${id}`)
      .auth('buyer', { type: 'bearer' })
      .send({ phoneVerified: true })
      .expect(400);
    await request(server())
      .patch(`/api/v1/me/addresses/${id}`)
      .auth('buyer', { type: 'bearer' })
      .send({ district: 'Atlantis' })
      .expect(400);
  });

  it('passes an optional buyer cancel reason and confirms receipt with 200', async () => {
    await request(server())
      .patch(`/api/v1/me/orders/${id}/seller-orders/${other}/cancel`)
      .auth('buyer', { type: 'bearer' })
      .expect(200);
    expect(commerce.buyerCancel).toHaveBeenLastCalledWith(
      expect.anything(),
      id,
      other,
      undefined,
    );
    await request(server())
      .patch(`/api/v1/me/orders/${id}/seller-orders/${other}/cancel`)
      .auth('buyer', { type: 'bearer' })
      .send({ reason: 'Ordered by mistake' })
      .expect(200);
    expect(commerce.buyerCancel).toHaveBeenLastCalledWith(
      expect.anything(),
      id,
      other,
      'Ordered by mistake',
    );
    await request(server())
      .patch(`/api/v1/me/orders/${id}/seller-orders/${other}/cancel`)
      .auth('buyer', { type: 'bearer' })
      .send({ reason: 'no' })
      .expect(400);
    await request(server())
      .post(`/api/v1/me/orders/${id}/seller-orders/${other}/confirm-receipt`)
      .auth('buyer', { type: 'bearer' })
      .send({})
      .expect(200);
    expect(commerce.confirmReceipt).toHaveBeenCalledWith(
      expect.anything(),
      id,
      other,
    );
  });

  it('validates the extended seller status body', async () => {
    const path = `/api/v1/sellers/${id}/orders/${other}/status`;
    await request(server())
      .patch(path)
      .auth('seller', { type: 'bearer' })
      .send({ status: 'DELIVERY_FAILED', reason: 'Customer refused parcel' })
      .expect(200);
    expect(commerce.sellerStatus).toHaveBeenCalledWith(
      id,
      other,
      expect.anything(),
      expect.objectContaining({
        status: 'DELIVERY_FAILED',
        reason: 'Customer refused parcel',
      }),
    );
    await request(server())
      .patch(path)
      .auth('seller', { type: 'bearer' })
      .send({ status: 'RETURNED_TO_SELLER', reason: 'x'.repeat(501) })
      .expect(400);
    await request(server())
      .patch(path)
      .auth('seller', { type: 'bearer' })
      .send({ status: 'PLACED' })
      .expect(400);
  });

  it('routes admin order actions and attention queries to admins only', async () => {
    await request(server())
      .post(`/api/v1/admin/orders/${id}/actions`)
      .auth('admin-uid', { type: 'bearer' })
      .send({ action: 'MARK_DELIVERY_FAILED', reason: 'Courier report' })
      .expect(200);
    expect(commerce.adminAction).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'admin-uid' }),
      id,
      { action: 'MARK_DELIVERY_FAILED', reason: 'Courier report' },
    );
    await request(server())
      .get(`/api/v1/admin/orders/attention?days=3&limit=10&cursor=${other}`)
      .auth('admin-uid', { type: 'bearer' })
      .expect(200);
    expect(commerce.attention).toHaveBeenCalledWith(
      expect.objectContaining({ days: 3, limit: 10, cursor: other }),
    );
    await request(server())
      .get('/api/v1/admin/orders/attention')
      .auth('buyer', { type: 'bearer' })
      .expect(403);
  });

  it('starts and confirms phone verification with the documented status codes', async () => {
    await request(server())
      .post('/api/v1/me/phone-verifications')
      .auth('buyer', { type: 'bearer' })
      .send({ phone: '0771234567' })
      .expect(201);
    expect(phones.start).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'buyer' }),
      '0771234567',
    );
    await request(server())
      .post(`/api/v1/me/phone-verifications/${id}/confirm`)
      .auth('buyer', { type: 'bearer' })
      .send({ code: '123456' })
      .expect(200);
    await request(server())
      .post('/api/v1/me/phone-verifications/not-a-uuid/confirm')
      .auth('buyer', { type: 'bearer' })
      .send({ code: '123456' })
      .expect(400);
    await request(server())
      .get('/api/v1/me/verified-phones')
      .auth('buyer', { type: 'bearer' })
      .expect(200);
  });

  it('registers devices, unregisters with 204 and saves preferences', async () => {
    const token = 'f'.repeat(40);
    await request(server())
      .post('/api/v1/me/devices')
      .auth('buyer', { type: 'bearer' })
      .send({ token, platform: 'android', appVersion: '1.1.0' })
      .expect(201);
    await request(server())
      .post('/api/v1/me/devices')
      .auth('buyer', { type: 'bearer' })
      .send({ token, platform: 'windows' })
      .expect(400);
    await request(server())
      .post('/api/v1/me/devices/unregister')
      .auth('buyer', { type: 'bearer' })
      .send({ token })
      .expect(204);
    expect(settings.unregisterDevice).toHaveBeenCalledWith(
      expect.anything(),
      token,
    );
    await request(server())
      .put('/api/v1/me/notification-preferences')
      .auth('buyer', { type: 'bearer' })
      .send({ push: true, email: false, sms: true })
      .expect(200);
    await request(server())
      .put('/api/v1/me/notification-preferences')
      .auth('buyer', { type: 'bearer' })
      .send({ push: true })
      .expect(400);
  });

  it('exports personal data as a dated JSON attachment and confirms deletion', async () => {
    account.exportData.mockResolvedValue({
      filename: 'helacart-data-2026-11-01.json',
      body: Buffer.from('{"profile":{}}'),
    });
    const response = await request(server())
      .get('/api/v1/me/data-export')
      .auth('buyer', { type: 'bearer' })
      .expect(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="helacart-data-2026-11-01.json"',
    );
    await request(server())
      .delete('/api/v1/me/account')
      .auth('buyer', { type: 'bearer' })
      .send({ confirm: 'yes' })
      .expect(400);
    expect(account.deleteAccount).not.toHaveBeenCalled();
    await request(server())
      .delete('/api/v1/me/account')
      .auth('buyer', { type: 'bearer' })
      .send({ confirm: 'DELETE' })
      .expect(204);
    expect(account.deleteAccount).toHaveBeenCalledOnce();
  });

  it('lets admins list and suspend shops with validated bodies', async () => {
    await request(server())
      .get('/api/v1/admin/sellers?status=SUSPENDED&q=craft&limit=5')
      .auth('admin-uid', { type: 'bearer' })
      .expect(200);
    expect(sellers.list).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'SUSPENDED', q: 'craft', limit: 5 }),
    );
    await request(server())
      .patch(`/api/v1/admin/sellers/${id}/status`)
      .auth('admin-uid', { type: 'bearer' })
      .send({ status: 'SUSPENDED', reason: 'Repeated fake parcels' })
      .expect(200);
    await request(server())
      .patch(`/api/v1/admin/sellers/${id}/status`)
      .auth('admin-uid', { type: 'bearer' })
      .send({ status: 'SUSPENDED', reason: 'no' })
      .expect(400);
    await request(server())
      .get('/api/v1/admin/audit-log?action=SELLER_SUSPEND&limit=50')
      .auth('admin-uid', { type: 'bearer' })
      .expect(200);
    expect(audit.list).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SELLER_SUSPEND', limit: 50 }),
    );
    await request(server())
      .get('/api/v1/admin/audit-log?limit=500')
      .auth('admin-uid', { type: 'bearer' })
      .expect(400);
  });
});
