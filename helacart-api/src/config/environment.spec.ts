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
});
