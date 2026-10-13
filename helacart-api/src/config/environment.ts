import { isIP } from 'node:net';

export function validateEnvironment(input: Record<string, unknown>) {
  const problems: string[] = [];
  const mode = input.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(String(mode))) {
    problems.push('NODE_ENV must be development, test or production');
  }
  const rawPort = String(input.PORT ?? '4000');
  const port = Number(rawPort);
  if (
    !/^\d+$/.test(rawPort) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    problems.push('PORT must be an integer from 1 to 65535');
  }
  const host = String(input.HOST ?? '127.0.0.1');
  if (host !== 'localhost' && !isIP(host)) {
    problems.push('HOST must be localhost or an IP address');
  }
  const databaseUrl = String(input.DATABASE_URL ?? '');
  try {
    const url = new URL(databaseUrl);
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname ||
      !url.username ||
      url.pathname.length < 2
    ) {
      throw new Error('Invalid database URL');
    }
    if (
      (url.hostname.endsWith('.neon.tech') || mode === 'production') &&
      !['require', 'verify-ca', 'verify-full'].includes(
        url.searchParams.get('sslmode') ?? '',
      )
    ) {
      problems.push(
        'DATABASE_URL must enable TLS with sslmode=require or stronger',
      );
    }
  } catch {
    problems.push(
      'DATABASE_URL must be a PostgreSQL URL including a database name',
    );
  }
  const origins = String(input.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  for (const origin of origins) {
    try {
      const url = new URL(origin);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.origin !== origin
      ) {
        throw new Error('Invalid origin');
      }
    } catch {
      problems.push(
        'CORS_ORIGINS must contain exact HTTP(S) origins without paths or trailing slashes',
      );
    }
  }
  if (!origins.length)
    problems.push('CORS_ORIGINS must include at least one origin');
  if (problems.length)
    throw new Error(`Invalid environment: ${problems.join('; ')}`);
  return {
    ...input,
    NODE_ENV: mode,
    PORT: port,
    HOST: host,
    DATABASE_URL: databaseUrl,
    CORS_ORIGINS: origins,
  };
}
