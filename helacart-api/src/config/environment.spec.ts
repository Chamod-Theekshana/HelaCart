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
});
