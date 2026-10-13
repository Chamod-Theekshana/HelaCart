# Start here: HelaCart corrected backend

Open helacart-api/README.md for the full Windows and Neon instructions.
See helacart-api/CHANGES.md for the review and helacart-api/VALIDATION.md for checks.

1. Install Node.js 24 LTS (24.15.0 or newer).
2. Open PowerShell in the helacart-api folder.
3. Run npm ci.
4. Copy .env.example to .env and insert both Neon development connection URLs.
5. Run npm run db:deploy against an EMPTY development database.
6. Run npm run build, then npm run start:dev.
7. Open http://localhost:4000/api/v1/health/ready.

This is the corrected backend foundation, not a complete marketplace.
No actual credentials, dependency folders, compiled files or Git repositories are included.
If the database already contains tables, read the migration-conflict section before proceeding.
