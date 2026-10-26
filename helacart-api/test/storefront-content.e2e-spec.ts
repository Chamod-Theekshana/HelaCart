import { AccountAccessService } from '../src/auth/account-access.service.js';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { FirebaseAdminService } from '../src/auth/firebase-admin.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { configureApp } from '../src/configure-app.js';
import { ContentImageStorageService } from '../src/storefront-content/content-image-storage.service.js';
import { defaultHero } from '../src/storefront-content/hero-content.js';

describe('Category management and storefront publishing HTTP boundaries', () => {
  let app: INestApplication<Server>;
  const id = 'c68e7c7c-7ad8-40b8-b2a1-a76c9a7b931c',
    userId = '5720886d-9210-461c-9e93-d0176b019eed';
  const category = {
    id,
    name: 'Home',
    slug: 'home',
    description: null,
    sortOrder: 0,
    isActive: true,
    imageUrl: null,
    imageStorageKey: null,
    revision: 0,
    _count: { products: 2 },
  };
  const categoryDto = {
    name: 'Home & living',
    description: 'Everyday goods',
    sortOrder: 2,
    isActive: true,
    expectedRevision: 0,
  };
  const {
    desktopImageUrl: _desktop,
    mobileImageUrl: _mobile,
    ...text
  } = defaultHero;
  void _desktop;
  void _mobile;
  const heroDto = { ...text, title: 'Updated hero', expectedRevision: 0 };
  let hero: {
    draft: typeof defaultHero;
    published: typeof defaultHero;
    revision: number;
    publishedAt: Date | null;
    updatedAt: Date;
    publishedByUserId?: string;
  } | null;
  const database = {
    user: { upsert: vi.fn() },
    category: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    storefrontAppearance: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  const firebase = { verifyIdToken: vi.fn() },
    storage = { upload: vi.fn(), cleanup: vi.fn(), heroKey: vi.fn() };
  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(database)
      .overrideProvider(AccountAccessService)
      .useValue({ assertActive: async () => {} })
      .overrideProvider(FirebaseAdminService)
      .useValue(firebase)
      .overrideProvider(ContentImageStorageService)
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
    firebase.verifyIdToken.mockImplementation(
      (token: string, revoked?: boolean) =>
        token === 'revoked' && revoked
          ? Promise.reject(new Error('revoked'))
          : Promise.resolve({
              uid: token,
              email: `${token}@example.com`,
              email_verified: token !== 'unverified',
            }),
    );
    database.user.upsert.mockResolvedValue({ id: userId });
    database.category.findUnique.mockResolvedValue(category);
    database.category.findUniqueOrThrow.mockResolvedValue(category);
    database.category.findMany.mockResolvedValue([category]);
    database.category.count.mockResolvedValue(1);
    database.category.updateMany.mockResolvedValue({ count: 1 });
    database.category.deleteMany.mockResolvedValue({ count: 1 });
    database.category.create.mockResolvedValue(category);
    hero = {
      draft: { ...defaultHero },
      published: { ...defaultHero },
      revision: 0,
      publishedAt: null,
      updatedAt: new Date(),
    };
    database.storefrontAppearance.upsert.mockImplementation(() =>
      Promise.resolve(structuredClone(hero)),
    );
    database.storefrontAppearance.findUnique.mockImplementation(() =>
      Promise.resolve(structuredClone(hero)),
    );
    database.storefrontAppearance.findUniqueOrThrow.mockImplementation(() =>
      Promise.resolve(structuredClone(hero)),
    );
    database.storefrontAppearance.updateMany.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { revision: number };
        data: Record<string, unknown>;
      }) => {
        if (!hero || hero.revision !== where.revision)
          return Promise.resolve({ count: 0 });
        const { revision: _revision, ...rest } = data;
        void _revision;
        Object.assign(hero, structuredClone(rest));
        hero.revision++;
        return Promise.resolve({ count: 1 });
      },
    );
    database.$transaction.mockImplementation(
      (callback: (tx: typeof database) => unknown) => callback(database),
    );
    storage.upload.mockResolvedValue({
      imageUrl: 'https://images.example.com/storefront/hero/new.png',
      storageKey: 'storefront/hero/new.png',
    });
    storage.cleanup.mockResolvedValue(undefined);
    storage.heroKey.mockImplementation(
      (url: string | null) =>
        url?.split('https://images.example.com/')[1] ?? null,
    );
  });
  it('serves the existing hero defaults without creating an admin draft', async () => {
    hero = null;
    const response = await request(app.getHttpServer())
      .get('/api/v1/storefront/hero')
      .expect(200);
    expect(response.body).toEqual(defaultHero);
    expect(database.storefrontAppearance.upsert).not.toHaveBeenCalled();
  });
  it('exposes only published content to anonymous shoppers', async () => {
    hero!.draft.title = 'Private draft';
    hero!.publishedByUserId = userId;
    const response = await request(app.getHttpServer())
      .get('/api/v1/storefront/hero')
      .expect(200);
    expect(response.body.title).toBe(defaultHero.title);
    expect(response.body).not.toHaveProperty('draft');
    expect(response.body).not.toHaveProperty('publishedByUserId');
    expect(response.headers['cache-control']).toBe('no-store');
  });
  it.each(['/api/v1/admin/categories', '/api/v1/admin/storefront/hero'])(
    'protects admin reads: %s',
    async (path) => {
      await request(app.getHttpServer()).get(path).expect(401);
      await request(app.getHttpServer())
        .get(path)
        .auth('seller-uid', { type: 'bearer' })
        .expect(403);
      await request(app.getHttpServer())
        .get(path)
        .auth('revoked', { type: 'bearer' })
        .expect(401);
    },
  );
  it('protects category and hero writes from sellers', async () => {
    for (const path of [
      `/api/v1/admin/categories/${id}`,
      '/api/v1/admin/storefront/hero',
    ])
      await request(app.getHttpServer())
        .patch(path)
        .auth('seller-uid', { type: 'bearer' })
        .send({})
        .expect(403);
    expect(database.category.updateMany).not.toHaveBeenCalled();
  });
  it('lists archived categories with bounded pagination and product counts', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/categories?availability=archived&page=2&limit=10')
      .auth('admin-uid', { type: 'bearer' })
      .expect(200);
    expect(response.body.total).toBe(1);
    expect(database.category.findMany.mock.calls[0][0]).toMatchObject({
      where: { isActive: false },
      skip: 10,
      take: 10,
      select: { _count: { select: { products: true } } },
    });
    await request(app.getHttpServer())
      .get('/api/v1/admin/categories?limit=999')
      .auth('admin-uid', { type: 'bearer' })
      .expect(400);
  });
  it('edits category details and archives without changing the slug', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/categories/${id}`)
      .auth('admin-uid', { type: 'bearer' })
      .send({ ...categoryDto, isActive: false })
      .expect(200);
    expect(database.category.updateMany).toHaveBeenCalledWith({
      where: { id, revision: 0 },
      data: {
        name: categoryDto.name,
        description: categoryDto.description,
        sortOrder: 2,
        isActive: false,
        revision: { increment: 1 },
      },
    });
  });
  it('rejects slug changes and forged image URLs', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/categories/${id}`)
      .auth('admin-uid', { type: 'bearer' })
      .send({
        ...categoryDto,
        slug: 'new-url',
        imageUrl: 'https://untrusted.example/image.png',
      })
      .expect(400);
    expect(database.category.updateMany).not.toHaveBeenCalled();
  });
  it('rejects stale category edits', async () => {
    database.category.findUnique.mockResolvedValue({
      ...category,
      revision: 2,
    });
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/categories/${id}`)
      .auth('admin-uid', { type: 'bearer' })
      .send(categoryDto)
      .expect(409);
    expect(database.category.updateMany).not.toHaveBeenCalled();
  });
  it('deletes only an empty category at the expected revision', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/categories/${id}`)
      .auth('admin-uid', { type: 'bearer' })
      .send({ expectedRevision: 0 })
      .expect(200);
    expect(database.category.deleteMany).toHaveBeenCalledWith({
      where: { id, revision: 0, products: { none: {} } },
    });
  });
  it('blocks deletion of a populated or concurrently changed category', async () => {
    database.category.deleteMany.mockResolvedValue({ count: 0 });
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/categories/${id}`)
      .auth('admin-uid', { type: 'bearer' })
      .send({ expectedRevision: 0 })
      .expect(409);
    expect(storage.cleanup).not.toHaveBeenCalled();
  });
  it('uploads category images and cleans the new asset if a concurrent edit wins', async () => {
    database.category.updateMany.mockResolvedValue({ count: 0 });
    await request(app.getHttpServer())
      .post(`/api/v1/admin/categories/${id}/image?expectedRevision=0`)
      .auth('admin-uid', { type: 'bearer' })
      .set('Content-Type', 'image/png')
      .send(Buffer.from('fixture'))
      .expect(409);
    expect(storage.cleanup).toHaveBeenCalledWith('storefront/hero/new.png');
    expect(database.category.updateMany.mock.calls[0][0].data).toMatchObject({
      revision: { increment: 1 },
    });
  });
  it('saves draft text without changing published content or accepting arbitrary image URLs', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/admin/storefront/hero')
      .auth('admin-uid', { type: 'bearer' })
      .send(heroDto)
      .expect(200);
    expect(hero!.draft.title).toBe('Updated hero');
    expect(hero!.published.title).toBe(defaultHero.title);
    await request(app.getHttpServer())
      .patch('/api/v1/admin/storefront/hero')
      .auth('admin-uid', { type: 'bearer' })
      .send({
        ...heroDto,
        desktopImageUrl: 'https://untrusted.example/photo.png',
      })
      .expect(400);
  });
  it.each([
    'javascript:alert(1)',
    '//evil.example',
    '/admin',
    '/products/../admin',
  ])('rejects unsafe or unsupported hero links: %s', async (buttonHref) => {
    await request(app.getHttpServer())
      .patch('/api/v1/admin/storefront/hero')
      .auth('admin-uid', { type: 'bearer' })
      .send({ ...heroDto, buttonHref })
      .expect(400);
  });
  it('publishes a saved draft atomically with the authenticated publisher', async () => {
    hero!.draft.title = 'Ready to publish';
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/storefront/hero/publish')
      .auth('admin-uid', { type: 'bearer' })
      .send({ expectedRevision: 0 })
      .expect(201);
    expect(response.body.published.title).toBe('Ready to publish');
    expect(hero!.publishedByUserId).toBe(userId);
    expect(firebase.verifyIdToken).toHaveBeenCalledWith('admin-uid', true);
  });
  it('rejects stale publication', async () => {
    hero!.revision = 3;
    await request(app.getHttpServer())
      .post('/api/v1/admin/storefront/hero/publish')
      .auth('admin-uid', { type: 'bearer' })
      .send({ expectedRevision: 0 })
      .expect(409);
    expect(database.storefrontAppearance.updateMany).not.toHaveBeenCalled();
  });
  it('keeps the live image until the replacement draft is published', async () => {
    const old = 'https://images.example.com/storefront/hero/old.png';
    hero!.draft.desktopImageUrl = old;
    hero!.published.desktopImageUrl = old;
    await request(app.getHttpServer())
      .post('/api/v1/admin/storefront/hero/images/desktop?expectedRevision=0')
      .auth('admin-uid', { type: 'bearer' })
      .set('Content-Type', 'image/png')
      .send(Buffer.from('fixture'))
      .expect(201);
    expect(storage.cleanup).not.toHaveBeenCalledWith('storefront/hero/old.png');
    expect(hero!.published.desktopImageUrl).toBe(old);
    await request(app.getHttpServer())
      .post('/api/v1/admin/storefront/hero/publish')
      .auth('admin-uid', { type: 'bearer' })
      .send({ expectedRevision: 1 })
      .expect(201);
    expect(storage.cleanup).toHaveBeenCalledWith('storefront/hero/old.png');
  });
  it('returns not found for missing categories', async () => {
    database.category.findUnique.mockResolvedValue(null);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/categories/${id}`)
      .auth('admin-uid', { type: 'bearer' })
      .send(categoryDto)
      .expect(404);
  });
});
