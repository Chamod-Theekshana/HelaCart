# Validation report

Verified on Linux with Node.js 24.19.0 and npm 11.9.0.
Windows setup instructions are supplied, but were not executed on Windows here.

## Automated checks

- Clean dependency install using npm ci: passed.
- Prisma schema validation and client generation: passed.
- Prettier formatting check: passed.
- Oxlint with warnings denied: passed.
- Full TypeScript typecheck: passed.
- Unit tests: 16 passed.
- HTTP tests: 8 passed (database provider mocked).
- Production compilation: passed.

## Database and runtime validation

An isolated PGlite PostgreSQL WASM database with a local PostgreSQL protocol socket
was used for integration checks; it is not a production Neon instance.

- Applied the checked-in migration through Prisma migrate deploy.
- Prisma migrate status reported up to date.
- Prisma database-to-schema diff reported no difference.
- Created user, seller and owner membership through the generated Prisma client.
- Verified the default pending seller state.
- Verified duplicate membership rejection and foreign-key deletion protection.
- Started the compiled dist/main.js server with the real PostgreSQL adapter.
- Verified HTTP 200 on liveness and database readiness endpoints.

## Limits

No Neon credentials were included in the uploaded ZIP. The user's Neon endpoint,
TLS handshake, roles/permissions, network access, plan limits and cold-start behavior
have not been tested. Add real URLs to .env and run db:deploy and the readiness check.
PGlite is useful for functional checks but does not establish production concurrency,
load, cloud compatibility or availability guarantees.

No customer registration, Firebase verification, seller authorization, catalog,
checkout or payment features exist yet. This is a tested backend foundation.
