import { AccountAccessService } from '../src/auth/account-access.service.js';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { FirebaseAdminService } from '../src/auth/firebase-admin.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { FavoritesService } from '../src/favorites/favorites.service.js';
import { configureApp } from '../src/configure-app.js';
describe('Favorites HTTP boundaries', () => {
  let app: INestApplication;
  const id = 'd63c76f1-3fe0-4d78-bbad-48c37ad630ad';
  const favorites = {
    summary: vi.fn(),
    list: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
  };
  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ imports: [AppModule] })
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
      .overrideProvider(FavoritesService)
      .useValue(favorites)
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
    favorites.summary.mockResolvedValue({ items: [], total: 0 });
    favorites.list.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pages: 1,
      pageSize: 12,
    });
    favorites.save.mockResolvedValue({ id, productId: id });
    favorites.remove.mockResolvedValue({ removed: true });
  });
  it.each([
    ['get', '/me/favorites'],
    ['get', '/me/favorites/summary'],
    ['put', `/me/favorites/products/${id}`],
    ['delete', `/me/favorites/${id}`],
  ])('requires authentication for %s %s', async (method, path) => {
    await request(app.getHttpServer())
      [method as 'get']('/api/v1' + path)
      .expect(401);
  });
  it('rejects expired tokens', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/me/favorites')
      .set('Authorization', 'Bearer expired')
      .expect(401);
    expect(favorites.list).not.toHaveBeenCalled();
  });
  it('allows signed-in unverified users to save without enabling checkout', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/me/favorites/products/' + id)
      .set('Authorization', 'Bearer unverified')
      .expect(200);
    expect(favorites.save).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'unverified', email_verified: false }),
      id,
    );
  });
  it.each([
    'page=0',
    'page=1.5',
    'page=10001',
    'limit=0',
    'limit=51',
    'limit=abc',
    'userId=someone',
  ])('validates pagination/scope: %s', async (query) => {
    await request(app.getHttpServer())
      .get('/api/v1/me/favorites?' + query)
      .set('Authorization', 'Bearer buyer')
      .expect(400);
    expect(favorites.list).not.toHaveBeenCalled();
  });
  it.each([
    ['put', '/me/favorites/products/no-id'],
    ['delete', '/me/favorites/no-id'],
  ])('validates UUIDs: %s %s', async (method, path) => {
    await request(app.getHttpServer())
      [method as 'put']('/api/v1' + path)
      .set('Authorization', 'Bearer buyer')
      .expect(400);
  });
  it('passes normalized pages and prevents private caching', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/me/favorites?page=2&limit=8')
      .set('Authorization', 'Bearer buyer')
      .expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(favorites.list).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'buyer' }),
      expect.objectContaining({ page: 2, limit: 8 }),
    );
  });
  it('provides the private saved-item summary', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/me/favorites/summary')
      .set('Authorization', 'Bearer buyer')
      .expect('Cache-Control', 'no-store')
      .expect(200);
  });
});
