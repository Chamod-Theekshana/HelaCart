import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { DecodedIdToken } from 'firebase-admin/auth';
import { AuthService } from './auth.service.js';
import {
  FirebaseAuthGuard,
  type AuthenticatedRequest,
} from './firebase-auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(FirebaseAuthGuard)
  getMe(@Req() request: AuthenticatedRequest) {
    return this.authService.getOrCreateProfile(request.user as DecodedIdToken);
  }
}
