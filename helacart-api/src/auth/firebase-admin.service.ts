import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Auth, DecodedIdToken, getAuth } from 'firebase-admin/auth';
import {
  applicationDefault,
  getApp,
  getApps,
  initializeApp,
} from 'firebase-admin/app';

@Injectable()
export class FirebaseAdminService {
  private readonly auth: Auth;

  constructor(config: ConfigService) {
    const app = getApps().length
      ? getApp()
      : initializeApp({
          credential: applicationDefault(),
          projectId: config.getOrThrow<string>('FIREBASE_PROJECT_ID'),
        });

    this.auth = getAuth(app);
  }

  verifyIdToken(token: string): Promise<DecodedIdToken> {
    return this.auth.verifyIdToken(token);
  }
}