import { validateEnvironment } from './environment.js';

const local = {
  DATABASE_URL: 'postgresql://test:secret@localhost:5432/helacart',
  FIREBASE_PROJECT_ID: 'helacart-test',
};

describe('Environment configuration', () => {
  it('uses safe local defaults and normalizes allowed origins', () => {
    const result = validateEnvironment({
      ...local,
      CORS_ORIGINS: 'http://localhost:3000, https://shop.example.com',
    });
    expect(result.PORT).toBe(4000);
    expect(result.HOST).toBe('127.0.0.1');
    expect(result.TRUST_PROXY_HOPS).toBe(0);
    expect(result.RETURN_WINDOW_DAYS).toBe(14);
    expect(result.CORS_ORIGINS).toEqual([
      'http://localhost:3000',
      'https://shop.example.com',
    ]);
  });

  it.each(['', 'abc', '4000oops', '0', '-1', '65536', '3.5'])(
    'rejects invalid port %s',
    (PORT) => {
      expect(() => validateEnvironment({ ...local, PORT })).toThrow('PORT');
    },
  );

  it.each(['*', 'https://shop.example.com/path', 'http://localhost:3000/', ''])(
    'rejects invalid origins %s',
    (CORS_ORIGINS) => {
      expect(() => validateEnvironment({ ...local, CORS_ORIGINS })).toThrow(
        'CORS_ORIGINS',
      );
    },
  );

  it('requires database configuration without echoing secret values', () => {
    const DATABASE_URL = 'https://admin:private-password@example.com/db';
    expect(() => validateEnvironment({ DATABASE_URL })).toThrow('DATABASE_URL');
    try {
      validateEnvironment({ DATABASE_URL });
    } catch (error) {
      expect(String(error)).not.toContain('private-password');
    }
    expect(() => validateEnvironment({})).toThrow('DATABASE_URL');
  });

  it('requires TLS for Neon and production databases', () => {
    expect(() =>
      validateEnvironment({
        ...local,
        DATABASE_URL: 'postgresql://u:p@ep-demo.aws.neon.tech/db',
      }),
    ).toThrow('TLS');
    expect(() =>
      validateEnvironment({ ...local, NODE_ENV: 'production' }),
    ).toThrow('TLS');
    expect(() =>
      validateEnvironment({
        ...local,
        DATABASE_URL:
          'postgresql://u:p@ep-demo.aws.neon.tech/db?sslmode=require',
      }),
    ).not.toThrow();
  });

  it('rejects invalid runtime mode and host', () => {
    expect(() => validateEnvironment({ ...local, NODE_ENV: 'stagin' })).toThrow(
      'NODE_ENV',
    );
    expect(() =>
      validateEnvironment({ ...local, HOST: 'https://localhost' }),
    ).toThrow('HOST');
  });

  it('requires a valid Firebase project ID', () => {
    expect(() =>
      validateEnvironment({ ...local, FIREBASE_PROJECT_ID: '' }),
    ).toThrow('FIREBASE_PROJECT_ID');
    expect(() =>
      validateEnvironment({ ...local, FIREBASE_PROJECT_ID: 'Invalid Project' }),
    ).toThrow('FIREBASE_PROJECT_ID');
  });

  it('normalizes administrator UIDs and requires them for production', () => {
    expect(
      validateEnvironment({
        ...local,
        ADMIN_FIREBASE_UIDS: ' admin-1,admin-2,admin-1 ',
      }).ADMIN_FIREBASE_UIDS,
    ).toEqual(['admin-1', 'admin-2']);
    expect(() =>
      validateEnvironment({
        ...local,
        NODE_ENV: 'production',
        DATABASE_URL:
          'postgresql://u:p@ep-demo.aws.neon.tech/db?sslmode=require',
      }),
    ).toThrow('ADMIN_FIREBASE_UIDS');
  });

  it('requires a complete R2 configuration and public HTTPS origin', () => {
    const r2 = {
      R2_ACCOUNT_ID: 'a'.repeat(32),
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_BUCKET: 'helacart-images',
      R2_PUBLIC_BASE_URL: 'https://images.example.com',
    };
    expect(() =>
      validateEnvironment({ ...local, R2_BUCKET: r2.R2_BUCKET }),
    ).toThrow('All R2');
    expect(() => validateEnvironment({ ...local, ...r2 })).not.toThrow();
    expect(() =>
      validateEnvironment({
        ...local,
        ...r2,
        R2_PUBLIC_BASE_URL: 'http://images.example.com',
      }),
    ).toThrow('R2_PUBLIC_BASE_URL');
  });

  it('validates return deadline and proxy trust settings', () => {
    expect(() =>
      validateEnvironment({ ...local, RETURN_WINDOW_DAYS: '0' }),
    ).toThrow('RETURN_WINDOW_DAYS');
    expect(() =>
      validateEnvironment({ ...local, TRUST_PROXY_HOPS: 'true' }),
    ).toThrow('TRUST_PROXY_HOPS');
    expect(
      validateEnvironment({
        ...local,
        RETURN_WINDOW_DAYS: '30',
        TRUST_PROXY_HOPS: '1',
      }).RETURN_WINDOW_DAYS,
    ).toBe(30);
  });

  it('allows a private-only document bucket and rejects public bucket reuse', () => {
    const privateR2 = {
      R2_ACCOUNT_ID: 'a'.repeat(32),
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_PRIVATE_BUCKET: 'helacart-verification',
    };
    expect(() => validateEnvironment({ ...local, ...privateR2 })).not.toThrow();
    expect(() =>
      validateEnvironment({
        ...local,
        R2_PRIVATE_BUCKET: privateR2.R2_PRIVATE_BUCKET,
      }),
    ).toThrow('R2_PRIVATE_BUCKET requires');
    expect(() =>
      validateEnvironment({
        ...local,
        ...privateR2,
        R2_BUCKET: privateR2.R2_PRIVATE_BUCKET,
        R2_PUBLIC_BASE_URL: 'https://images.example.com',
      }),
    ).toThrow('must differ');
  });

  const production = {
    ...local,
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://u:p@ep-demo.aws.neon.tech/db?sslmode=require',
    ADMIN_FIREBASE_UIDS: 'admin-1',
    CORS_ORIGINS: 'https://helacart.lk',
  };

  it('accepts a minimal production configuration and requires https origins', () => {
    expect(() => validateEnvironment(production)).not.toThrow();
    expect(() =>
      validateEnvironment({
        ...production,
        CORS_ORIGINS: 'https://helacart.lk,http://admin.helacart.lk',
      }),
    ).toThrow('https origins in production');
  });

  it('applies defaults for the hardening release settings', () => {
    const result = validateEnvironment(local);
    expect(result).toMatchObject({
      DATABASE_POOL_SIZE: 10,
      SELLER_ACCEPT_HOURS: 48,
      MAX_OPEN_COD_ORDERS: 5,
      MAX_COD_ORDER_LKR_MINOR: 50_000_000,
      REQUIRE_PHONE_VERIFICATION: false,
      RESERVATIONS_ENABLED: false,
      RATE_LIMIT_GENERAL_PER_MINUTE: 180,
      RATE_LIMIT_WRITE_PER_MINUTE: 20,
      RATE_LIMIT_AUTHENTICATED_IP_MULTIPLIER: 5,
      AUTH_TOKEN_CACHE_SECONDS: 60,
      SMS_ENABLED: false,
      EMAIL_ENABLED: false,
      APP_ANDROID_MIN_VERSION: '1.0.0',
      LEGAL_PRIVACY_URL: 'https://helacart.lk/legal/privacy',
      SUPPORT_EMAIL: 'support@helacart.lk',
    });
    expect(
      validateEnvironment({ ...local, NODE_ENV: 'test' })
        .AUTH_TOKEN_CACHE_SECONDS,
    ).toBe(0);
  });

  it.each([
    ['SELLER_ACCEPT_HOURS', '6'],
    ['MAX_OPEN_COD_ORDERS', '0'],
    ['MAX_COD_ORDER_LKR_MINOR', 'lots'],
    ['DATABASE_POOL_SIZE', '500'],
    ['RATE_LIMIT_WRITE_PER_MINUTE', '-1'],
    ['REQUIRE_PHONE_VERIFICATION', 'maybe'],
    ['AUTH_TOKEN_CACHE_SECONDS', '120'],
  ])('rejects invalid %s', (key, value) => {
    expect(() => validateEnvironment({ ...local, [key]: value })).toThrow(key);
  });

  it('requires a long internal API token in production', () => {
    expect(() =>
      validateEnvironment({
        ...production,
        INTERNAL_API_TOKEN: 'x'.repeat(20),
      }),
    ).toThrow('INTERNAL_API_TOKEN must be at least 32');
    expect(() =>
      validateEnvironment({
        ...production,
        INTERNAL_API_TOKEN: 'x'.repeat(32),
      }),
    ).not.toThrow();
    expect(() =>
      validateEnvironment({ ...local, INTERNAL_API_TOKEN: 'x'.repeat(16) }),
    ).not.toThrow();
  });

  it('treats optional providers as all-or-nothing and requires an OTP secret for SMS', () => {
    const sms = {
      NOTIFY_LK_USER_ID: '12345',
      NOTIFY_LK_API_KEY: 'abcdefghijklmnop',
      NOTIFY_LK_SENDER_ID: 'HelaCart',
    };
    expect(() =>
      validateEnvironment({ ...local, NOTIFY_LK_USER_ID: '12345' }),
    ).toThrow('Notify.lk SMS settings must be provided together');
    expect(() => validateEnvironment({ ...local, ...sms })).toThrow(
      'OTP_SECRET is required',
    );
    expect(
      validateEnvironment({ ...local, ...sms, OTP_SECRET: 's'.repeat(32) })
        .SMS_ENABLED,
    ).toBe(true);
    expect(() =>
      validateEnvironment({ ...local, RESEND_API_KEY: 're_1234567890' }),
    ).toThrow('Resend email settings must be provided together');
    expect(
      validateEnvironment({
        ...local,
        RESEND_API_KEY: 're_1234567890',
        RESEND_FROM: 'HelaCart <orders@helacart.lk>',
      }).EMAIL_ENABLED,
    ).toBe(true);
    expect(() =>
      validateEnvironment({
        ...local,
        RESEND_API_KEY: 're_1234567890',
        RESEND_FROM: 'not an address',
      }),
    ).toThrow('RESEND_FROM');
  });

  it('requires SMS in production when phone verification is mandatory', () => {
    expect(() =>
      validateEnvironment({
        ...production,
        REQUIRE_PHONE_VERIFICATION: 'true',
      }),
    ).toThrow('REQUIRE_PHONE_VERIFICATION');
  });

  it('validates app configuration versions and links', () => {
    expect(() =>
      validateEnvironment({ ...local, APP_ANDROID_MIN_VERSION: '1.0' }),
    ).toThrow('APP_ANDROID_MIN_VERSION');
    expect(() =>
      validateEnvironment({
        ...local,
        APP_IOS_MIN_VERSION: '2.0.0',
        APP_IOS_LATEST_VERSION: '1.9.9',
      }),
    ).toThrow('must not exceed');
    expect(() =>
      validateEnvironment({
        ...production,
        LEGAL_TERMS_URL: 'http://helacart.lk/legal/terms',
      }),
    ).toThrow('LEGAL_TERMS_URL');
    expect(() =>
      validateEnvironment({ ...local, SUPPORT_PHONE: '0771234567' }),
    ).toThrow('SUPPORT_PHONE');
  });
});
