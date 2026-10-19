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
  const proxyHops = Number(input.TRUST_PROXY_HOPS ?? '0');
  if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 2)
    problems.push('TRUST_PROXY_HOPS must be 0, 1 or 2');
  const returnWindowDays = Number(input.RETURN_WINDOW_DAYS ?? '14');
  if (
    !Number.isInteger(returnWindowDays) ||
    returnWindowDays < 1 ||
    returnWindowDays > 90
  )
    problems.push('RETURN_WINDOW_DAYS must be from 1 to 90');
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
  const firebaseProjectId = String(input.FIREBASE_PROJECT_ID ?? '').trim();
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(firebaseProjectId)) {
    problems.push('FIREBASE_PROJECT_ID must be a valid Firebase project ID');
  }
  const adminUids = String(input.ADMIN_FIREBASE_UIDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (adminUids.some((uid) => uid.length > 128 || /\s/.test(uid))) {
    problems.push(
      'ADMIN_FIREBASE_UIDS must contain comma-separated Firebase UIDs',
    );
  }
  if (mode === 'production' && adminUids.length === 0) {
    problems.push('ADMIN_FIREBASE_UIDS must be configured in production');
  }
  const r2Keys = [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET',
    'R2_PUBLIC_BASE_URL',
  ];
  const configuredR2 = r2Keys.filter((key) =>
    Boolean(String(input[key] ?? '').trim()),
  );
  if (configuredR2.length && configuredR2.length !== r2Keys.length)
    problems.push('All R2 settings must be provided together');
  if (configuredR2.length === r2Keys.length) {
    if (!/^[0-9a-f]{32}$/i.test(String(input.R2_ACCOUNT_ID)))
      problems.push('R2_ACCOUNT_ID must be a 32-character account ID');
    if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(String(input.R2_BUCKET)))
      problems.push('R2_BUCKET must be a valid bucket name');
    try {
      const url = new URL(String(input.R2_PUBLIC_BASE_URL));
      if (
        url.protocol !== 'https:' ||
        url.pathname !== '/' ||
        url.search ||
        url.hash ||
        url.username ||
        url.password
      )
        throw new Error('Invalid R2 public URL');
    } catch {
      problems.push('R2_PUBLIC_BASE_URL must be a public HTTPS origin');
    }
  }
  if (problems.length)
    throw new Error(`Invalid environment: ${problems.join('; ')}`);
  return {
    ...input,
    NODE_ENV: mode,
    PORT: port,
    HOST: host,
    TRUST_PROXY_HOPS: proxyHops,
    RETURN_WINDOW_DAYS: returnWindowDays,
    DATABASE_URL: databaseUrl,
    CORS_ORIGINS: origins,
    FIREBASE_PROJECT_ID: firebaseProjectId,
    ADMIN_FIREBASE_UIDS: [...new Set(adminUids)],
  };
}
