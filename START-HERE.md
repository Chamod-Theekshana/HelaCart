# Start here: HelaCart backend with Firebase authentication

Open helacart-api/README.md for the full Windows and Neon instructions.
See helacart-api/CHANGES.md for the review and helacart-api/VALIDATION.md for checks.

1. Install Node.js 24 LTS (24.15.0 or newer).
2. Open PowerShell in the helacart-api folder.
3. Run npm ci.
4. Copy .env.example to .env and insert both Neon development connection URLs.
5. Download a Firebase Admin service-account key, keep it outside this project,
   and set FIREBASE_PROJECT_ID plus GOOGLE_APPLICATION_CREDENTIALS in .env.
6. Run npm run db:deploy against your development database.
7. Run npm run build, then npm run start:dev.
8. Open http://localhost:4000/api/v1/health/ready.
9. Follow the Firebase test steps in helacart-api/README.md for /api/v1/auth/me.

This is the backend foundation and Firebase identity milestone, not a complete marketplace.
No actual credentials, dependency folders, compiled files or Git repositories are included.
If the database already contains tables, read the migration-conflict section before proceeding.
