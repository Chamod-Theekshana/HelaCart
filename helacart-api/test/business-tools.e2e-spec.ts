import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { FirebaseAdminService } from '../src/auth/firebase-admin.service.js';
import { AccountAccessService } from '../src/auth/account-access.service.js';
import { BulkToolsService } from '../src/business-tools/bulk-tools.service.js';
import { StockAlertsService } from '../src/business-tools/stock-alerts.service.js';
import { BusinessReportsService } from '../src/business-tools/business-reports.service.js';
import { configureApp } from '../src/configure-app.js';
describe('Bulk tools, stock alerts and business report HTTP boundaries', () => {
  let app: INestApplication;
  const id = 'c68e7c7c-7ad8-40b8-b2a1-a76c9a7b931c';
  const bulk = Object.fromEntries(
    ['template', 'history', 'preview', 'detail', 'apply'].map((k) => [
      k,
      vi.fn(),
    ]),
  );
  const stock = { list: vi.fn(), settings: vi.fn() },
    reports = { report: vi.fn(), export: vi.fn() };
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
      .overrideProvider(AccountAccessService)
      .useValue({ assertActive: async () => {} })
      .overrideProvider(BulkToolsService)
      .useValue(bulk)
      .overrideProvider(StockAlertsService)
      .useValue(stock)
      .overrideProvider(BusinessReportsService)
      .useValue(reports)
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
      ...Object.values(bulk),
      ...Object.values(stock),
      ...Object.values(reports),
    ])
      fn.mockResolvedValue({});
  });
  afterEach(() => vi.restoreAllMocks());
  const seller = `/api/v1/sellers/${id}`,
    admin = '/api/v1/admin',
    period = 'from=2026-10-01&to=2026-10-26';
  it.each([
    `${seller}/bulk-tools/jobs`,
    `${seller}/stock-alerts`,
    `${seller}/reports?${period}`,
    `${admin}/reports?${period}`,
    `${admin}/bulk-tools/jobs`,
  ])('requires authentication for %s', async (path) => {
    await request(app.getHttpServer()).get(path).expect(401);
  });
  it.each([`${admin}/reports?${period}`, `${admin}/bulk-tools/jobs`])(
    'rejects buyer access to %s',
    async (path) => {
      await request(app.getHttpServer())
        .get(path)
        .auth('buyer', { type: 'bearer' })
        .expect(403);
    },
  );
  it('retains verified administrator allowlist checks', async () => {
    await request(app.getHttpServer())
      .get(`${admin}/reports?${period}`)
      .auth('unverified', { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .get(`${admin}/reports?${period}`)
      .auth('admin-uid', { type: 'bearer' })
      .expect(200)
      .expect('Cache-Control', 'private, no-store');
    expect(reports.report).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'admin-uid' }),
      undefined,
      expect.objectContaining({ from: '2026-10-01', to: '2026-10-26' }),
    );
  });
  it('binds seller report scope to the route and rejects forged seller queries', async () => {
    await request(app.getHttpServer())
      .get(`${seller}/reports?${period}`)
      .auth('seller', { type: 'bearer' })
      .expect(200);
    expect(reports.report).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'seller' }),
      id,
      expect.anything(),
    );
    await request(app.getHttpServer())
      .get(`${seller}/reports?${period}&sellerId=${id}`)
      .auth('seller', { type: 'bearer' })
      .expect(400);
  });
  it.each(['from=bad&to=2026-10-26', 'from=2026-10-01', 'to=2026-10-26'])(
    'validates required report dates %s',
    async (query) => {
      await request(app.getHttpServer())
        .get(`${seller}/reports?${query}`)
        .auth('seller', { type: 'bearer' })
        .expect(400);
      expect(reports.report).not.toHaveBeenCalled();
    },
  );
  it('returns authenticated CSV attachments with private caching', async () => {
    reports.export.mockResolvedValue('date,total\r\n2026-10-26,200');
    bulk.template.mockResolvedValue('sku,on_hand\r\nA-1,20');
    await request(app.getHttpServer())
      .get(`${seller}/reports/export.csv?${period}&section=DAILY`)
      .auth('seller', { type: 'bearer' })
      .expect(200)
      .expect('Content-Type', /text\/csv/)
      .expect('Content-Disposition', /attachment/)
      .expect('Cache-Control', 'private, no-store');
    await request(app.getHttpServer())
      .get(`${seller}/bulk-tools/stock-template.csv?q=shirt`)
      .auth('seller', { type: 'bearer' })
      .expect(200)
      .expect('Content-Type', /text\/csv/);
  });
  const preview = {
    requestKey: id,
    kind: 'STOCK_SET',
    reason: 'Weekly physical count after receiving stock.',
    csv: 'sku,on_hand\nSHIRT-1,25',
  };
  it('previews stock with authenticated actor and explicit shop scope', async () => {
    await request(app.getHttpServer())
      .post(`${seller}/bulk-tools/preview`)
      .auth('seller', { type: 'bearer' })
      .send(preview)
      .expect(201)
      .expect('Cache-Control', 'private, no-store');
    expect(bulk.preview).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'seller' }),
      id,
      expect.objectContaining(preview),
    );
  });
  it.each([
    { csv: null },
    { productIds: null },
    { actorId: id },
    { sellerId: id },
    { status: 'APPLIED' },
    { preview: { valid: true } },
    { requestKey: 'bad' },
    { kind: 'PRODUCT_DELETE' },
    { reason: 'short' },
    { productIds: [id, id] },
  ])('rejects forged preview input %j', async (override) => {
    await request(app.getHttpServer())
      .post(`${seller}/bulk-tools/preview`)
      .auth('seller', { type: 'bearer' })
      .send({ ...preview, ...override })
      .expect(400);
    expect(bulk.preview).not.toHaveBeenCalled();
  });
  it('rejects oversized product batches', async () => {
    await request(app.getHttpServer())
      .post(`${admin}/bulk-tools/preview`)
      .auth('admin-uid', { type: 'bearer' })
      .send({
        requestKey: id,
        kind: 'PRODUCT_APPROVE',
        reason: 'Reviewed selected product descriptions and images.',
        productIds: Array.from({ length: 101 }, () => crypto.randomUUID()),
      })
      .expect(400);
  });
  it('guards administrator bulk decisions and resolves jobs only in their workspace', async () => {
    const body = {
      requestKey: id,
      kind: 'PRODUCT_APPROVE',
      reason: 'Reviewed selected product descriptions and images.',
      productIds: [id],
    };
    await request(app.getHttpServer())
      .post(`${admin}/bulk-tools/preview`)
      .auth('buyer', { type: 'bearer' })
      .send(body)
      .expect(403);
    await request(app.getHttpServer())
      .post(`${admin}/bulk-tools/preview`)
      .auth('admin-uid', { type: 'bearer' })
      .send(body)
      .expect(201);
    await request(app.getHttpServer())
      .post(`${seller}/bulk-tools/jobs/${id}/apply`)
      .auth('seller', { type: 'bearer' })
      .expect(201);
    expect(bulk.apply).toHaveBeenCalledWith(
      id,
      expect.objectContaining({ uid: 'seller' }),
      id,
    );
  });
  it.each([
    { threshold: -1 },
    { threshold: 1.5 },
    { threshold: 1000001 },
    { version: -1 },
    { enabled: 'true' },
    { sellerId: id },
    { onHand: 100 },
  ])('rejects forged stock settings %j', async (override) => {
    await request(app.getHttpServer())
      .patch(`${seller}/stock-alerts/${id}/settings`)
      .auth('seller', { type: 'bearer' })
      .send({ threshold: 5, version: 0, enabled: true, ...override })
      .expect(400);
    expect(stock.settings).not.toHaveBeenCalled();
  });
  it('supports zero thresholds and binds alert reads and settings to the shop', async () => {
    await request(app.getHttpServer())
      .patch(`${seller}/stock-alerts/${id}/settings`)
      .auth('seller', { type: 'bearer' })
      .send({ threshold: 0, version: 3, enabled: false })
      .expect(200);
    expect(stock.settings).toHaveBeenCalledWith(
      id,
      id,
      expect.objectContaining({ uid: 'seller' }),
      expect.objectContaining({ threshold: 0, version: 3, enabled: false }),
    );
    await request(app.getHttpServer())
      .get(`${seller}/stock-alerts?level=OUT&page=2`)
      .auth('seller', { type: 'bearer' })
      .expect(200);
    expect(stock.list).toHaveBeenCalledWith(
      id,
      expect.objectContaining({ uid: 'seller' }),
      expect.objectContaining({ level: 'OUT', page: 2 }),
    );
  });
  it('does not expose the internal notification worker as an HTTP action', async () => {
    await request(app.getHttpServer())
      .post(`${seller}/stock-alerts/process`)
      .auth('seller', { type: 'bearer' })
      .expect(404);
  });
});
