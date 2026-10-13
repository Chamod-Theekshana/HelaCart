import { Controller, Get, Header, Req, UseGuards } from '@nestjs/common';
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
  @Header('Cache-Control', 'no-store')
  getMe(@Req() request: AuthenticatedRequest) {
    return this.authService.getOrCreateProfile(request.user);
  }
}
