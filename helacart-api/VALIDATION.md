# Validation

This file describes how to verify the API and what has and has not been
verified. Test counts are intentionally not recorded here: they change with
every release; read them from the test runner or the CI log instead.

## How to verify a change

On Node.js 24 (`.nvmrc`) with npm 11:

```bash
npm ci
npm run check        # prisma validate, prettier, oxlint, tsc, unit + HTTP tests, build
```

`npm run check` never contacts a real database or Firebase: unit tests use
mocks and the HTTP tests (`test/*.e2e-spec.ts`) override Prisma and Firebase
providers (see `test/setup-env.ts`).

Migrations are verified against a real, empty PostgreSQL 17 database:

```bash
docker run --rm -d --name helacart-pg -e POSTGRES_USER=ci -e POSTGRES_PASSWORD=ci \
  -e POSTGRES_DB=helacart_ci -p 5432:5432 postgres:17
DIRECT_URL=postgresql://ci:ci@127.0.0.1:5432/helacart_ci npx prisma migrate deploy
DIRECT_URL=postgresql://ci:ci@127.0.0.1:5432/helacart_ci npx prisma migrate status
```

CI (`.github/workflows/api.yml`) runs both on every push and pull request that
touches `helacart-api/`. Raw-SQL objects (partial and trigram indexes,
triggers, CHECK constraints) are not modelled in `schema.prisma`, so a
`prisma migrate diff` against the schema reports them; CI shows that diff
without failing.

Workflow scripts in `scripts/verify-*.mjs` exercise individual flows against a
disposable database; run them only against development data.

## Manual checks before a release

- Start the built API (`npm run build && npm run start:prod`) against a
  staging database and probe `/api/v1/health` and `/api/v1/health/ready`.
- Real Firebase tokens: `/auth/me`, a seller route and an admin route.
- One COD order end to end: checkout, accept, pack, ship, `DELIVERY_FAILED`,
  re-ship, buyer confirm-receipt; one cancellation and one
  `RETURNED_TO_SELLER`, checking that stock is restored and that commission is
  charged only for the delivered order.
- Phone verification with a real Notify.lk account, one email through Resend
  and one push to a test device; confirm the `NotificationDelivery` rows reach
  `SENT` (or `SKIPPED` with a reason).
- Upload a JPEG taken on a phone with location enabled and confirm the stored
  object has no EXIF/GPS (`exiftool` shows none).
- Seller suspension and reinstatement; account deletion of a test buyer.
- `npm run db:backup` followed by the restore drill in `OPERATIONS-RUNBOOK.md`.

## Status of the November 2026 hardening release

The release was implemented in an environment without access to the npm
registry, so `npm ci`, the Prisma client generator, the TypeScript compiler with
real dependency types, the test runner and PostgreSQL were **not** available.
Checks that were performed there:

- Prettier (global 3.8) on every changed TypeScript file.
- `tsc --noEmit` without dependency types: no syntax errors; remaining errors
  were limited to unresolved packages and the ungenerated Prisma client.
- Line-by-line review of every changed file, the migrations against the
  existing triggers and constraints, and the new unit and HTTP specs.

Everything in "How to verify a change" therefore still has to run once on a
Node 24 machine (or in CI) before this release is deployed.

## Earlier milestones

Earlier milestones were verified with `npm run check` and with isolated
PostgreSQL-compatible databases (PGlite): migrations applied with
`prisma migrate deploy` and a clean `migrate status`, concurrent COD checkouts
competing for one unit (exactly one succeeded), idempotent checkout retry,
cancellation restock, fulfilment, notifications, returns and COD
reconciliation. R2, real Firebase tokens, the user's Neon database, Docker and
hosted staging were not available in those environments and remain operator
verification items.
