import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Auth, type DecodedIdToken, getAuth } from 'firebase-admin/auth';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';

@Injectable()
export class FirebaseAdminService {
  private readonly auth: Auth;

  constructor(config: ConfigService) {
    const appName = 'helacart-admin';
    const app =
      getApps().find((candidate) => candidate.name === appName) ??
      initializeApp(
        {
          credential: applicationDefault(),
          projectId: config.getOrThrow<string>('FIREBASE_PROJECT_ID'),
        },
        appName,
      );

    this.auth = getAuth(app);
  }

  verifyIdToken(token: string, checkRevoked = false): Promise<DecodedIdToken> {
    return this.auth.verifyIdToken(token, checkRevoked);
  }
}
