import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Offline generation works without secrets. Migration commands require
  // the real DIRECT_URL in .env and fail if it is absent.
  datasource: { url: process.env.DIRECT_URL },
});
