// Deliberately override inherited values: tests must never contact your Neon DB.
process.env.NODE_ENV = 'test';
process.env.PORT = '4000';
process.env.HOST = '127.0.0.1';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/helacart_test';
