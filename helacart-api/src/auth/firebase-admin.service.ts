import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Auth, type DecodedIdToken, getAuth } from 'firebase-admin/auth';
import {
  type App,
  applicationDefault,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import {
  type BatchResponse,
  type MulticastMessage,
  getMessaging,
} from 'firebase-admin/messaging';

@Injectable()
export class FirebaseAdminService {
  private readonly app: App;
  private readonly auth: Auth;

  constructor(config: ConfigService) {
    const appName = 'helacart-admin';
    this.app =
      getApps().find((candidate) => candidate.name === appName) ??
      initializeApp(
        {
          credential: applicationDefault(),
          projectId: config.getOrThrow<string>('FIREBASE_PROJECT_ID'),
        },
        appName,
      );

    this.auth = getAuth(this.app);
  }

  verifyIdToken(token: string, checkRevoked = false): Promise<DecodedIdToken> {
    return this.auth.verifyIdToken(token, checkRevoked);
  }

  /** Removes the Firebase sign-in account (PDPA account deletion). */
  async deleteUser(uid: string): Promise<void> {
    await this.auth.deleteUser(uid);
  }

  /** Sends one FCM message to up to 500 device tokens. */
  sendPush(message: MulticastMessage): Promise<BatchResponse> {
    return getMessaging(this.app).sendEachForMulticast(message);
  }
}
