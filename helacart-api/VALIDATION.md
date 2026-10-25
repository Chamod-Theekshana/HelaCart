# Validation report

Verified on Linux with Node.js 24.19.0 and npm 11.9.0.
Windows setup instructions are supplied, but were not executed on Windows here.

The inventory, COD and operations migrations and workflows were exercised against
an isolated PGlite PostgreSQL instance. This archive has not applied the new migrations
to the user's live Neon DB.

## Automated checks

- Dependencies reused from the previously validated catalog archive in this sandbox;
  a fresh offline `npm ci` could not complete because one tarball was uncached.
- Prisma schema validation and client generation: passed.
- Prettier formatting check: passed.
- Oxlint with warnings denied: passed.
- Full TypeScript typecheck: passed.
- Unit tests: 19 passed in the latest operations run.
- HTTP tests: 44 passed in the latest operations run (database and Firebase providers mocked).
- Production compilation: passed.

## Database and runtime validation

An isolated PGlite PostgreSQL WASM database with a local PostgreSQL protocol socket
was used for integration checks; it is not a production Neon instance.

- Applied the earlier checked-in foundation migration through Prisma migrate deploy.
- Prisma migrate status reported up to date.
- Prisma database-to-schema diff reported no difference.
- Created user, seller and owner membership through the generated Prisma client.
- Verified the default pending seller state.
- Verified duplicate membership rejection and foreign-key deletion protection.
- Started the compiled dist/main.js server with the real PostgreSQL adapter.
- Verified HTTP 200 on liveness and database readiness endpoints.
- Deployed all four checked-in migrations into a fresh isolated PGlite instance for
  this milestone, then used Prisma to create users, an approved seller, category,
  product and audited approval. Confirmed public filtering and unpublishing on edit.
- Applied the first four migrations in an isolated PGlite database, inserted an
  existing product, then applied the inventory migration. Verified the default
  variant preserves SKU/price and begins with zero stock.
- Exercised real Prisma stock adjustments, an audit record, two concurrent
  reservations for five units (only one four-unit reservation succeeded), a
  rejected reduction below reserved stock, idempotent release and commit,
  final stock balance and commit audit.
- Applied all six migrations in another isolated database; created a seller,
  approved product and two buyers. Two concurrent COD checkouts competed for
  one unit: exactly one succeeded. Verified order totals, idempotent retry,
  cancellation restock, subsequent checkout, seller fulfillment and COD marker.
- Prisma `migrate deploy` applied all six migrations to a fresh isolated database;
  `migrate status` and database-to-schema diff reported no outstanding changes.

## Limits

The user previously confirmed Neon readiness, Firebase `/auth/me` and a successful
seller approval on their own Windows machine. The COD and operations migrations have **not** been
deployed to that database by this delivery. Apply it with `npm run db:deploy`, then
check `npm run db:status` and `/health/ready` before testing catalog endpoints.
PGlite exercised the conditional database updates, but it does not establish
production load, cloud compatibility or availability guarantees.

Admin and seller-access behavior was tested with a mocked Firebase verifier. Real
tokens, the user's database and externally hosted product images still require
manual end-to-end testing on the user's machine. No private credential is included.

Online payments, automated refunds/payouts and courier integration are still needed. COD checkout uses immediate stock
deduction; the internal reservation service runs its expiry loop for future flows.
The checkout integration used PGlite, not a live Neon/Firebase environment.

## COD pilot operations verification (2026-10-14)

- Installed dependencies with `npm ci` and pinned `@aws-sdk/client-s3`.
- `npm run check`: schema validation, formatting, lint, TypeScript, 19 unit
  tests, 44 HTTP tests and production compilation (see latest run).
- Applied all seven checked-in migrations with Prisma migrate deploy to an
  isolated PGlite PostgreSQL database. Status and schema diff were clean.
- Against a separate isolated database: raced two COD checkouts for one item;
  verified idempotency, cancellation restock and fulfillment. Then exercised
  private notifications, return ownership/uniqueness/review/resolution, COD
  dispute followed by full reconciliation, and the unread queue.
- R2 calls, real Firebase ID tokens and the user's Neon database were not
  available here; verify these with your own credentials in development.

## COD pilot safeguard verification (2026-10-19)

- `npm run check` passed: Prisma validation, formatting, lint, typecheck,
  21 unit tests, 45 HTTP tests and a production build.
- Local PostgreSQL-compatible integration repeated concurrent checkout,
  cancellation, fulfillment, notification, return and COD reconciliation
  flows with the return deadline and paginated admin queues.
- The Dockerfile was inspected against compiled `dist` and generated Prisma
  client paths; Docker is unavailable in this workspace, so image build and
  hosted staging checks remain operator verification items.
