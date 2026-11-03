import { AccountAccessService } from '../src/auth/account-access.service.js';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { FirebaseAdminService } from '../src/auth/firebase-admin.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { CommissionService } from '../src/commission/commission.service.js';
import { configureApp } from '../src/configure-app.js';
describe('Commission HTTP ownership and request boundaries', () => {
  let app: INestApplication;
  let requestTime = Date.now();
  const id = 'd63c76f1-3fe0-4d78-bbad-48c37ad630ad';
  const service = Object.fromEntries(
    [
      'sellerSummary',
      'sellerSummaryForAdmin',
      'policy',
      'policyHistory',
      'updatePolicy',
      'adminSummary',
      'balances',
      'charges',
      'payments',
      'submit',
      'review',
      'receipt',
      'refund',
      'remind',
      'statement',
      'exportStatement',
      'correct',
      'products',
      'productHistory',
      'updateProduct',
      'hold',
    ].map((key) => [key, vi.fn()]),
  );
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(AccountAccessService)
      .useValue({ assertActive: async () => {} })
      .overrideProvider(FirebaseAdminService)
      .useValue({
        verifyIdToken: async (token: string) => {
          if (token === 'expired') throw Error('expired');
          return {
            uid: token,
            email: token + '@example.com',
            email_verified: token !== 'unverified',
          };
        },
      })
      .overrideProvider(CommissionService)
      .useValue(service)
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
    // Each case gets its own limiter window; the limiter itself has unit coverage.
    requestTime += 61000;
    vi.spyOn(Date, 'now').mockReturnValue(requestTime);
    for (const fn of Object.values(service)) fn.mockResolvedValue({});
    service.policy.mockResolvedValue({
      enabled: false,
      rateBps: 0,
      paymentDays: 14,
    });
    service.receipt.mockResolvedValue({
      bytes: Buffer.from('private receipt'),
      contentType: 'image/png',
    });
    service.exportStatement.mockResolvedValue(Buffer.from('statement'));
  });
  afterEach(() => vi.restoreAllMocks());
  const seller = `/api/v1/sellers/${id}/commission`,
    admin = '/api/v1/admin/commission';
  it.each([
    'summary',
    'products',
    'policy',
    'charges',
    'payments',
    'statement',
    'statement.csv',
    `payments/${id}/receipt`,
  ])('requires authentication for seller %s', async (path) => {
    await request(app.getHttpServer())
      .get(seller + '/' + path)
      .expect(401);
  });
  it.each([
    'summary',
    'products',
    `products/${id}/history`,
    'policy',
    'policy/history',
    'sellers',
    'payments',
    `sellers/${id}/charges`,
    `sellers/${id}/statement`,
    `sellers/${id}/statement.csv`,
    `payments/${id}/receipt`,
  ])('requires an owner/admin identity for %s', async (path) => {
    await request(app.getHttpServer())
      .get(admin + '/' + path)
      .set('Authorization', 'Bearer seller')
      .expect(403);
  });
  it('rejects an unverified owner', async () => {
    await request(app.getHttpServer())
      .get(admin + '/summary')
      .set('Authorization', 'Bearer unverified')
      .expect(403);
  });
  it('rejects revoked or expired identities', async () => {
    await request(app.getHttpServer())
      .get(admin + '/summary')
      .set('Authorization', 'Bearer expired')
      .expect(401);
  });
  it('keeps financial responses private', async () => {
    await request(app.getHttpServer())
      .get(seller + '/summary')
      .set('Authorization', 'Bearer seller')
      .expect('Cache-Control', 'private, no-store')
      .expect(200);
    expect(service.sellerSummary).toHaveBeenCalledWith(
      id,
      expect.objectContaining({ uid: 'seller' }),
    );
  });
  it('filters admin payments by a validated seller ID', async () => {
    await request(app.getHttpServer())
      .get(admin + `/payments?sellerId=${id}&page=2`)
      .set('Authorization', 'Bearer admin-uid')
      .expect(200);
    expect(service.payments).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, sellerId: id }),
      id,
    );
  });
  it.each([
    'page=0',
    'limit=999',
    'month=2026-13',
    'filter=NOT_REAL',
    'status=NOT_REAL',
    'sellerId=not-a-uuid',
  ])('rejects invalid query %s', async (query) => {
    await request(app.getHttpServer())
      .get(admin + '/payments?' + query)
      .set('Authorization', 'Bearer admin-uid')
      .expect(400);
  });
  it('validates route UUIDs', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/sellers/not-a-uuid/commission/summary')
      .set('Authorization', 'Bearer seller')
      .expect(400);
  });
  const policy = {
    version: 0,
    paymentDays: 14,
    bankName: 'Bank',
    accountName: 'HelaCart',
    accountNumber: '12345',
    instructions: '',
    reason: 'Initial policy configuration',
  };
  it('accepts guarded owner policy changes', async () => {
    await request(app.getHttpServer())
      .patch(admin + '/policy')
      .set('Authorization', 'Bearer admin-uid')
      .send(policy)
      .expect(200);
    expect(service.updatePolicy).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'admin-uid' }),
      expect.objectContaining({ paymentDays: 14 }),
    );
  });
  it.each([
    { rateBps: 1.5 },
    { rateBps: 10001 },
    { paymentDays: 0 },
    { reason: 'short' },
    { ownerId: id },
  ])('rejects invalid or forged policy data %j', async (override) => {
    await request(app.getHttpServer())
      .patch(admin + '/policy')
      .set('Authorization', 'Bearer admin-uid')
      .send({ ...policy, ...override })
      .expect(400);
  });
  it('does not accept seller approval of a payment', async () => {
    await request(app.getHttpServer())
      .patch(admin + `/payments/${id}`)
      .set('Authorization', 'Bearer seller')
      .send({ decision: 'APPROVED', reason: 'Verified bank transfer' })
      .expect(403);
  });
  it.each([null, 0, 725, 10000])(
    'lets admin assign or clear a product rate %s',
    async (rateBps) => {
      await request(app.getHttpServer())
        .patch(admin + `/products/${id}`)
        .set('Authorization', 'Bearer admin-uid')
        .send({
          version: 0,
          rateBps,
          reason: 'Reviewed product commission terms',
        })
        .expect(200);
      expect(service.updateProduct).toHaveBeenCalledWith(
        id,
        expect.objectContaining({ uid: 'admin-uid' }),
        expect.objectContaining({ rateBps, version: 0 }),
      );
    },
  );
  it.each([
    {},
    { rateBps: 1.5 },
    { rateBps: 10001 },
    { rateBps: -1 },
    { rateBps: 500, version: -1 },
    { rateBps: 500, actorId: id },
  ])(
    'rejects missing, invalid and forged product rates %j',
    async (override) => {
      await request(app.getHttpServer())
        .patch(admin + `/products/${id}`)
        .set('Authorization', 'Bearer admin-uid')
        .send({
          version: 0,
          reason: 'Reviewed product commission terms',
          ...override,
        })
        .expect(400);
    },
  );
  it('rejects seller mutations of rates, settings and holds', async () => {
    await request(app.getHttpServer())
      .patch(admin + `/products/${id}`)
      .set('Authorization', 'Bearer seller')
      .send({
        version: 0,
        rateBps: 500,
        reason: 'Forged seller commission assignment',
      })
      .expect(403);
    await request(app.getHttpServer())
      .patch(admin + '/policy')
      .set('Authorization', 'Bearer seller')
      .send(policy)
      .expect(403);
    await request(app.getHttpServer())
      .post(admin + `/charges/${id}/hold`)
      .set('Authorization', 'Bearer seller')
      .send({ version: 0, held: true, reason: 'Forged seller commission hold' })
      .expect(403);
  });
  it('validates admin hold decisions and optimistic version', async () => {
    const path = admin + `/charges/${id}/hold`;
    await request(app.getHttpServer())
      .post(path)
      .set('Authorization', 'Bearer admin-uid')
      .send({
        version: 0,
        held: true,
        reason: 'Unresolved delivery refund dispute',
      })
      .expect(201);
    expect(service.hold).toHaveBeenCalledWith(
      id,
      expect.objectContaining({ uid: 'admin-uid' }),
      expect.objectContaining({ held: true, version: 0 }),
    );
    await request(app.getHttpServer())
      .post(path)
      .set('Authorization', 'Bearer admin-uid')
      .send({
        version: 0,
        held: 'true',
        reason: 'Unresolved delivery refund dispute',
      })
      .expect(400);
  });
  it('scopes seller product rates to the authenticated membership', async () => {
    await request(app.getHttpServer())
      .get(seller + '/products')
      .set('Authorization', 'Bearer seller')
      .expect(200);
    expect(service.products).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1 }),
      id,
      expect.objectContaining({ uid: 'seller' }),
    );
  });
  it('does not accept a seller reversing a financial record', async () => {
    await request(app.getHttpServer())
      .post(admin + `/sellers/${id}/corrections`)
      .set('Authorization', 'Bearer seller')
      .send({
        requestKey: id,
        kind: 'PAYMENT',
        targetId: id,
        reference: 'CASE-123',
        reason: 'Investigated incorrect bank approval',
      })
      .expect(403);
  });
  it('forwards owner corrections without accepting a client-supplied amount', async () => {
    const body = {
      requestKey: id,
      kind: 'PAYMENT',
      targetId: id,
      reference: 'CASE-123',
      reason: 'Investigated incorrect bank approval',
    };
    await request(app.getHttpServer())
      .post(admin + `/sellers/${id}/corrections`)
      .set('Authorization', 'Bearer admin-uid')
      .send(body)
      .expect(201);
    expect(service.correct).toHaveBeenCalledWith(
      id,
      expect.objectContaining({ uid: 'admin-uid' }),
      expect.objectContaining({ targetId: id, kind: 'PAYMENT' }),
    );
    await request(app.getHttpServer())
      .post(admin + `/sellers/${id}/corrections`)
      .set('Authorization', 'Bearer admin-uid')
      .send({ ...body, amountMinor: 999999 })
      .expect(400);
  });
  it('requires an explicit final decision and verification note', async () => {
    await request(app.getHttpServer())
      .patch(admin + `/payments/${id}`)
      .set('Authorization', 'Bearer admin-uid')
      .send({ decision: 'PENDING', reason: 'ok' })
      .expect(400);
  });
  it('forwards a receipt only through an authenticated private route', async () => {
    await request(app.getHttpServer())
      .get(seller + `/payments/${id}/receipt`)
      .set('Authorization', 'Bearer seller')
      .expect('Cache-Control', 'private, no-store')
      .expect('Content-Type', /image\/png/)
      .expect(200);
    expect(service.receipt).toHaveBeenCalledWith(
      id,
      id,
      expect.objectContaining({ uid: 'seller' }),
    );
  });
  it('exports guarded statements as CSV', async () => {
    await request(app.getHttpServer())
      .get(seller + '/statement.csv?month=2026-10')
      .set('Authorization', 'Bearer seller')
      .expect('Content-Type', /text\/csv/)
      .expect('Content-Disposition', /attachment/)
      .expect(200);
  });
  it('parses receipt multipart fields without trusting seller or status overrides', async () => {
    await request(app.getHttpServer())
      .post(seller + '/payments')
      .set('Authorization', 'Bearer seller')
      .field('requestKey', id)
      .field('amountMinor', '10000')
      .field('reference', 'BANK-123')
      .field('paidOn', '2026-10-25')
      .attach('receipt', Buffer.from('receipt'), {
        filename: 'receipt.png',
        contentType: 'image/png',
      })
      .expect(201);
    expect(service.submit).toHaveBeenCalledWith(
      id,
      expect.objectContaining({ uid: 'seller' }),
      expect.objectContaining({ amountMinor: 10000 }),
      expect.objectContaining({ mimetype: 'image/png' }),
    );
  });
  it('rejects forged multipart payment status', async () => {
    await request(app.getHttpServer())
      .post(seller + '/payments')
      .set('Authorization', 'Bearer seller')
      .field('requestKey', id)
      .field('amountMinor', '10000')
      .field('reference', 'BANK-123')
      .field('paidOn', '2026-10-25')
      .field('status', 'APPROVED')
      .expect(400);
  });
  it('limits receipt size before the service', async () => {
    await request(app.getHttpServer())
      .post(seller + '/payments')
      .set('Authorization', 'Bearer seller')
      .field('requestKey', id)
      .attach('receipt', Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: 'big.png',
        contentType: 'image/png',
      })
      .expect(413);
    expect(service.submit).not.toHaveBeenCalled();
  });
});
