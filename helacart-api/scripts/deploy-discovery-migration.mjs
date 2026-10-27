import 'dotenv/config';
import { Client } from 'pg';
import { readFile, readdir } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
// Fallback for a development environment where the Prisma schema engine cannot
// connect but the configured PostgreSQL driver can. Applies only this migration.
const name = '20261027010000_discovery_promotions';
const root = new URL('../prisma/migrations/', import.meta.url),
  sql = await readFile(new URL(name + '/migration.sql', root), 'utf8'),
  checksum = createHash('sha256').update(sql).digest('hex');
const client = new Client({
  connectionString: process.env.DIRECT_URL,
  connectionTimeoutMillis: 15000,
  statement_timeout: 60000,
});
await client.connect();
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(72707369)');
  const schema = await client.query('SELECT current_schema() AS schema');
  if (schema.rows[0].schema !== 'public')
    throw Error(
      'Refusing to apply the development migration outside the configured public schema',
    );
  const records = (
    await client.query(
      'SELECT migration_name,checksum,finished_at,rolled_back_at FROM "_prisma_migrations"',
    )
  ).rows;
  if (records.some((r) => !r.finished_at && !r.rolled_back_at))
    throw Error('Resolve the existing unfinished migration before deploying');
  const existing = records.find(
    (r) => r.migration_name === name && r.finished_at && !r.rolled_back_at,
  );
  if (existing) {
    if (existing.checksum !== checksum)
      throw Error('Applied migration checksum differs');
    await client.query('COMMIT');
    console.log(
      JSON.stringify({
        migration: name,
        alreadyApplied: true,
        checksumVerified: true,
      }),
    );
  } else {
    const prior = (await readdir(root, { withFileTypes: true }))
        .filter((e) => e.isDirectory() && e.name < name)
        .map((e) => e.name),
      applied = new Set(
        records
          .filter((r) => r.finished_at && !r.rolled_back_at)
          .map((r) => r.migration_name),
      );
    if (prior.some((n) => !applied.has(n)))
      throw Error(
        'An earlier migration is missing; use the normal deployment workflow first',
      );
    await client.query(sql);
    await client.query(
      'INSERT INTO "_prisma_migrations" (id,checksum,migration_name,started_at,finished_at,applied_steps_count) VALUES ($1,$2,$3,clock_timestamp(),clock_timestamp(),1)',
      [randomUUID(), checksum, name],
    );
    await client.query('COMMIT');
    const receipt = await client.query(
      'SELECT checksum,finished_at FROM "_prisma_migrations" WHERE migration_name=$1 AND rolled_back_at IS NULL',
      [name],
    );
    if (receipt.rows[0]?.checksum !== checksum || !receipt.rows[0]?.finished_at)
      throw Error('Migration receipt could not be verified');
    console.log(
      JSON.stringify({
        migration: name,
        applied: true,
        checksumVerified: true,
      }),
    );
  }
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  await client.end();
}
