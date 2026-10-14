# Start here: HelaCart COD backend update

1. Back up your current `C:\HelaCart\helacart-api` source and development database.
2. Merge the `helacart-api` source into your working copy. Keep your existing `.env`
   and Firebase service-account JSON; do not overwrite either. Check for your own
   source changes before replacing files.
3. In PowerShell inside your existing API folder run `npm ci`.
4. Set up Cloudflare R2 and add all five `R2_*` variables from `.env.example` to
   your existing `.env` if you want image uploads.
5. Run `npm run db:deploy`, then `npm run db:status`. This release has seven
   checked-in migrations including `20261015030000_operations`. Never use
   `migrate reset` against your working database.
6. Run `npm run check`, then restart `npm run start:dev`.
7. Check `http://localhost:4000/api/v1/health/ready` for `database: connected`.
8. Use `helacart-api/README.md` for PowerShell tests of image uploads,
   notifications, admin-reviewed returns and COD reconciliation.

This update adds backend workflows for a manually operated COD pilot. Actual R2,
Neon/Firebase integration, web and mobile clients, real remittance and production
security/operations must still be completed and tested. No private keys or `.env`
files are included.
