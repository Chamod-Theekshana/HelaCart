import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseAdminService } from './firebase-admin.service.js';

export type AuthenticatedRequest = Request & {
  user: DecodedIdToken;
};

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private readonly firebase: FirebaseAdminService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const match = request.headers.authorization?.match(/^Bearer\s+(\S+)$/i);
    if (!match) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      request.user = await this.firebase.verifyIdToken(match[1]);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired Firebase token');
    }
  }
}
