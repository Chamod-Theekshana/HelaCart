# HelaCart COD pilot operations

## Release to a staging environment

1. Back up or branch the Neon database and confirm the restoration procedure in
   its dashboard. Keep the previous application build available for rollback.
2. Set runtime environment values from `.env.example` in your hosting provider:
   pooled DATABASE_URL, Firebase project, R2 bucket credentials and public URL,
   admin UID allowlist, allowed CORS origins, HOST=0.0.0.0, and NODE_ENV=production.
   Set GOOGLE_APPLICATION_CREDENTIALS to a mounted secret file, or use the
   platform's application default credentials. Never bake a private key into an image.
3. From a migration job with full dependencies and the direct database URL, run
   `npm ci`, `npm run db:status`, then `npm run db:deploy`. Apply migrations
   once per release. Do not run migrate reset or migrate dev on staging/production.
4. Build the image with `docker build -t helacart-api:pilot .` and start it in
   your hosting provider. Expose it only behind HTTPS. The image starts the API;
   it deliberately does not run migrations.
5. Probe `/api/v1/health/ready`, then test a verified buyer, seller and admin
   against staging. Create a low-cost COD order, upload one product image, and
   check notifications, return review and COD reconciliation using test records.
6. Review logs for errors, monitor database connection/CPU, and confirm the R2
   public custom domain serves the uploaded image.

## Security and traffic

`TRUST_PROXY_HOPS=0` is the safe default. Set it to `1` only when exactly one
trusted reverse proxy is in front of the API **and direct access to the API is
blocked**. This makes Express use the client's address for the per-process
request limit. Use an edge or shared-store rate limit on Cloudflare/ingress when
running multiple API replicas. The built-in limit is 180 requests per minute
per address; write attempts to checkout, returns and image upload share a
20-per-minute limit. Never log bearer tokens or private credentials.

Set `RETURN_WINDOW_DAYS` to your published policy before taking real orders;
the default is 14 calendar days from the seller order delivery event. The
admin reviews return requests and records manual resolution; agree how actual
refunds/replacements, reverse logistics and shipping fees will be handled.

## Daily admin queue

- Review `GET /api/v1/admin/returns/page?status=PENDING&limit=20`; pass the
  returned `nextCursor` as `cursor` to read the following page.
- Confirm COD cash/deposit evidence outside the API, then review
  `GET /api/v1/admin/cod/reconciliation-queue/page?limit=20`.
- Record the full amount and unique remittance reference. A mismatched amount
  creates a DISPUTED record; investigate, then enter a new reference when the
  full amount is confirmed. The API does not move cash or issue a seller payout.
- Recount stock when physical stock differs and record seller stock adjustments
  with the actual reason. Periodically review return and stock movement history.

## Recovery and rollout limits

All migrations are forward-only. Rolling back a deployed application does not
roll back database changes. Verify the prior build can read the expanded schema
before rolling back; restore from a tested database backup if a destructive
rollback is ever required. Health readiness checks database connectivity; use
`npm run db:status` to check migration state. Keep Cloudflare R2 credentials,
Neon credentials and Firebase service accounts rotated and restricted.

This package does not operate your bank account, shipping company, hosting
platform, monitoring service or backups. Their live checks and policy choices
must be completed by the operator before public launch.
