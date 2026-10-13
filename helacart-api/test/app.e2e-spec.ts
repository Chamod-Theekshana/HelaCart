import { Test } from '@nestjs/testing';
import { Body, Controller, type INestApplication, Post } from '@nestjs/common';
import { IsString } from 'class-validator';
import request from 'supertest';
import type { Server } from 'node:http';
import { AppModule } from '../src/app.module.js';
import { FirebaseAdminService } from '../src/auth/firebase-admin.service.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

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
  const database = {
    checkConnection: vi.fn(),
    user: { upsert: vi.fn() },
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
});
