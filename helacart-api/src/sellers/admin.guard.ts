import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedRequest } from '../auth/firebase-auth.guard.js';

/**
 * Runs after FirebaseAuthGuard, which has already verified the token with
 * revocation checking (checkRevoked=true, never served from the token cache on
 * admin paths) and the account access status. The verified identity on the
 * request is reused instead of re-verifying.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user?.uid) throw new UnauthorizedException();
    const allowed = this.config.getOrThrow<string[]>('ADMIN_FIREBASE_UIDS');
    if (!request.user.email_verified || !allowed.includes(request.user.uid)) {
      throw new ForbiddenException(
        'Admin access requires a verified, allowed account',
      );
    }
    return true;
  }
}
