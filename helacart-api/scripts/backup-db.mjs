#!/usr/bin/env node
// Logical backup of the HelaCart PostgreSQL database (Neon or self-hosted).
//
//   node scripts/backup-db.mjs [output-directory]
//
// Reads DIRECT_URL (the non-pooled connection string; pg_dump cannot use the
// PgBouncer pooler) from the environment or .env, then runs
//   pg_dump --format=custom --no-owner --no-privileges
// into <output-directory>/helacart-<UTC timestamp>.dump (default ./backups),
// and validates the archive with `pg_restore --list`.
//
// Requirements: pg_dump/pg_restore on PATH with a major version >= the server
// (PostgreSQL 17 client for Neon PG17). Credentials are passed through PG*
// environment variables, never on the command line, so they do not appear in
// the process list. Store the resulting file encrypted and off the host.
// Restore drills: see OPERATIONS-RUNBOOK.md "Backups and restore drills".
import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const raw = process.env.DIRECT_URL;
if (!raw) {
  console.error('DIRECT_URL is not set. Use the direct (non-pooled) URL.');
  process.exit(1);
}
let url;
try {
  url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error();
} catch {
  console.error('DIRECT_URL must be a postgresql:// connection string.');
  process.exit(1);
}
if (url.hostname.includes('-pooler.'))
  console.warn(
    'Warning: DIRECT_URL points at a pooler host; use the direct endpoint.',
  );

const outDir = resolve(process.argv[2] ?? process.env.BACKUP_DIR ?? 'backups');
mkdirSync(outDir, { recursive: true, mode: 0o700 });
const stamp = new Date()
  .toISOString()
  .replace(/[-:]/g, '')
  .replace(/\..+$/, 'Z');
const file = resolve(outDir, `helacart-${stamp}.dump`);

const env = {
  ...process.env,
  PGHOST: url.hostname,
  PGPORT: url.port || '5432',
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
  PGSSLMODE: url.searchParams.get('sslmode') ?? 'require',
  PGAPPNAME: 'helacart-backup',
};
delete env.DATABASE_URL;
delete env.DIRECT_URL;

console.log(`Backing up ${env.PGDATABASE} on ${env.PGHOST} to ${file}`);
const dump = spawnSync(
  'pg_dump',
  [
    '--format=custom',
    '--no-owner',
    '--no-privileges',
    '--compress=6',
    `--file=${file}`,
  ],
  { env, stdio: 'inherit' },
);
if (dump.error || dump.status !== 0) {
  console.error(
    dump.error?.code === 'ENOENT'
      ? 'pg_dump was not found. Install the PostgreSQL client tools.'
      : 'pg_dump failed; the partial file must not be used.',
  );
  process.exit(1);
}
chmodSync(file, 0o600);

const list = spawnSync('pg_restore', ['--list', file], {
  env,
  encoding: 'utf8',
});
if (list.status !== 0) {
  console.error(
    'pg_restore could not read the archive; treat this backup as failed.',
  );
  process.exit(1);
}
const entries = list.stdout
  .split('\n')
  .filter((line) => line && !line.startsWith(';')).length;
console.log(
  `Backup complete: ${file} (${statSync(file).size} bytes, ${entries} archive entries).`,
);
