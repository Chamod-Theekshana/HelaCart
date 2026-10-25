import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FirebaseAdminService } from '../auth/firebase-admin.service.js';
import type { AuthenticatedRequest } from '../auth/firebase-auth.guard.js';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly firebase: FirebaseAdminService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token =
      request.headers.authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token || !request.user) throw new UnauthorizedException();

    // Admin decisions must reject a revoked session, even if its JWT has not expired.
    try {
      request.user = await this.firebase.verifyIdToken(token, true);
    } catch {
      throw new UnauthorizedException('Invalid or revoked Firebase token');
    }

    const allowed = this.config.getOrThrow<string[]>('ADMIN_FIREBASE_UIDS');
    if (!request.user.email_verified || !allowed.includes(request.user.uid)) {
      throw new ForbiddenException(
        'Admin access requires a verified, allowed account',
      );
    }
    return true;
  }
}
