import { isIP } from 'node:net';

const semver = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;

function compareVersions(a: string, b: string) {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let i = 0; i < 3; i++)
    if (left[i] !== right[i]) return left[i] - right[i];
  return 0;
}

export const appConfigDefaults = {
  APP_ANDROID_MIN_VERSION: '1.0.0',
  APP_ANDROID_LATEST_VERSION: '1.0.0',
  APP_ANDROID_STORE_URL:
    'https://play.google.com/store/apps/details?id=com.helacart.buyer',
  APP_IOS_MIN_VERSION: '1.0.0',
  APP_IOS_LATEST_VERSION: '1.0.0',
  APP_IOS_STORE_URL: 'https://apps.apple.com/app/id0000000000',
  APP_WEB_BASE_URL: 'https://helacart.lk',
  LEGAL_PRIVACY_URL: 'https://helacart.lk/legal/privacy',
  LEGAL_TERMS_URL: 'https://helacart.lk/legal/terms',
  LEGAL_RETURNS_URL: 'https://helacart.lk/legal/returns',
  SUPPORT_EMAIL: 'support@helacart.lk',
  SUPPORT_PHONE: '',
} as const;

export function validateEnvironment(input: Record<string, unknown>) {
  const problems: string[] = [];
  const text = (key: string) => String(input[key] ?? '').trim();
  const mode = input.NODE_ENV ?? 'development';
  const production = mode === 'production';
  if (!['development', 'test', 'production'].includes(String(mode))) {
    problems.push('NODE_ENV must be development, test or production');
  }
  const integer = (
    key: string,
    fallback: number,
    min: number,
    max: number,
  ): number => {
    const raw = text(key) || String(fallback);
    const value = Number(raw);
    if (
      !/^-?\d+$/.test(raw) ||
      !Number.isSafeInteger(value) ||
      value < min ||
      value > max
    ) {
      problems.push(`${key} must be an integer from ${min} to ${max}`);
      return fallback;
    }
    return value;
  };
  const flag = (key: string, fallback: boolean): boolean => {
    const raw = text(key).toLowerCase();
    if (!raw) return fallback;
    if (['true', '1', 'yes'].includes(raw)) return true;
    if (['false', '0', 'no'].includes(raw)) return false;
    problems.push(`${key} must be true or false`);
    return fallback;
  };
  const httpsUrl = (key: string, fallback: string, allowHttp = false) => {
    const value = text(key) || fallback;
    if (!value) return value;
    try {
      const url = new URL(value);
      if (
        !(
          url.protocol === 'https:' ||
          (allowHttp && url.protocol === 'http:')
        ) ||
        url.username ||
        url.password
      )
        throw new Error('Invalid URL');
    } catch {
      problems.push(`${key} must be an HTTPS URL`);
    }
    return value;
  };

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
      (url.hostname.endsWith('.neon.tech') || production) &&
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
  const databasePoolSize = integer('DATABASE_POOL_SIZE', 10, 1, 100);
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
      if (production && url.protocol !== 'https:')
        problems.push('CORS_ORIGINS must use https origins in production');
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
  if (production && adminUids.length === 0) {
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
  const privateBucket = String(input.R2_PRIVATE_BUCKET ?? '').trim();
  const privateOnly =
    Boolean(privateBucket) && !input.R2_BUCKET && !input.R2_PUBLIC_BASE_URL;
  if (
    configuredR2.length &&
    configuredR2.length !== r2Keys.length &&
    !privateOnly
  )
    problems.push('All R2 settings must be provided together');
  if (privateBucket) {
    if (
      !r2Keys
        .slice(0, 3)
        .every((key) => Boolean(String(input[key] ?? '').trim()))
    )
      problems.push('R2_PRIVATE_BUCKET requires all three R2 credentials');
    if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(privateBucket))
      problems.push('R2_PRIVATE_BUCKET must be a valid bucket name');
    if (privateBucket === String(input.R2_BUCKET ?? '').trim())
      problems.push('R2_PRIVATE_BUCKET must differ from the public R2_BUCKET');
  }
  if (configuredR2.length === r2Keys.length || privateBucket) {
    if (!/^[0-9a-f]{32}$/i.test(String(input.R2_ACCOUNT_ID)))
      problems.push('R2_ACCOUNT_ID must be a 32-character account ID');
  }
  if (configuredR2.length === r2Keys.length) {
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

  // Server-to-server token used by the Next.js storefront (rate limiting).
  const internalToken = text('INTERNAL_API_TOKEN');
  if (internalToken) {
    if (!/^[\x21-\x7e]+$/.test(internalToken))
      problems.push(
        'INTERNAL_API_TOKEN must be printable ASCII without spaces',
      );
    if (internalToken.length < (production ? 32 : 16))
      problems.push(
        `INTERNAL_API_TOKEN must be at least ${production ? 32 : 16} characters`,
      );
  }

  // Optional providers are all-or-nothing.
  const allOrNothing = (keys: string[], label: string) => {
    const present = keys.filter((key) => text(key));
    if (present.length && present.length !== keys.length)
      problems.push(
        `${label} settings must be provided together: ${keys.join(', ')}`,
      );
    return present.length === keys.length;
  };
  const smsEnabled = allOrNothing(
    ['NOTIFY_LK_USER_ID', 'NOTIFY_LK_API_KEY', 'NOTIFY_LK_SENDER_ID'],
    'Notify.lk SMS',
  );
  if (smsEnabled) {
    if (!/^\d{1,12}$/.test(text('NOTIFY_LK_USER_ID')))
      problems.push('NOTIFY_LK_USER_ID must be the numeric Notify.lk user ID');
    if (!/^[A-Za-z0-9]{8,128}$/.test(text('NOTIFY_LK_API_KEY')))
      problems.push('NOTIFY_LK_API_KEY must be the Notify.lk API key');
    if (!/^[A-Za-z0-9 ]{3,11}$/.test(text('NOTIFY_LK_SENDER_ID')))
      problems.push(
        'NOTIFY_LK_SENDER_ID must be an approved sender ID (3-11 characters)',
      );
  }
  const otpSecret = text('OTP_SECRET');
  if (smsEnabled && !otpSecret)
    problems.push('OTP_SECRET is required when Notify.lk SMS is configured');
  if (otpSecret && otpSecret.length < 32)
    problems.push('OTP_SECRET must be at least 32 characters');
  const emailEnabled = allOrNothing(
    ['RESEND_API_KEY', 'RESEND_FROM'],
    'Resend email',
  );
  if (emailEnabled) {
    if (!/^[A-Za-z0-9_-]{10,200}$/.test(text('RESEND_API_KEY')))
      problems.push('RESEND_API_KEY must be a Resend API key');
    if (
      !/^(?:[^<>@\r\n]{1,80} <[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>|[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)$/.test(
        text('RESEND_FROM'),
      )
    )
      problems.push(
        'RESEND_FROM must be an address such as "HelaCart <orders@helacart.lk>"',
      );
  }
  const pushEnabled = flag('PUSH_NOTIFICATIONS_ENABLED', true);

  // Rate limits (requests per minute) and the authenticated per-IP multiplier.
  const rateGeneral = integer(
    'RATE_LIMIT_GENERAL_PER_MINUTE',
    180,
    10,
    100_000,
  );
  const rateWrite = integer('RATE_LIMIT_WRITE_PER_MINUTE', 20, 1, 10_000);
  const rateContent = integer('RATE_LIMIT_CONTENT_PER_MINUTE', 30, 1, 10_000);
  const rateMultiplier = integer(
    'RATE_LIMIT_AUTHENTICATED_IP_MULTIPLIER',
    5,
    1,
    50,
  );

  // COD fraud controls and order lifecycle.
  const sellerAcceptHours = integer('SELLER_ACCEPT_HOURS', 48, 12, 720);
  const maxOpenCodOrders = integer('MAX_OPEN_COD_ORDERS', 5, 1, 100);
  const maxCodOrderMinor = integer(
    'MAX_COD_ORDER_LKR_MINOR',
    50_000_000,
    10_000,
    1_000_000_000,
  );
  const requirePhoneVerification = flag('REQUIRE_PHONE_VERIFICATION', false);
  if (requirePhoneVerification && production && !smsEnabled)
    problems.push(
      'REQUIRE_PHONE_VERIFICATION needs Notify.lk SMS in production',
    );
  const reservationsEnabled = flag('RESERVATIONS_ENABLED', false);
  const tokenCacheSeconds = integer(
    'AUTH_TOKEN_CACHE_SECONDS',
    mode === 'test' ? 0 : 60,
    0,
    60,
  );

  // App configuration served by GET /app-config.
  const appConfig: Record<string, string> = {};
  for (const key of [
    'APP_ANDROID_MIN_VERSION',
    'APP_ANDROID_LATEST_VERSION',
    'APP_IOS_MIN_VERSION',
    'APP_IOS_LATEST_VERSION',
  ] as const) {
    appConfig[key] = text(key) || appConfigDefaults[key];
    if (!semver.test(appConfig[key]))
      problems.push(`${key} must be a version such as 1.2.3`);
  }
  for (const platform of ['ANDROID', 'IOS'] as const) {
    const min = appConfig[`APP_${platform}_MIN_VERSION`];
    const latest = appConfig[`APP_${platform}_LATEST_VERSION`];
    if (
      semver.test(min) &&
      semver.test(latest) &&
      compareVersions(min, latest) > 0
    )
      problems.push(
        `APP_${platform}_MIN_VERSION must not exceed APP_${platform}_LATEST_VERSION`,
      );
  }
  for (const key of [
    'APP_ANDROID_STORE_URL',
    'APP_IOS_STORE_URL',
    'APP_WEB_BASE_URL',
    'LEGAL_PRIVACY_URL',
    'LEGAL_TERMS_URL',
    'LEGAL_RETURNS_URL',
  ] as const)
    appConfig[key] = httpsUrl(key, appConfigDefaults[key], !production);
  appConfig.APP_WEB_BASE_URL = appConfig.APP_WEB_BASE_URL.replace(/\/+$/, '');
  appConfig.SUPPORT_EMAIL =
    text('SUPPORT_EMAIL') || appConfigDefaults.SUPPORT_EMAIL;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(appConfig.SUPPORT_EMAIL))
    problems.push('SUPPORT_EMAIL must be an email address');
  appConfig.SUPPORT_PHONE = text('SUPPORT_PHONE');
  if (appConfig.SUPPORT_PHONE && !/^\+\d{8,15}$/.test(appConfig.SUPPORT_PHONE))
    problems.push('SUPPORT_PHONE must be an E.164 number such as +94112345678');

  if (problems.length)
    throw new Error(
      `Invalid environment: ${[...new Set(problems)].join('; ')}`,
    );
  return {
    ...input,
    NODE_ENV: mode,
    PORT: port,
    HOST: host,
    TRUST_PROXY_HOPS: proxyHops,
    RETURN_WINDOW_DAYS: returnWindowDays,
    DATABASE_URL: databaseUrl,
    DATABASE_POOL_SIZE: databasePoolSize,
    CORS_ORIGINS: origins,
    FIREBASE_PROJECT_ID: firebaseProjectId,
    ADMIN_FIREBASE_UIDS: [...new Set(adminUids)],
    R2_PRIVATE_BUCKET: privateBucket,
    INTERNAL_API_TOKEN: internalToken,
    SMS_ENABLED: smsEnabled,
    EMAIL_ENABLED: emailEnabled,
    PUSH_NOTIFICATIONS_ENABLED: pushEnabled,
    OTP_SECRET: otpSecret,
    RATE_LIMIT_GENERAL_PER_MINUTE: rateGeneral,
    RATE_LIMIT_WRITE_PER_MINUTE: rateWrite,
    RATE_LIMIT_CONTENT_PER_MINUTE: rateContent,
    RATE_LIMIT_AUTHENTICATED_IP_MULTIPLIER: rateMultiplier,
    SELLER_ACCEPT_HOURS: sellerAcceptHours,
    MAX_OPEN_COD_ORDERS: maxOpenCodOrders,
    MAX_COD_ORDER_LKR_MINOR: maxCodOrderMinor,
    REQUIRE_PHONE_VERIFICATION: requirePhoneVerification,
    RESERVATIONS_ENABLED: reservationsEnabled,
    AUTH_TOKEN_CACHE_SECONDS: tokenCacheSeconds,
    ...appConfig,
  };
}
