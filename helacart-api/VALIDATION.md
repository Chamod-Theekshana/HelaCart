# Validation report

Verified on Linux with Node.js 24.19.0 and npm 11.9.0.
Windows setup instructions are supplied, but were not executed on Windows here.

The latest catalog migration and product lifecycle were also exercised against an
isolated PGlite PostgreSQL instance. This archive has not applied that new migration
to the user's live Neon DB.

## Automated checks

- Clean dependency install using npm ci: passed.
- Prisma schema validation and client generation: passed.
- Prettier formatting check: passed.
- Oxlint with warnings denied: passed.
- Full TypeScript typecheck: passed.
- Unit tests: 18 passed.
- HTTP tests: 34 passed (database and Firebase providers mocked).
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

## Limits

The user previously confirmed Neon readiness, Firebase `/auth/me` and a successful
seller approval on their own Windows machine. The catalog migration has **not** been
deployed to that database by this delivery. Apply it with `npm run db:deploy`, then
check `npm run db:status` and `/health/ready` before testing catalog endpoints.
PGlite is useful for functional checks but does not establish production concurrency,
load, cloud compatibility or availability guarantees.

Admin and seller-access behavior was tested with a mocked Firebase verifier. Real
tokens, the user's database and externally hosted product images still require
manual end-to-end testing on the user's machine. No private credential is included.

Product image hosting, stock, variants, checkout and payment features do not exist
yet. This adds a moderated catalog API, not a complete storefront.
