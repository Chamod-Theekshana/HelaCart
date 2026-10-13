import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks();
  const config = app.get(ConfigService);
  const host = config.getOrThrow<string>('HOST');
  const port = config.getOrThrow<number>('PORT');
  await app.listen(port, host);
  Logger.log(`HelaCart API listening on ${host}:${port}/api/v1`, 'Bootstrap');
}

await bootstrap().catch(() => {
  // Do not print connection strings or raw driver errors at this boundary.
  Logger.error(
    'API startup failed. Check configuration and database connectivity.',
    'Bootstrap',
  );
  process.exitCode = 1;
});
