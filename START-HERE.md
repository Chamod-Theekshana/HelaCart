# Start here: HelaCart moderated product catalog

Open helacart-api/README.md for the full Windows and Neon instructions.
See helacart-api/CHANGES.md for the review and helacart-api/VALIDATION.md for checks.

1. Install Node.js 24 LTS (24.15.0 or newer).
2. Open PowerShell in the helacart-api folder.
3. Run npm ci.
4. On a fresh install only, copy .env.example to .env and insert both Neon development
   connection URLs. Keep your working `.env` unchanged when upgrading.
5. Download a Firebase Admin service-account key, keep it outside this project,
   and set FIREBASE_PROJECT_ID plus GOOGLE_APPLICATION_CREDENTIALS in .env.
6. Add the verified admin account's Firebase UID to ADMIN_FIREBASE_UIDS in .env.
7. Run npm run db:deploy against your development database. Never reset the database.
8. Run npm run check, then npm run start:dev.
9. Open http://localhost:4000/api/v1/health/ready.
10. Follow the Firebase, seller and product publishing test steps in
    helacart-api/README.md.

This is the backend foundation, Firebase identity, seller review and first
moderated product catalog milestone, not a complete marketplace.
No actual credentials, dependency folders, compiled files or Git repositories are included.
If upgrading an existing HelaCart database, preserve its data and apply the new
checked-in catalog migration. Read the migration-conflict section if Prisma reports
a mismatch.
