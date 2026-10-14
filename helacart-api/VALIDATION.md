# Validation report

Verified on Linux with Node.js 24.19.0 and npm 11.9.0.
Windows setup instructions are supplied, but were not executed on Windows here.

The earlier database/runtime checks below apply to the foundation migrations. The
new seller-review migration and routes have been schema-validated and tested with
mocked providers, but this archive has not applied them to the user's live Neon DB.

## Automated checks

- Clean dependency install using npm ci: passed.
- Prisma schema validation and client generation: passed.
- Prettier formatting check: passed.
- Oxlint with warnings denied: passed.
- Full TypeScript typecheck: passed.
- Unit tests: 18 passed.
- HTTP tests: 21 passed (database and Firebase providers mocked).
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

## Limits

The user previously confirmed their Neon readiness endpoint and Firebase `/auth/me`
on their own Windows machine. This seller migration has **not** been deployed to that
database by this delivery. Apply it using `npm run db:deploy`, then check
`npm run db:status` and `/health/ready` before testing seller endpoints.
PGlite is useful for functional checks but does not establish production concurrency,
load, cloud compatibility or availability guarantees.

The new guard's revoked-token and allowlist behavior was tested with a mocked token
verifier. A real admin UID, verified ID token and deployed database are needed for an
end-to-end test on the user's machine. No private service-account credential is included.

Full seller authorization for future product routes, catalog, checkout and payment
features do not exist yet. This adds application/review API behavior only.
