import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';
import { JsonLogger } from './common/json-logger.js';
import { describeError } from './common/describe-error.js';

async function bootstrap() {
  // ConfigModule has loaded .env by the time AppModule is imported.
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? new JsonLogger(
            process.env.LOG_LEVEL === 'debug'
              ? ['log', 'error', 'warn', 'fatal', 'debug', 'verbose']
              : ['log', 'error', 'warn', 'fatal'],
          )
        : undefined,
  });
  configureApp(app);
  app.enableShutdownHooks();
  const config = app.get(ConfigService);
  const host = config.getOrThrow<string>('HOST');
  const port = config.getOrThrow<number>('PORT');
  await app.listen(port, host);
  Logger.log(`HelaCart API listening on ${host}:${port}/api/v1`, 'Bootstrap');
}

await bootstrap().catch((error: unknown) => {
  // describeError redacts connection strings; never print raw driver errors.
  Logger.error(
    `API startup failed. Check configuration and database connectivity. ${
      error instanceof Error && error.message.startsWith('Invalid environment')
        ? error.message
        : describeError(error)
    }`,
    'Bootstrap',
  );
  process.exitCode = 1;
});
