import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Auth } from 'firebase-admin/auth';
import { Request } from 'express';
import { FIREBASE_AUTH } from './firebase-auth.constants.js';

export type AuthenticatedRequest = Request & {
  user: {
    uid: string;
    email?: string;
    name?: string;
    email_verified?: boolean;
  };
};

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(@Inject(FIREBASE_AUTH) private readonly firebaseAuth: Auth) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const idToken = authorization.slice('Bearer '.length);

    try {
      request.user = await this.firebaseAuth.verifyIdToken(idToken);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired Firebase token');
    }
  }
}