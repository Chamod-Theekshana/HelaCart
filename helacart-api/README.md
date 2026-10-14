# HelaCart API

Backend foundation and Firebase identity integration for the HelaCart Sri Lankan
goods marketplace. This is a working NestJS/Neon API milestone, **not a completed
ecommerce API**.

## What is implemented

- NestJS 12, TypeScript, native ESM (keep `"type": "module"`).
- Prisma 7.10 with the PostgreSQL driver adapter.
- Neon pooled runtime URL and separate direct CLI URL.
- Initial User, Seller and SellerMember schema and checked-in SQL migration.
- Firebase Admin initialization through Application Default Credentials.
- Firebase bearer-token verification and protected `GET /api/v1/auth/me`.
- Neon user-profile creation/update from verified Firebase claims.
- Email-verification state stored from the signed Firebase token.
- Environment validation, port 4000, configurable binding and CORS origins.
- Global DTO validation and Helmet security headers.
- Liveness and database readiness endpoints.
- Unit and HTTP tests that never connect to Neon.
- No placeholder Observe credentials, telemetry SDK or unused Mau deploy command.

Firebase identity verification is implemented. Registration, login, password reset and
verification-email screens belong in the future web and Flutter clients and use Firebase
client SDKs. There are no seller application or catalog write endpoints yet.
Seller approval, ownership authorization and last-owner rules must be implemented in
the application layer before exposing seller APIs. Creating a table does not implement
those workflows.

## Requirements

- Windows PowerShell (commands below), or equivalent shell.
- Node.js 24 LTS, patch 24.15.0 or newer; npm 11 or newer.
- A Neon project with an empty development database.
- Internet access for installing dependencies and reaching Neon.
- A Firebase project with Email/Password sign-in enabled.
- A Firebase Admin service-account JSON key for local development.

Check:

```powershell
node --version
npm --version
```

## First setup on Windows

Extract the archive to a new folder. The archive contains
`HelaCart-corrected/helacart-api`. Adjust the following path if you extract elsewhere.

```powershell
Set-Location C:\HelaCart-corrected\helacart-api
npm ci
Copy-Item .env.example .env
```

Copy the environment template only on first setup; do not overwrite an existing
configured .env when upgrading.

### Configure Neon

1. Create/select your HelaCart Neon project.
2. Create/select a development branch and an empty database.
3. Open Connect and select the same branch, database and role for both URLs.
4. With pooling enabled, copy the full URL into DATABASE_URL in .env.
5. With pooling disabled, copy the full URL into DIRECT_URL in .env.
6. Preserve the query parameters Neon supplies, including its TLS settings.
7. Use a role allowed to create tables for applying migrations.

DATABASE_URL is used by the API. DIRECT_URL is used by the Prisma CLI.
A Neon project API key is not a database connection URL.
Do not paste actual credentials into screenshots, source control or shared ZIPs.

### Configure Firebase Admin

1. In Firebase Console, select `helacart-949a0`.
2. Enable Email/Password under Authentication > Sign-in method.
3. Open Project settings > Service accounts and generate a new private key.
4. Store that JSON outside the repository, for example
   `C:\Users\YOUR_WINDOWS_USER\firebase\helacart-admin.json`.
5. Set `FIREBASE_PROJECT_ID=helacart-949a0` in `.env`.
6. Set `GOOGLE_APPLICATION_CREDENTIALS` in `.env` to the absolute JSON path.

Use forward slashes in the dotenv path on Windows, as shown in `.env.example`.
Never commit, upload or share the service-account JSON. The Firebase web API key is
used by client applications and manual sign-in tests; the NestJS Admin SDK does not
use it to verify tokens.

### Create the tables and start

The initial migration is already included. Apply it rather than generating a second
initial migration:

```powershell
npm run db:deploy
npm run build
npm run start:dev
```

Expected local addresses:

| Route | Meaning |
| --- | --- |
| http://localhost:4000/api/v1 | HelaCart API identifier |
| http://localhost:4000/api/v1/health | Process liveness; does not query the DB |
| http://localhost:4000/api/v1/health/ready | Runs SELECT 1 through Prisma |
| http://localhost:4000/api/v1/auth/me | Verifies a Firebase token and syncs the profile |

Successful readiness response:

```json
{"status":"ok","service":"helacart-api","database":"connected"}
```

A failed database readiness check returns HTTP 503 with a generic error.
Readiness confirms database connectivity, not migration status; use `npm run db:status`
to verify migrations.

In another PowerShell terminal:

```powershell
Invoke-RestMethod http://localhost:4000/api/v1/health/ready
npm run db:status
npm run db:studio
```

The tables should be empty. Registration and seller onboarding will populate them later.

### Test Firebase authentication from PowerShell

Create a test Email/Password user in Firebase Authentication. Obtain the Web API key
from Firebase Project settings > General, then run:

```powershell
$apiKey = "AIzaSyDi7n7insNugxe9Mi9H_vQL_Q6UTK-F5wI"
$body = @{
  email = "channarox573@gmail.com"
  password = "Chamodt20@"
  returnSecureToken = $true
} | ConvertTo-Json

$login = Invoke-RestMethod `
  -Method Post `
  -Uri "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$apiKey" `
  -ContentType "application/json" `
  -Body $body

Invoke-RestMethod `
  -Method Get `
  -Uri "http://localhost:4000/api/v1/auth/me" `
  -Headers @{ Authorization = "Bearer $($login.idToken)" }
```

The first successful request creates the Neon profile. Later requests update the email,
email-verification flag and non-empty Firebase display name. A missing, malformed,
expired or incorrectly signed token returns HTTP 401. The response is marked no-store.

## Environment settings

| Variable | Purpose |
| --- | --- |
| NODE_ENV | development, test or production |
| PORT | HTTP port; defaults to 4000 |
| HOST | Defaults to 127.0.0.1 for local development |
| CORS_ORIGINS | Comma-separated exact origins, e.g. http://localhost:3000 |
| DATABASE_URL | PostgreSQL URL for application traffic |
| DIRECT_URL | PostgreSQL URL for Prisma migration/administrative commands |
| FIREBASE_PROJECT_ID | Firebase project whose ID tokens this API accepts |
| GOOGLE_APPLICATION_CREDENTIALS | Absolute path to the private Admin JSON for local use |

CORS values must not contain paths, wildcards or trailing slashes.
CORS is browser access policy, not authentication. Cookie credentials are disabled;
the next auth stage must explicitly design cookie/CSRF handling if cookies are used.
Neon and production connection strings must specify sslmode=require or stronger.
TLS verification has not been disabled in the driver.

For a cloud container, set HOST=0.0.0.0. For a physical phone on your local network,
use HOST=0.0.0.0, allow the port in Windows Firewall, and connect to your computer's
LAN IP rather than localhost. The Android emulator commonly reaches the host at
10.0.2.2. Do not publicly expose development APIs just to test a phone.

## Commands

| Command | Purpose |
| --- | --- |
| npm ci | Reproducible installation from package-lock.json |
| npm run start:dev | Generate Prisma client and run Nest watch mode |
| npm run start:dev:ipv4 | Run watch mode with IPv4 preferred when local IPv6 connections stall |
| npm run build | Generate client and compile to dist |
| npm run start:prod | Run compiled dist/main.js; requires a prior build |
| npm run check | Schema validation, formatting, lint, typecheck, tests and build |
| npm test | Unit tests |
| npm run test:e2e | HTTP tests with a mocked database |
| npm run prisma:generate | Regenerate Prisma client |
| npm run db:deploy | Apply checked-in migrations |
| npm run db:migrate -- --name describe_change | Create/apply a new migration in development |
| npm run db:status | Check migration status |
| npm run db:studio | Inspect database with Prisma Studio |

The Prisma client is generated into src/generated/prisma and is not included in
the archive or Git. Build and relevant start/test commands regenerate it.
No real database is required for `npm run check`; the test fixture overrides
inherited database settings and replaces the Prisma provider.

After editing the schema, run `npm run db:migrate -- --name your_change` on a
development database and `npm run prisma:generate`. Review and commit the migration.
For production, use reviewed migrations with `npm run db:deploy`, never migrate dev
or migrate reset.

## Project layout

| Path | Purpose |
| --- | --- |
| src/main.ts | Bootstraps server, configured port/host and shutdown hooks |
| src/configure-app.ts | API prefix, security headers, CORS and DTO validation |
| src/config/environment.ts | Validates startup settings |
| src/prisma/ | Shared Prisma module and connection lifecycle |
| src/health/ | Liveness and readiness routes |
| src/auth/ | Firebase Admin setup, auth guard, profile sync and `/auth/me` |
| prisma/schema.prisma | Database models |
| prisma/migrations/ | Versioned SQL migrations |
| prisma.config.ts | CLI database configuration |
| test/ | Isolated HTTP tests |

User IDs and seller IDs are UUIDs. Users may belong to multiple sellers.
Each user/seller membership pair is unique. Sellers default to PENDING.
Foreign keys prevent deleting users/sellers that still have memberships.
There is no admin privilege field or public role-assignment endpoint.

## Troubleshooting

**Invalid environment / DATABASE_URL:** Replace the example with the full PostgreSQL
connection URL, not a dashboard URL. Confirm .env is beside package.json.

**P1001 / timeout:** Check the selected Neon branch/endpoint, credentials, TLS
parameters and network access to PostgreSQL. Wake the endpoint in Neon if needed.
Do not fix TLS errors by disabling certificate verification.

If IPv4 reaches Neon but IPv6 times out on your network, use
`npm run start:dev:ipv4`. This project command passes the IPv4 preference to
Nest's watch process without changing your system-wide Node settings.

**Tables already exist / migration conflict:** This ZIP starts from an empty database.
If your chosen database already contains tables, stop and use a new empty development
database, or plan a migration baseline. Do not reset a database containing useful data.

**Cannot find generated Prisma client:** Run npm run prisma:generate, then npm run build.
Keep prisma, @prisma/client and @prisma/adapter-pg on the included matching version.

**ES module / CommonJS errors:** This uploaded project was ESM and remains ESM.
Keep the .js suffixes on relative TypeScript imports, moduleFormat="esm", and
"type":"module". Do not paste the older CommonJS sample into this project.

**Port in use:** Change PORT in .env, restart and use the matching URL.

**PowerShell blocks npm.ps1:** Use npm.cmd in place of npm. Do not weaken machine-wide
script policy just for these setup commands.

**Could not load the default credentials:** Confirm the JSON path in
GOOGLE_APPLICATION_CREDENTIALS exists, uses forward slashes in `.env`, and points to
the service-account key for the same Firebase project.

**Invalid or expired Firebase token:** Sign in again to obtain a fresh ID token. Confirm
the client and backend use `helacart-949a0`; do not send a custom token or refresh token.

## Git and ZIP hygiene

No .git or nested Git repositories are included. If starting a new repository, run
git init once in your chosen root (for example C:\HelaCart-corrected), then commit.
Do not run git init again in helacart-api if its parent already owns the project.

Commit package-lock.json, schema.prisma, migrations and .env.example.
Do not commit .env, node_modules, dist, generated clients or database credentials.

## Before a production marketplace launch

Next work: seller application and admin approval; administrator authorization;
seller-scoped authorization; catalog/inventory; orders, payments and payouts.
Also add rate limits, authenticated API auditing, deployment monitoring and backup
restore drills. These are future features, not implied by this starter's health checks.
