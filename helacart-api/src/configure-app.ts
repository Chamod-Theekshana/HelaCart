import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import type { Express } from 'express';
import { requestIdMiddleware } from './common/request-id.js';

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  (app.getHttpAdapter().getInstance() as Express).set(
    'trust proxy',
    config.getOrThrow<number>('TRUST_PROXY_HOPS'),
  );
  // First, so every response (including 404s and errors) carries x-request-id.
  app.use(
    requestIdMiddleware({
      logRequests: config.get<string>('NODE_ENV') === 'production',
    }),
  );
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.enableCors({
    origin: config.getOrThrow<string[]>('CORS_ORIGINS'),
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'Content-Disposition'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
