import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { AfterSalesService } from '../src/after-sales/after-sales.service.js';
import { OperationsService } from '../src/operations/operations.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { FirebaseAdminService } from '../src/auth/firebase-admin.service.js';
import { configureApp } from '../src/configure-app.js';
describe('After-sales HTTP authorization and validation', () => {
  let app: INestApplication;
  const id = 'c68e7c7c-7ad8-40b8-b2a1-a76c9a7b931c';
  const service = Object.fromEntries(
    [
      'options',
      'returns',
      'refunds',
      'submitRefund',
      'reviewRefund',
      'reverseRefund',
      'cases',
      'caseDetail',
      'caseMessages',
      'createCase',
      'addMessage',
      'decideCase',
    ].map((k) => [k, vi.fn()]),
  );
  const operations = { requestReturn: vi.fn() };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(FirebaseAdminService)
      .useValue({
        verifyIdToken: async (token: string) => ({
          uid: token,
          email: `${token}@example.com`,
          email_verified: token !== 'unverified',
        }),
      })
      .overrideProvider(AfterSalesService)
      .useValue(service)
      .overrideProvider(OperationsService)
      .useValue(operations)
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
    for (const fn of [...Object.values(service), ...Object.values(operations)])
      fn.mockResolvedValue({});
  });
  afterEach(() => vi.restoreAllMocks());
  const buyer = '/api/v1/me/after-sales',
    seller = `/api/v1/sellers/${id}/after-sales`,
    admin = '/api/v1/admin/after-sales';
  it.each([
    `${buyer}/support`,
    `${buyer}/return-options/${id}`,
    `${seller}/returns`,
    `${seller}/refunds`,
  ])('requires authentication for %s', async (path) => {
    await request(app.getHttpServer()).get(path).expect(401);
  });
  it.each([`${admin}/support`, `${admin}/refunds`])(
    'requires admin rights for %s',
    async (path) => {
      await request(app.getHttpServer())
        .get(path)
        .auth('buyer', { type: 'bearer' })
        .expect(403);
    },
  );
  const support = {
    requestKey: id,
    sellerOrderId: id,
    title: 'Question about this order',
    category: 'ORDER_ISSUE',
    body: 'Please help investigate this order issue.',
  };
  it('uses buyer identity and server-derived participant scope for cases', async () => {
    await request(app.getHttpServer())
      .post(buyer + '/support')
      .auth('buyer', { type: 'bearer' })
      .send(support)
      .expect(201);
    expect(service.createCase).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'buyer' }),
      { role: 'BUYER' },
      expect.objectContaining(support),
    );
  });
  it.each([
    { buyerId: id },
    { sellerId: id },
    { financeHold: true },
    { status: 'CLOSED' },
    { category: 'INVALID' },
    { requestKey: 'bad' },
  ])('rejects forged or invalid support case data %j', async (override) => {
    await request(app.getHttpServer())
      .post(buyer + '/support')
      .auth('buyer', { type: 'bearer' })
      .send({ ...support, ...override })
      .expect(400);
  });
  it('binds seller case reads and messages to the shop in the route', async () => {
    await request(app.getHttpServer())
      .get(seller + `/support/${id}/messages?page=2`)
      .auth('seller', { type: 'bearer' })
      .expect('Cache-Control', 'private, no-store')
      .expect(200);
    expect(service.caseMessages).toHaveBeenCalledWith(
      id,
      expect.objectContaining({ uid: 'seller' }),
      { role: 'SELLER', sellerId: id },
      expect.objectContaining({ page: 2 }),
    );
    await request(app.getHttpServer())
      .post(seller + `/support/${id}/messages`)
      .auth('seller', { type: 'bearer' })
      .send({ requestKey: id, body: 'Seller reply', authorRole: 'ADMIN' })
      .expect(400);
  });
  it('guards support decisions and validates required reason and version', async () => {
    const data = {
      version: 2,
      status: 'RESOLVED',
      financeHold: false,
      reason: 'Reviewed and resolved with buyer agreement',
    };
    await request(app.getHttpServer())
      .patch(admin + `/support/${id}`)
      .auth('seller', { type: 'bearer' })
      .send(data)
      .expect(403);
    await request(app.getHttpServer())
      .patch(admin + `/support/${id}`)
      .auth('admin-uid', { type: 'bearer' })
      .send(data)
      .expect(200);
    expect(service.decideCase).toHaveBeenCalledWith(
      id,
      expect.objectContaining({ uid: 'admin-uid' }),
      expect.objectContaining(data),
    );
  });
  const refund = {
    requestKey: id,
    returnItemId: id,
    merchandiseMinor: 10000,
    shippingMinor: 0,
    method: 'CASH',
    reference: 'CASH-RECEIPT-123',
    paidOn: '2026-10-26',
  };
  it('accepts seller refund records with server-controlled review state', async () => {
    await request(app.getHttpServer())
      .post(seller + '/refunds')
      .auth('seller', { type: 'bearer' })
      .send(refund)
      .expect(201);
    expect(service.submitRefund).toHaveBeenCalledWith(
      id,
      expect.objectContaining({ uid: 'seller' }),
      expect.objectContaining(refund),
    );
  });
  it.each([
    { status: 'APPROVED' },
    { amountMinor: 1 },
    { reviewerId: id },
    { commissionRefundId: id },
    { merchandiseMinor: -1 },
    { shippingMinor: 1.5 },
    { method: 'ONLINE_GATEWAY' },
  ])('rejects forged refund fields %j', async (override) => {
    await request(app.getHttpServer())
      .post(seller + '/refunds')
      .auth('seller', { type: 'bearer' })
      .send({ ...refund, ...override })
      .expect(400);
  });
  it('restricts refund verification and reversals to admin', async () => {
    await request(app.getHttpServer())
      .patch(admin + `/refunds/${id}`)
      .auth('seller', { type: 'bearer' })
      .send({
        decision: 'APPROVED',
        reason: 'Checked actual buyer refund evidence',
      })
      .expect(403);
    await request(app.getHttpServer())
      .post(admin + `/refunds/${id}/reverse`)
      .auth('buyer', { type: 'bearer' })
      .send({
        requestKey: id,
        reference: 'CORRECTION-123',
        reason: 'Investigated incorrect refund evidence',
      })
      .expect(403);
    await request(app.getHttpServer())
      .patch(admin + `/refunds/${id}`)
      .auth('admin-uid', { type: 'bearer' })
      .send({ decision: 'PENDING', reason: 'Invalid review state supplied' })
      .expect(400);
  });
  it('validates item quantities and refuses client-supplied refund prices', async () => {
    const data = {
      sellerOrderId: id,
      requestKey: id,
      reason: 'One item arrived damaged and requires review',
      items: [{ orderItemId: id, quantity: 1 }],
    };
    await request(app.getHttpServer())
      .post('/api/v1/me/returns')
      .auth('buyer', { type: 'bearer' })
      .send(data)
      .expect(201);
    for (const items of [
      [],
      [{ orderItemId: id, quantity: 0 }],
      [{ orderItemId: id, quantity: 1, lineMinor: 1 }],
      [
        { orderItemId: id, quantity: 1 },
        { orderItemId: id, quantity: 1 },
      ],
    ])
      await request(app.getHttpServer())
        .post('/api/v1/me/returns')
        .auth('buyer', { type: 'bearer' })
        .send({ ...data, items })
        .expect(400);
  });
});
