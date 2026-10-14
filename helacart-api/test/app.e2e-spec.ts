import { Test } from '@nestjs/testing';
import { Body, Controller, type INestApplication, Post } from '@nestjs/common';
import { IsString } from 'class-validator';
import request from 'supertest';
import type { Server } from 'node:http';
import { AppModule } from '../src/app.module.js';
import { FirebaseAdminService } from '../src/auth/firebase-admin.service.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { Prisma } from '../src/generated/prisma/client.js';

class ProbeDto {
  @IsString()
  name!: string;
}

// Test-only endpoint exercises the actual application's global validation.
@Controller('validation-probe')
class ValidationProbeController {
  @Post()
  submit(@Body() dto: ProbeDto) {
    return dto;
  }
}

describe('API HTTP behavior (database mocked)', () => {
  let app: INestApplication<Server>;
  const sellerId = 'c68e7c7c-7ad8-40b8-b2a1-a76c9a7b931c';
  const userId = '5720886d-9210-461c-9e93-d0176b019eed';
  const productId = 'fd72a1b7-a16e-43f8-bf99-6e84f0e7db57';
  const categoryId = '44a84ea8-e101-467f-b6ec-3c54cf953348';
  const otherSellerId = '0daa6d81-a735-436d-afad-1a999c283a9e';
  const owner = {
    uid: 'seller-uid',
    email: 'seller@example.com',
    email_verified: true,
  };
  const administrator = {
    uid: 'admin-uid',
    email: 'admin@example.com',
    email_verified: true,
  };
  const application = {
    name: 'Island Crafts',
    slug: 'island-crafts',
    contactPhone: '0771234567',
    pickupAddress: '12 Main Street, Colombo 03',
  };
  const pendingSeller = {
    id: sellerId,
    ...application,
    description: null,
    status: 'PENDING',
    reviews: [],
  };
  const productDraft = {
    id: productId,
    sellerId,
    categoryId,
    title: 'Handmade Basket',
    slug: 'handmade-basket',
    description: 'Handmade woven basket from Sri Lanka',
    sku: 'BASKET-001',
    priceLkrMinor: 125000,
    imageUrls: ['https://images.example.com/basket.jpg'],
    status: 'DRAFT',
    reviews: [],
  };
  const productInput = {
    title: productDraft.title,
    slug: productDraft.slug,
    description: productDraft.description,
    sku: productDraft.sku,
    categoryId,
    priceLkrMinor: productDraft.priceLkrMinor,
    imageUrls: productDraft.imageUrls,
  };
  const database = {
    checkConnection: vi.fn(),
    user: { upsert: vi.fn() },
    seller: {
      create: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    sellerReview: { create: vi.fn() },
    sellerMember: { findUnique: vi.fn() },
    category: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    product: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
    },
    productReview: { create: vi.fn() },
    productVariant: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    },
    inventoryMovement: { create: vi.fn(), findMany: vi.fn() },
    inventoryReservation: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    buyerAddress: {
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    cartItem: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    sellerOrder: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    sellerOrderEvent: { create: vi.fn() },
    notification: { findMany: vi.fn(), updateMany: vi.fn() },
    returnRequest: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  };
  const firebase = { verifyIdToken: vi.fn() };

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ValidationProbeController],
    })
      .overrideProvider(PrismaService)
      .useValue(database)
      .overrideProvider(FirebaseAdminService)
      .useValue(firebase)
      .compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  beforeEach(() => {
    database.checkConnection.mockReset().mockResolvedValue(undefined);
    database.user.upsert.mockReset();
    database.user.upsert.mockResolvedValue({ id: userId });
    for (const mock of Object.values(database.seller)) mock.mockReset();
    database.sellerReview.create.mockReset();
    database.sellerMember.findUnique.mockReset();
    for (const mock of Object.values(database.category)) mock.mockReset();
    for (const mock of Object.values(database.product)) mock.mockReset();
    database.productReview.create.mockReset();
    for (const mock of Object.values(database.productVariant)) mock.mockReset();
    for (const mock of Object.values(database.inventoryMovement))
      mock.mockReset();
    for (const mock of Object.values(database.inventoryReservation))
      mock.mockReset();
    for (const mock of Object.values(database.buyerAddress)) mock.mockReset();
    for (const mock of Object.values(database.cartItem)) mock.mockReset();
    for (const mock of Object.values(database.order)) mock.mockReset();
    for (const mock of Object.values(database.sellerOrder)) mock.mockReset();
    for (const mock of Object.values(database.sellerOrderEvent))
      mock.mockReset();
    for (const mock of Object.values(database.notification)) mock.mockReset();
    for (const mock of Object.values(database.returnRequest)) mock.mockReset();
    database.$queryRaw.mockReset();
    database.$transaction.mockReset();
    database.$transaction.mockImplementation(
      (callback: (tx: typeof database) => unknown) => callback(database),
    );
    firebase.verifyIdToken.mockReset();
  });
  afterAll(async () => {
    await app.close();
  });

  it('serves liveness on the versioned route without querying the database', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);
    expect(response.body).toEqual({ status: 'ok', service: 'helacart-api' });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(database.checkConnection).not.toHaveBeenCalled();
  });

  it('checks the database for readiness', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(200)
      .expect({ status: 'ok', service: 'helacart-api', database: 'connected' });
    expect(database.checkConnection).toHaveBeenCalledOnce();
  });

  it('returns 503 without exposing driver credentials on database failure', async () => {
    database.checkConnection.mockRejectedValue(
      new Error('postgresql://admin:secret-password@private-host/db'),
    );
    const response = await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(503);
    expect(response.body).toEqual({ status: 'error', database: 'unavailable' });
    expect(response.text).not.toContain('secret-password');
    expect(response.text).not.toContain('private-host');
  });

  it('does not expose an unversioned health route', async () => {
    await request(app.getHttpServer()).get('/health').expect(404);
  });

  it('allows configured browser origins and sends security headers', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'http://localhost:3000')
      .expect(200);
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000',
    );
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('does not grant CORS access to an unlisted origin', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'https://untrusted.example')
      .expect(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('handles authorization-header preflight', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/v1/health')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization')
      .expect(204);
    expect(response.headers['access-control-allow-headers']).toContain(
      'Authorization',
    );
  });

  it('rejects unknown fields and incorrect DTO types', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/validation-probe')
      .send({ name: 'Test', role: 'ADMIN' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/validation-probe')
      .send({ name: 123 })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/validation-probe')
      .send({ name: 'Test' })
      .expect(201)
      .expect({ name: 'Test' });
  });

  it('rejects a protected route when its bearer token is missing', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    expect(firebase.verifyIdToken).not.toHaveBeenCalled();
    expect(database.user.upsert).not.toHaveBeenCalled();
  });

  it('rejects invalid Firebase ID tokens', async () => {
    firebase.verifyIdToken.mockRejectedValue(new Error('expired token'));
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401)
      .expect(({ body }) => {
        expect(body.message).toBe('Invalid or expired Firebase token');
      });
    expect(database.user.upsert).not.toHaveBeenCalled();
  });

  it('rejects an authenticated Firebase identity without an email', async () => {
    firebase.verifyIdToken.mockResolvedValue({ uid: 'firebase-no-email' });
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer valid-token')
      .expect(401)
      .expect(({ body }) => {
        expect(body.message).toBe('Firebase account must have an email');
      });
    expect(database.user.upsert).not.toHaveBeenCalled();
  });

  it('verifies the token and synchronizes the HelaCart profile', async () => {
    const profile = {
      id: '5720886d-9210-461c-9e93-d0176b019eed',
      firebaseUid: 'firebase-user-1',
      email: 'buyer@example.com',
      emailVerified: true,
      name: 'Buyer',
      createdAt: '2026-10-13T00:00:00.000Z',
      updatedAt: '2026-10-13T00:00:00.000Z',
      memberships: [],
    };
    firebase.verifyIdToken.mockResolvedValue({
      uid: 'firebase-user-1',
      email: 'buyer@example.com',
      email_verified: true,
      name: '  Buyer  ',
    });
    database.user.upsert.mockResolvedValue(profile);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', 'bearer valid-token')
      .expect(200)
      .expect(profile)
      .expect('Cache-Control', 'no-store');

    expect(firebase.verifyIdToken).toHaveBeenCalledWith('valid-token');
    expect(database.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { firebaseUid: 'firebase-user-1' },
        create: expect.objectContaining({
          firebaseUid: 'firebase-user-1',
          email: 'buyer@example.com',
          emailVerified: true,
          name: 'Buyer',
        }),
      }),
    );
  });

  it('rejects unauthenticated and unverified seller applications', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/seller-applications')
      .send(application)
      .expect(401);
    firebase.verifyIdToken.mockResolvedValue({
      ...owner,
      email_verified: false,
    });
    await request(app.getHttpServer())
      .post('/api/v1/seller-applications')
      .set('Authorization', 'Bearer valid-token')
      .send(application)
      .expect(403);
    expect(database.seller.create).not.toHaveBeenCalled();
  });

  it('validates application input and creates a pending seller with its owner', async () => {
    firebase.verifyIdToken.mockResolvedValue(owner);
    await request(app.getHttpServer())
      .post('/api/v1/seller-applications')
      .set('Authorization', 'Bearer valid-token')
      .send({ ...application, slug: 'Invalid Slug', status: 'APPROVED' })
      .expect(400);
    expect(database.seller.create).not.toHaveBeenCalled();
    database.seller.create.mockResolvedValue(pendingSeller);
    await request(app.getHttpServer())
      .post('/api/v1/seller-applications')
      .set('Authorization', 'Bearer valid-token')
      .send({ ...application, name: '  Island Crafts  ' })
      .expect(201)
      .expect(pendingSeller);
    expect(database.seller.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Island Crafts',
          slug: 'island-crafts',
          members: { create: { userId, role: 'OWNER' } },
        }),
      }),
    );
  });

  it('returns only applications owned by the signed-in user', async () => {
    firebase.verifyIdToken.mockResolvedValue(owner);
    database.seller.findMany.mockResolvedValue([pendingSeller]);
    await request(app.getHttpServer())
      .get('/api/v1/seller-applications/me')
      .set('Authorization', 'Bearer valid-token')
      .expect(200)
      .expect([pendingSeller]);
    expect(database.seller.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { members: { some: { userId, role: 'OWNER' } } },
      }),
    );
  });

  it('forbids non-admins and unverified admins from reviewing applications', async () => {
    firebase.verifyIdToken.mockResolvedValue(owner);
    await request(app.getHttpServer())
      .get('/api/v1/admin/seller-applications')
      .set('Authorization', 'Bearer valid-token')
      .expect(403);
    firebase.verifyIdToken.mockResolvedValue({
      ...administrator,
      email_verified: false,
    });
    await request(app.getHttpServer())
      .get('/api/v1/admin/seller-applications')
      .set('Authorization', 'Bearer valid-token')
      .expect(403);
    expect(database.seller.findMany).not.toHaveBeenCalled();
  });

  it('rechecks admin token revocation and rejects revoked tokens', async () => {
    firebase.verifyIdToken.mockImplementation(
      (_token: string, checkRevoked?: boolean) =>
        checkRevoked
          ? Promise.reject(new Error('revoked'))
          : Promise.resolve(administrator),
    );
    await request(app.getHttpServer())
      .get('/api/v1/admin/seller-applications')
      .set('Authorization', 'Bearer revoked-token')
      .expect(401);
    expect(database.seller.findMany).not.toHaveBeenCalled();
  });

  it('lists pending applications for a verified admin and rejects invalid filters', async () => {
    firebase.verifyIdToken.mockResolvedValue(administrator);
    database.seller.findMany.mockResolvedValue([pendingSeller]);
    await request(app.getHttpServer())
      .get('/api/v1/admin/seller-applications')
      .set('Authorization', 'Bearer valid-token')
      .expect(200)
      .expect([pendingSeller]);
    expect(database.seller.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'PENDING' } }),
    );
    await request(app.getHttpServer())
      .get('/api/v1/admin/seller-applications?status=ANY')
      .set('Authorization', 'Bearer valid-token')
      .expect(400);
  });

  it('approves once and records a reviewer in the same transaction', async () => {
    firebase.verifyIdToken.mockResolvedValue(administrator);
    database.seller.updateMany.mockResolvedValue({ count: 1 });
    database.sellerReview.create.mockResolvedValue({ id: 'review-id' });
    database.seller.findUniqueOrThrow.mockResolvedValue({
      ...pendingSeller,
      status: 'APPROVED',
    });
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/seller-applications/${sellerId}/approve`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200)
      .expect({ ...pendingSeller, status: 'APPROVED' });
    expect(database.$transaction).toHaveBeenCalledOnce();
    expect(database.seller.updateMany).toHaveBeenCalledWith({
      where: { id: sellerId, status: 'PENDING' },
      data: { status: 'APPROVED' },
    });
    expect(database.sellerReview.create).toHaveBeenCalledWith({
      data: {
        sellerId,
        reviewerUserId: userId,
        decision: 'APPROVED',
        reason: null,
      },
    });
    expect(firebase.verifyIdToken).toHaveBeenCalledWith('valid-token', true);
  });

  it('does not write an audit record when an application is already reviewed', async () => {
    firebase.verifyIdToken.mockResolvedValue(administrator);
    database.seller.updateMany.mockResolvedValue({ count: 0 });
    database.seller.findUnique.mockResolvedValue({ id: sellerId });
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/seller-applications/${sellerId}/approve`)
      .set('Authorization', 'Bearer valid-token')
      .expect(409);
    expect(database.sellerReview.create).not.toHaveBeenCalled();
  });

  it('rejects an application with a required reason and records the decision', async () => {
    firebase.verifyIdToken.mockResolvedValue(administrator);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/seller-applications/${sellerId}/reject`)
      .set('Authorization', 'Bearer valid-token')
      .send({ reason: 'short' })
      .expect(400);
    database.seller.updateMany.mockResolvedValue({ count: 1 });
    database.sellerReview.create.mockResolvedValue({ id: 'review-id' });
    database.seller.findUniqueOrThrow.mockResolvedValue({
      ...pendingSeller,
      status: 'REJECTED',
    });
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/seller-applications/${sellerId}/reject`)
      .set('Authorization', 'Bearer valid-token')
      .send({ reason: 'Missing contact information' })
      .expect(200);
    expect(database.sellerReview.create).toHaveBeenCalledWith({
      data: {
        sellerId,
        reviewerUserId: userId,
        decision: 'REJECTED',
        reason: 'Missing contact information',
      },
    });
  });

  it('allows only a verified admin to add a category', async () => {
    firebase.verifyIdToken.mockResolvedValue(owner);
    await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', 'Bearer seller-token')
      .send({ name: 'Home', slug: 'home' })
      .expect(403);
    firebase.verifyIdToken.mockResolvedValue(administrator);
    await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'Home', slug: 'Invalid Slug' })
      .expect(400);
    database.category.create.mockResolvedValue({
      id: categoryId,
      name: 'Home',
      slug: 'home',
    });
    await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: '  Home  ', slug: 'home' })
      .expect(201)
      .expect({ id: categoryId, name: 'Home', slug: 'home' });
    expect(database.category.create).toHaveBeenCalledWith({
      data: { name: 'Home', slug: 'home' },
    });
    expect(firebase.verifyIdToken).toHaveBeenCalledWith('admin-token', true);
  });

  it('filters public products by approved seller, active category and status', async () => {
    database.product.findMany.mockResolvedValue([
      { id: productId, title: productDraft.title },
    ]);
    await request(app.getHttpServer())
      .get('/api/v1/products?category=home&q=basket&limit=10')
      .expect(200)
      .expect({
        items: [{ id: productId, title: productDraft.title, variants: [] }],
        nextCursor: null,
      });
    expect(database.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'APPROVED',
          seller: { status: 'APPROVED' },
          category: { isActive: true, slug: 'home' },
          title: { contains: 'basket', mode: 'insensitive' },
        },
        take: 11,
      }),
    );
    await request(app.getHttpServer())
      .get('/api/v1/products?limit=999')
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/products?cursor=bad')
      .expect(400);
    database.product.findFirst.mockResolvedValue(null);
    await request(app.getHttpServer())
      .get(`/api/v1/products/${productId}`)
      .expect(404);
    expect(database.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: productId,
          status: 'APPROVED',
          seller: { status: 'APPROVED' },
          category: { isActive: true },
        },
      }),
    );
  });

  it('requires verified membership and approved seller status to write products', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/sellers/${sellerId}/products`)
      .send(productInput)
      .expect(401);
    firebase.verifyIdToken.mockResolvedValue({
      ...owner,
      email_verified: false,
    });
    await request(app.getHttpServer())
      .post(`/api/v1/sellers/${sellerId}/products`)
      .set('Authorization', 'Bearer seller-token')
      .send(productInput)
      .expect(403);
    firebase.verifyIdToken.mockResolvedValue(owner);
    database.sellerMember.findUnique.mockResolvedValue(null);
    await request(app.getHttpServer())
      .post(`/api/v1/sellers/${sellerId}/products`)
      .set('Authorization', 'Bearer seller-token')
      .send(productInput)
      .expect(403);
    expect(database.sellerMember.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sellerId_userId: { sellerId, userId } },
      }),
    );
    database.sellerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      seller: { status: 'PENDING' },
    });
    await request(app.getHttpServer())
      .post(`/api/v1/sellers/${sellerId}/products`)
      .set('Authorization', 'Bearer seller-token')
      .send(productInput)
      .expect(403);
    expect(database.product.create).not.toHaveBeenCalled();
  });

  it('validates a draft and creates it for the authorized seller only', async () => {
    firebase.verifyIdToken.mockResolvedValue(owner);
    database.sellerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      seller: { status: 'APPROVED' },
    });
    await request(app.getHttpServer())
      .post(`/api/v1/sellers/${sellerId}/products`)
      .set('Authorization', 'Bearer seller-token')
      .send({
        ...productInput,
        imageUrls: ['http://insecure.example/a.jpg'],
        status: 'APPROVED',
      })
      .expect(400);
    database.category.findUnique.mockResolvedValue({ isActive: true });
    database.product.create.mockResolvedValue(productDraft);
    await request(app.getHttpServer())
      .post(`/api/v1/sellers/${sellerId}/products`)
      .set('Authorization', 'Bearer seller-token')
      .send({ ...productInput, title: '  Handmade Basket  ' })
      .expect(201)
      .expect(productDraft);
    expect(database.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sellerId,
          title: 'Handmade Basket',
          status: 'DRAFT',
          priceLkrMinor: 125000,
        }),
      }),
    );
  });

  it('scopes private list and detail queries to the member seller', async () => {
    firebase.verifyIdToken.mockResolvedValue(owner);
    database.sellerMember.findUnique.mockResolvedValue({
      role: 'MANAGER',
      seller: { status: 'APPROVED' },
    });
    database.product.findMany.mockResolvedValue([productDraft]);
    await request(app.getHttpServer())
      .get(`/api/v1/sellers/${sellerId}/products?status=DRAFT`)
      .set('Authorization', 'Bearer seller-token')
      .expect(200)
      .expect([productDraft]);
    expect(database.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sellerId, status: 'DRAFT' } }),
    );
    database.product.findFirst.mockResolvedValue(productDraft);
    await request(app.getHttpServer())
      .get(`/api/v1/sellers/${sellerId}/products/${productId}`)
      .set('Authorization', 'Bearer seller-token')
      .expect(200);
    expect(database.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: productId, sellerId } }),
    );
    database.sellerMember.findUnique.mockResolvedValue(null);
    await request(app.getHttpServer())
      .get(`/api/v1/sellers/${otherSellerId}/products/${productId}`)
      .set('Authorization', 'Bearer seller-token')
      .expect(403);
  });

  it('removes an approved product from public view when a member edits it', async () => {
    firebase.verifyIdToken.mockResolvedValue(owner);
    database.sellerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      seller: { status: 'APPROVED' },
    });
    database.product.updateMany.mockResolvedValue({ count: 1 });
    database.product.findUniqueOrThrow.mockResolvedValue(productDraft);
    await request(app.getHttpServer())
      .patch(`/api/v1/sellers/${sellerId}/products/${productId}`)
      .set('Authorization', 'Bearer seller-token')
      .send({ title: 'New Basket Title' })
      .expect(200)
      .expect(productDraft);
    expect(database.product.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: productId,
          sellerId,
          seller: { status: 'APPROVED' },
        }),
        data: { title: 'New Basket Title', status: 'DRAFT' },
      }),
    );
    database.product.updateMany.mockResolvedValue({ count: 0 });
    database.product.findFirst.mockResolvedValue({ id: productId });
    await request(app.getHttpServer())
      .patch(`/api/v1/sellers/${sellerId}/products/${productId}`)
      .set('Authorization', 'Bearer seller-token')
      .send({ title: 'New Basket Title' })
      .expect(409);
  });

  it('submits an image-bearing draft once and hides an approved product', async () => {
    firebase.verifyIdToken.mockResolvedValue(owner);
    database.sellerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      seller: { status: 'APPROVED' },
    });
    database.product.findFirst.mockResolvedValueOnce({
      id: productId,
      imageUrls: [],
    });
    await request(app.getHttpServer())
      .post(`/api/v1/sellers/${sellerId}/products/${productId}/submit`)
      .set('Authorization', 'Bearer seller-token')
      .expect(400);
    database.product.findFirst.mockResolvedValue({
      id: productId,
      imageUrls: productDraft.imageUrls,
    });
    database.product.updateMany.mockResolvedValue({ count: 1 });
    database.product.findUniqueOrThrow.mockResolvedValue({
      ...productDraft,
      status: 'PENDING',
    });
    await request(app.getHttpServer())
      .post(`/api/v1/sellers/${sellerId}/products/${productId}/submit`)
      .set('Authorization', 'Bearer seller-token')
      .expect(201);
    expect(database.product.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: productId,
          sellerId,
          category: { isActive: true },
          status: { in: ['DRAFT', 'REJECTED'] },
        }),
        data: { status: 'PENDING' },
      }),
    );
    database.product.findUniqueOrThrow.mockResolvedValue({
      ...productDraft,
      status: 'HIDDEN',
    });
    await request(app.getHttpServer())
      .patch(`/api/v1/sellers/${sellerId}/products/${productId}/hide`)
      .set('Authorization', 'Bearer seller-token')
      .expect(200);
    expect(database.product.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'APPROVED' }),
        data: { status: 'HIDDEN' },
      }),
    );
  });

  it('permits only an admin to approve a pending product with an audit record', async () => {
    firebase.verifyIdToken.mockResolvedValue(owner);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/products/${productId}/approve`)
      .set('Authorization', 'Bearer seller-token')
      .expect(403);
    firebase.verifyIdToken.mockResolvedValue(administrator);
    database.product.findUnique.mockResolvedValue({
      status: 'PENDING',
      imageUrls: productDraft.imageUrls,
    });
    database.product.updateMany.mockResolvedValue({ count: 1 });
    database.productReview.create.mockResolvedValue({ id: 'review-id' });
    database.product.findUniqueOrThrow.mockResolvedValue({
      ...productDraft,
      status: 'APPROVED',
    });
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/products/${productId}/approve`)
      .set('Authorization', 'Bearer admin-token')
      .expect(200);
    expect(database.product.updateMany).toHaveBeenCalledWith({
      where: {
        id: productId,
        status: 'PENDING',
        seller: { status: 'APPROVED' },
        category: { isActive: true },
      },
      data: { status: 'APPROVED' },
    });
    expect(database.productReview.create).toHaveBeenCalledWith({
      data: {
        productId,
        reviewerUserId: userId,
        decision: 'APPROVED',
        reason: null,
      },
    });
  });

  it('requires a reason for rejection and disallows repeated reviews', async () => {
    firebase.verifyIdToken.mockResolvedValue(administrator);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/products/${productId}/reject`)
      .set('Authorization', 'Bearer admin-token')
      .send({ reason: 'short' })
      .expect(400);
    database.product.findUnique.mockResolvedValue({
      status: 'PENDING',
      imageUrls: productDraft.imageUrls,
    });
    database.product.updateMany.mockResolvedValue({ count: 1 });
    database.product.findUniqueOrThrow.mockResolvedValue({
      ...productDraft,
      status: 'REJECTED',
    });
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/products/${productId}/reject`)
      .set('Authorization', 'Bearer admin-token')
      .send({ reason: 'Product image does not match listing' })
      .expect(200);
    expect(database.productReview.create).toHaveBeenCalledWith({
      data: {
        productId,
        reviewerUserId: userId,
        decision: 'REJECTED',
        reason: 'Product image does not match listing',
      },
    });
    database.product.findUnique.mockResolvedValue({
      status: 'APPROVED',
      imageUrls: productDraft.imageUrls,
    });
    database.productReview.create.mockClear();
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/products/${productId}/approve`)
      .set('Authorization', 'Bearer admin-token')
      .expect(409);
    expect(database.productReview.create).not.toHaveBeenCalled();
  });

  it('rejects invalid catalog input and inactive categories', async () => {
    firebase.verifyIdToken.mockResolvedValue(owner);
    database.sellerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      seller: { status: 'APPROVED' },
    });
    await request(app.getHttpServer())
      .post(`/api/v1/sellers/${sellerId}/products`)
      .set('Authorization', 'Bearer seller-token')
      .send({ ...productInput, imageUrls: ['http://example.com/image.jpg'] })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/v1/sellers/${sellerId}/products`)
      .set('Authorization', 'Bearer seller-token')
      .send({ ...productInput, priceLkrMinor: -50 })
      .expect(400);
    database.category.findUnique.mockResolvedValue({ isActive: false });
    await request(app.getHttpServer())
      .post(`/api/v1/sellers/${sellerId}/products`)
      .set('Authorization', 'Bearer seller-token')
      .send(productInput)
      .expect(400);
    expect(database.product.create).not.toHaveBeenCalled();
  });

  it('returns a conflict for a seller-duplicate product slug or SKU', async () => {
    firebase.verifyIdToken.mockResolvedValue(owner);
    database.sellerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      seller: { status: 'APPROVED' },
    });
    database.category.findUnique.mockResolvedValue({ isActive: true });
    database.product.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '7.10.0',
      }),
    );
    await request(app.getHttpServer())
      .post(`/api/v1/sellers/${sellerId}/products`)
      .set('Authorization', 'Bearer seller-token')
      .send(productInput)
      .expect(409);
  });

  it('does not audit approval when the seller is no longer approved', async () => {
    firebase.verifyIdToken.mockResolvedValue(administrator);
    database.product.findUnique.mockResolvedValue({
      status: 'PENDING',
      imageUrls: productDraft.imageUrls,
    });
    database.product.updateMany.mockResolvedValue({ count: 0 });
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/products/${productId}/approve`)
      .set('Authorization', 'Bearer admin-token')
      .expect(409);
    expect(database.productReview.create).not.toHaveBeenCalled();
  });

  it('paginates public catalog results and protects the admin queue', async () => {
    database.product.findMany.mockResolvedValue(
      Array.from({ length: 21 }, (_, i) => ({
        id: `product-${i}`,
        title: 'Basket',
      })),
    );
    const page = await request(app.getHttpServer())
      .get('/api/v1/products?limit=20')
      .expect(200);
    expect(page.body.items).toHaveLength(20);
    expect(page.body.nextCursor).toBe('product-19');
    firebase.verifyIdToken.mockResolvedValue(owner);
    await request(app.getHttpServer())
      .get('/api/v1/admin/products')
      .set('Authorization', 'Bearer seller-token')
      .expect(403);
    firebase.verifyIdToken.mockResolvedValue(administrator);
    database.product.findMany.mockResolvedValue([productDraft]);
    await request(app.getHttpServer())
      .get('/api/v1/admin/products?status=PENDING')
      .set('Authorization', 'Bearer admin-token')
      .expect(200)
      .expect([productDraft]);
    await request(app.getHttpServer())
      .get('/api/v1/admin/products?status=UNLISTED')
      .set('Authorization', 'Bearer admin-token')
      .expect(400);
  });

  it('requires seller membership and validates variant options before changing a listing', async () => {
    const path = `/api/v1/sellers/${sellerId}/products/${productId}/variants`;
    const input = {
      position: 1,
      sku: 'BASKET-LARGE',
      priceLkrMinor: 155000,
      optionValues: { size: 'Large' },
    };
    await request(app.getHttpServer()).post(path).send(input).expect(401);
    firebase.verifyIdToken.mockResolvedValue(owner);
    database.sellerMember.findUnique.mockResolvedValue(null);
    await request(app.getHttpServer())
      .post(path)
      .set('Authorization', 'Bearer seller-token')
      .send(input)
      .expect(403);
    database.sellerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      seller: { status: 'APPROVED' },
    });
    await request(app.getHttpServer())
      .post(path)
      .set('Authorization', 'Bearer seller-token')
      .send({ ...input, optionValues: { size: ['Large'] } })
      .expect(400);
    expect(database.product.updateMany).not.toHaveBeenCalled();
    database.product.updateMany.mockResolvedValue({ count: 1 });
    database.productVariant.create.mockResolvedValue({
      id: 'new-variant',
      ...input,
    });
    await request(app.getHttpServer())
      .post(path)
      .set('Authorization', 'Bearer seller-token')
      .send(input)
      .expect(201);
    expect(database.product.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'DRAFT' } }),
    );
    expect(database.productVariant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sellerId,
          productId,
          sku: 'BASKET-LARGE',
        }),
      }),
    );
  });

  it('atomically audits a seller stock change and rejects adjustments below reserved stock', async () => {
    const variantId = 'ba423ed7-8e75-43c7-9712-1073d78e67ab';
    const path = `/api/v1/sellers/${sellerId}/products/${productId}/variants/${variantId}/stock-adjustments`;
    firebase.verifyIdToken.mockResolvedValue(owner);
    database.sellerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      seller: { status: 'APPROVED' },
    });
    await request(app.getHttpServer())
      .post(path)
      .set('Authorization', 'Bearer seller-token')
      .send({ delta: 0, reason: 'Counted stock' })
      .expect(400);
    database.$queryRaw.mockResolvedValueOnce([
      { id: variantId, onHand: 10, reserved: 3 },
    ]);
    await request(app.getHttpServer())
      .post(path)
      .set('Authorization', 'Bearer seller-token')
      .send({ delta: 10, reason: 'Opening stock count' })
      .expect(201)
      .expect({ id: variantId, onHand: 10, reserved: 3, availableQuantity: 7 });
    expect(database.inventoryMovement.create).toHaveBeenCalledWith({
      data: {
        variantId,
        actorUserId: userId,
        delta: 10,
        reason: 'Opening stock count',
      },
    });
    database.$queryRaw.mockResolvedValueOnce([]);
    database.productVariant.findFirst.mockResolvedValue({ id: variantId });
    await request(app.getHttpServer())
      .post(path)
      .set('Authorization', 'Bearer seller-token')
      .send({ delta: -9, reason: 'Stock correction' })
      .expect(409);
    expect(database.inventoryMovement.create).toHaveBeenCalledTimes(1);
    database.sellerMember.findUnique.mockResolvedValue(null);
    await request(app.getHttpServer())
      .post(path)
      .set('Authorization', 'Bearer seller-token')
      .send({ delta: 1, reason: 'Stock correction' })
      .expect(403);
  });

  it('updates the legacy product SKU and default variant SKU together', async () => {
    firebase.verifyIdToken.mockResolvedValue(owner);
    database.sellerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      seller: { status: 'APPROVED' },
    });
    database.product.updateMany.mockResolvedValue({ count: 1 });
    database.productVariant.updateMany.mockResolvedValue({ count: 1 });
    database.product.findUniqueOrThrow.mockResolvedValue({
      ...productDraft,
      sku: 'BASKET-NEW',
    });
    await request(app.getHttpServer())
      .patch(`/api/v1/sellers/${sellerId}/products/${productId}`)
      .set('Authorization', 'Bearer seller-token')
      .send({ sku: 'BASKET-NEW' })
      .expect(200);
    expect(database.$transaction).toHaveBeenCalledOnce();
    expect(database.productVariant.updateMany).toHaveBeenCalledWith({
      where: { productId, sellerId, position: 0 },
      data: { sku: 'BASKET-NEW', priceLkrMinor: undefined },
    });
  });

  it('returns available quantity without raw stock counts in the public catalog', async () => {
    database.product.findMany.mockResolvedValue([
      {
        id: productId,
        variants: [
          {
            id: 'variant-id',
            position: 0,
            sku: 'BASKET-001',
            optionValues: {},
            priceLkrMinor: 125000,
            onHand: 7,
            reserved: 2,
          },
        ],
      },
    ]);
    const response = await request(app.getHttpServer())
      .get('/api/v1/products')
      .expect(200);
    expect(response.body.items[0].variants[0]).toMatchObject({
      availableQuantity: 5,
    });
    expect(response.body.items[0].variants[0]).not.toHaveProperty('onHand');
    expect(response.body.items[0].variants[0]).not.toHaveProperty('reserved');
  });

  it('requires a verified buyer and validates address, cart and checkout input', async () => {
    await request(app.getHttpServer()).get('/api/v1/me/cart').expect(401);
    firebase.verifyIdToken.mockResolvedValue({
      ...owner,
      email_verified: false,
    });
    await request(app.getHttpServer())
      .get('/api/v1/me/cart')
      .set('Authorization', 'Bearer token')
      .expect(403);
    firebase.verifyIdToken.mockResolvedValue(owner);
    await request(app.getHttpServer())
      .post('/api/v1/me/addresses')
      .set('Authorization', 'Bearer token')
      .send({
        recipient: 'A',
        phone: 'bad',
        line1: 'x',
        city: 'Colombo',
        district: 'Colombo',
        postalCode: '00100',
      })
      .expect(400);
    await request(app.getHttpServer())
      .put(`/api/v1/me/cart/items/${productId}`)
      .set('Authorization', 'Bearer token')
      .send({ quantity: 0 })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/me/orders/checkout')
      .set('Authorization', 'Bearer token')
      .send({ addressId: categoryId, checkoutKey: 'same-key' })
      .expect(400);
  });

  it('forbids cross-seller delivery setting changes and accepts only valid fees', async () => {
    firebase.verifyIdToken.mockResolvedValue(owner);
    database.sellerMember.findUnique.mockResolvedValue(null);
    const path = `/api/v1/sellers/${otherSellerId}/delivery-settings`;
    await request(app.getHttpServer())
      .patch(path)
      .set('Authorization', 'Bearer token')
      .send({ shippingFeeLkrMinor: 500 })
      .expect(403);
    expect(database.seller.update).not.toHaveBeenCalled();
    database.sellerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      seller: { status: 'APPROVED' },
    });
    await request(app.getHttpServer())
      .patch(path)
      .set('Authorization', 'Bearer token')
      .send({ shippingFeeLkrMinor: -1 })
      .expect(400);
    database.seller.update.mockResolvedValue({
      id: otherSellerId,
      shippingFeeLkrMinor: 500,
    });
    await request(app.getHttpServer())
      .patch(path)
      .set('Authorization', 'Bearer token')
      .send({ shippingFeeLkrMinor: 500 })
      .expect(200);
    expect(database.sellerMember.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sellerId_userId: { sellerId: otherSellerId, userId } },
      }),
    );
  });

  it('restricts order queues to sellers and verified administrators', async () => {
    firebase.verifyIdToken.mockResolvedValue(owner);
    database.sellerMember.findUnique.mockResolvedValue(null);
    await request(app.getHttpServer())
      .get(`/api/v1/sellers/${sellerId}/orders`)
      .set('Authorization', 'Bearer token')
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/admin/orders')
      .set('Authorization', 'Bearer token')
      .expect(403);
    firebase.verifyIdToken.mockResolvedValue(administrator);
    database.order.findMany.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get('/api/v1/admin/orders')
      .set('Authorization', 'Bearer token')
      .expect(200)
      .expect([]);
  });

  it('scopes notification reading to the signed-in account', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/me/notifications')
      .expect(401);
    firebase.verifyIdToken.mockResolvedValue(owner);
    database.notification.findMany.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get('/api/v1/me/notifications')
      .set('Authorization', 'Bearer token')
      .expect(200)
      .expect([]);
    expect(database.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId } }),
    );
    database.notification.updateMany.mockResolvedValue({ count: 0 });
    await request(app.getHttpServer())
      .patch(`/api/v1/me/notifications/${productId}/read`)
      .set('Authorization', 'Bearer token')
      .expect(404);
    expect(database.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: productId, userId },
      }),
    );
  });

  it('validates return requests and restricts their reviews to administrators', async () => {
    firebase.verifyIdToken.mockResolvedValue(owner);
    await request(app.getHttpServer())
      .post('/api/v1/me/returns')
      .set('Authorization', 'Bearer token')
      .send({ sellerOrderId: productId, reason: 'short' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/returns/${productId}/approve`)
      .set('Authorization', 'Bearer token')
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/admin/cod/reconciliation-queue')
      .set('Authorization', 'Bearer token')
      .expect(403);
    firebase.verifyIdToken.mockResolvedValue(administrator);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/cod/${productId}/reconciliations`)
      .set('Authorization', 'Bearer token')
      .send({ amountReceivedMinor: -1, reference: 'ABCD' })
      .expect(400);
    database.returnRequest.findMany.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get('/api/v1/admin/returns?status=PENDING')
      .set('Authorization', 'Bearer token')
      .expect(200)
      .expect([]);
  });

  it('checks seller membership and image content before R2 upload', async () => {
    firebase.verifyIdToken.mockResolvedValue(owner);
    database.sellerMember.findUnique.mockResolvedValue(null);
    const path = `/api/v1/sellers/${sellerId}/products/${productId}/images`;
    await request(app.getHttpServer())
      .post(path)
      .set('Authorization', 'Bearer token')
      .set('Content-Type', 'image/png')
      .send(Buffer.from('not a PNG'))
      .expect(403);
    database.sellerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      seller: { status: 'APPROVED' },
    });
    await request(app.getHttpServer())
      .post(path)
      .set('Authorization', 'Bearer token')
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('bad'))
      .expect(400);
  });
});
