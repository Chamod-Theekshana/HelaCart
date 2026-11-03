import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { FirebaseAdminService } from '../src/auth/firebase-admin.service.js';
import { ProductFeedbackService } from '../src/product-feedback/product-feedback.service.js';
import { AccountPermissionsService } from '../src/account-permissions/account-permissions.service.js';
import { CatalogService } from '../src/catalog/catalog.service.js';
import { configureApp } from '../src/configure-app.js';
describe('Product feedback and account permission HTTP boundaries', () => {
  let app: INestApplication;
  const id = 'c68e7c7c-7ad8-40b8-b2a1-a76c9a7b931c';
  const feedback = Object.fromEntries(
    [
      'list',
      'access',
      'save',
      'remove',
      'sellerList',
      'reply',
      'report',
      'reports',
      'moderate',
      'mine',
    ].map((k) => [k, vi.fn()]),
  );
  const permissions = Object.fromEntries(
    ['accounts', 'decide', 'team', 'add', 'remove'].map((k) => [k, vi.fn()]),
  );
  const catalog = { createProduct: vi.fn(), editProduct: vi.fn() };
  const firebase = { verifyIdToken: vi.fn() };
  const db = { user: { findUnique: vi.fn() } };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .overrideProvider(FirebaseAdminService)
      .useValue(firebase)
      .overrideProvider(ProductFeedbackService)
      .useValue(feedback)
      .overrideProvider(AccountPermissionsService)
      .useValue(permissions)
      .overrideProvider(CatalogService)
      .useValue(catalog)
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
    firebase.verifyIdToken.mockImplementation(async (token) => {
      if (token === 'revoked') throw Error('revoked');
      return {
        uid: token,
        email: `${token}@example.com`,
        email_verified: token !== 'unverified',
      };
    });
    db.user.findUnique.mockImplementation(async ({ where }) => ({
      accessStatus: where.firebaseUid === 'suspended' ? 'SUSPENDED' : 'ACTIVE',
    }));
    for (const fn of [
      ...Object.values(feedback),
      ...Object.values(permissions),
      ...Object.values(catalog),
    ])
      fn.mockResolvedValue({});
  });
  afterEach(() => vi.restoreAllMocks());
  const product = `/api/v1/products/${id}/customer-reviews`,
    seller = `/api/v1/sellers/${id}`,
    admin = '/api/v1/admin';
  it('keeps buyer review history account scoped and private', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/me/product-reviews?page=2')
      .auth('buyer', { type: 'bearer' })
      .expect(200)
      .expect('Cache-Control', 'private, no-store');
    expect(feedback.mine).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'buyer' }),
      expect.objectContaining({ page: 2 }),
    );
    await request(app.getHttpServer())
      .get('/api/v1/me/product-reviews?buyerId=' + id)
      .auth('buyer', { type: 'bearer' })
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/me/product-reviews')
      .auth('suspended', { type: 'bearer' })
      .expect(403);
  });
  it('serves public reviews without authentication and validates filters', async () => {
    await request(app.getHttpServer())
      .get(product + '?page=2&rating=4&sort=highest')
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(feedback.list).toHaveBeenCalledWith(
      id,
      expect.objectContaining({ page: 2, rating: 4, sort: 'highest' }),
    );
    expect(firebase.verifyIdToken).not.toHaveBeenCalled();
  });
  it.each([
    'rating=0',
    'rating=6',
    'page=-1',
    'limit=51',
    'sort=unsafe',
    'buyerId=' + id,
  ])('rejects invalid public filters %s', async (q) => {
    await request(app.getHttpServer())
      .get(product + '?' + q)
      .expect(400);
    expect(feedback.list).not.toHaveBeenCalled();
  });
  it.each([
    product + '/access',
    seller + '/product-reviews',
    seller + '/team',
    admin + '/accounts',
    admin + '/product-review-reports',
  ])('requires authentication for %s', async (path) => {
    await request(app.getHttpServer()).get(path).expect(401);
  });
  it.each([product + '/access', seller + '/team', admin + '/accounts'])(
    'blocks suspended accounts for %s',
    async (path) => {
      await request(app.getHttpServer())
        .get(path)
        .auth('suspended', { type: 'bearer' })
        .expect(403);
      expect(feedback.access).not.toHaveBeenCalled();
      expect(permissions.team).not.toHaveBeenCalled();
      expect(permissions.accounts).not.toHaveBeenCalled();
    },
  );
  it('rejects revoked sessions on buyer routes', async () => {
    await request(app.getHttpServer())
      .get(product + '/access')
      .auth('revoked', { type: 'bearer' })
      .expect(401);
    expect(feedback.access).not.toHaveBeenCalled();
  });
  it('binds buyer reviews to verified request identity, never body identity', async () => {
    await request(app.getHttpServer())
      .put(product + '/mine')
      .auth('buyer', { type: 'bearer' })
      .send({
        version: 0,
        rating: 5,
        comment: 'Useful product and good quality.',
      })
      .expect(200)
      .expect('Cache-Control', 'private, no-store');
    expect(feedback.save).toHaveBeenCalledWith(
      id,
      expect.objectContaining({ uid: 'buyer' }),
      expect.objectContaining({ version: 0, rating: 5 }),
    );
  });
  it.each([
    { buyerId: id },
    { productId: id },
    { orderItemId: id },
    { isHidden: false },
    { version: -1 },
    { rating: 1.5 },
    { comment: 'short' },
    { rating: 6 },
    { reply: 'Injected seller reply' },
  ])('rejects forged review fields %j', async (override) => {
    await request(app.getHttpServer())
      .put(product + '/mine')
      .auth('buyer', { type: 'bearer' })
      .send({
        version: 0,
        rating: 5,
        comment: 'Useful product and good quality.',
        ...override,
      })
      .expect(400);
    expect(feedback.save).not.toHaveBeenCalled();
  });
  it('requires review version for delete and binds seller reply to shop route', async () => {
    await request(app.getHttpServer())
      .delete(product + '/mine')
      .auth('buyer', { type: 'bearer' })
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .delete(product + '/mine')
      .auth('buyer', { type: 'bearer' })
      .send({ version: 3 })
      .expect(200);
    expect(feedback.remove).toHaveBeenCalledWith(
      id,
      expect.objectContaining({ uid: 'buyer' }),
      expect.objectContaining({ version: 3 }),
    );
    await request(app.getHttpServer())
      .put(seller + `/product-reviews/${id}/reply`)
      .auth('seller', { type: 'bearer' })
      .send({ version: 2, reply: 'Thanks for your feedback.' })
      .expect(200);
    expect(feedback.reply).toHaveBeenCalledWith(
      id,
      id,
      expect.objectContaining({ uid: 'seller' }),
      expect.objectContaining({ version: 2 }),
    );
  });
  it('validates private reporting and rejects decision fields', async () => {
    await request(app.getHttpServer())
      .post(product + `/${id}/reports`)
      .auth('buyer', { type: 'bearer' })
      .send({ reason: 'This feedback contains personal details.' })
      .expect(201);
    await request(app.getHttpServer())
      .post(product + `/${id}/reports`)
      .auth('buyer', { type: 'bearer' })
      .send({
        reason: 'This feedback contains personal details.',
        status: 'ACTIONED',
      })
      .expect(400);
  });
  it.each([admin + '/accounts', admin + '/product-review-reports'])(
    'rejects buyer access to %s',
    async (path) => {
      await request(app.getHttpServer())
        .get(path)
        .auth('buyer', { type: 'bearer' })
        .expect(403);
    },
  );
  it('retains admin allowlist and verified-email checks', async () => {
    await request(app.getHttpServer())
      .get(admin + '/accounts')
      .auth('unverified', { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .get(admin + '/accounts')
      .auth('admin-uid', { type: 'bearer' })
      .expect(200)
      .expect('Cache-Control', 'private, no-store');
    expect(permissions.accounts).toHaveBeenCalled();
  });
  it('validates admin account decisions with explicit version and reason', async () => {
    const path = admin + `/accounts/${id}/access`;
    await request(app.getHttpServer())
      .patch(path)
      .auth('admin-uid', { type: 'bearer' })
      .send({
        status: 'SUSPENDED',
        version: 0,
        reason: 'Repeated misuse of account privileges.',
      })
      .expect(200);
    expect(permissions.decide).toHaveBeenCalledWith(
      id,
      expect.objectContaining({ uid: 'admin-uid' }),
      expect.objectContaining({ status: 'SUSPENDED', version: 0 }),
    );
    await request(app.getHttpServer())
      .patch(path)
      .auth('admin-uid', { type: 'bearer' })
      .send({
        status: 'ACTIVE',
        version: 0,
        reason: 'Restoring access after investigation.',
        isAdmin: true,
      })
      .expect(400);
  });
  it.each([
    { role: 'OWNER' },
    { userId: id },
    { email: 'invalid' },
    { reason: 'short' },
  ])('rejects forged team fields %j', async (override) => {
    await request(app.getHttpServer())
      .post(seller + '/team')
      .auth('seller', { type: 'bearer' })
      .send({
        email: 'manager@example.com',
        reason: 'Help with daily shop operations.',
        ...override,
      })
      .expect(400);
    expect(permissions.add).not.toHaveBeenCalled();
  });
  it('binds manager mutations to shop and member IDs', async () => {
    await request(app.getHttpServer())
      .post(seller + '/team')
      .auth('seller', { type: 'bearer' })
      .send({
        email: 'manager@example.com',
        reason: 'Help with daily shop operations.',
      })
      .expect(201);
    expect(permissions.add).toHaveBeenCalledWith(
      id,
      expect.objectContaining({ uid: 'seller' }),
      expect.objectContaining({ email: 'manager@example.com' }),
    );
    await request(app.getHttpServer())
      .delete(seller + `/team/${id}`)
      .auth('seller', { type: 'bearer' })
      .send({ reason: 'No longer assigned to manage this shop.' })
      .expect(200);
    expect(permissions.remove).toHaveBeenCalledWith(
      id,
      id,
      expect.objectContaining({ uid: 'seller' }),
      expect.anything(),
    );
  });
  const draft = {
    title: 'Cotton shirt',
    slug: 'cotton-shirt',
    description: 'Comfortable cotton shirt for daily use.',
    sku: 'SHIRT-1',
    categoryId: id,
    priceLkrMinor: 100000,
  };
  it('accepts structured product details and retains standard product workflow', async () => {
    await request(app.getHttpServer())
      .post(seller + '/products')
      .auth('seller', { type: 'bearer' })
      .send({
        ...draft,
        brand: 'Hela',
        warranty: 'Six months for manufacturing defects.',
        specifications: [{ name: 'Material', value: 'Cotton' }],
      })
      .expect(201);
    expect(catalog.createProduct).toHaveBeenCalledWith(
      id,
      expect.anything(),
      expect.objectContaining({
        brand: 'Hela',
        specifications: [{ name: 'Material', value: 'Cotton' }],
      }),
    );
  });
  it.each([
    { brand: null },
    { warranty: 'x'.repeat(501) },
    { specifications: null },
    { specifications: [null] },
    { specifications: [{ name: 'Material', value: '' }] },
    { specifications: [{ name: 'Material', value: 'Cotton', unsafe: 'x' }] },
    {
      specifications: [
        { name: 'Material', value: 'Cotton' },
        { name: 'material', value: 'Silk' },
      ],
    },
    {
      specifications: Array.from({ length: 21 }, (_, n) => ({
        name: 'Name' + n,
        value: 'Value',
      })),
    },
  ])('rejects invalid structured details %j', async (override) => {
    await request(app.getHttpServer())
      .post(seller + '/products')
      .auth('seller', { type: 'bearer' })
      .send({ ...draft, ...override })
      .expect(400);
    expect(catalog.createProduct).not.toHaveBeenCalled();
  });
  it('requires admin-only, explicit review report decisions', async () => {
    const path = admin + `/product-review-reports/${id}`,
      body = {
        action: 'HIDE',
        note: 'Reported feedback contains private information.',
      };
    await request(app.getHttpServer())
      .patch(path)
      .auth('buyer', { type: 'bearer' })
      .send(body)
      .expect(403);
    await request(app.getHttpServer())
      .patch(path)
      .auth('admin-uid', { type: 'bearer' })
      .send({ ...body, note: 'short' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(path)
      .auth('admin-uid', { type: 'bearer' })
      .send(body)
      .expect(200);
    expect(feedback.moderate).toHaveBeenCalledWith(
      id,
      expect.objectContaining({ uid: 'admin-uid' }),
      expect.objectContaining(body),
    );
  });
});
