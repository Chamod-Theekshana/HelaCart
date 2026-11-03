import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  FirebaseAuthGuard,
  type AuthenticatedRequest,
} from '../auth/firebase-auth.guard.js';
import { PhoneVerificationService } from './phone-verification.service.js';
import {
  ConfirmPhoneVerificationDto,
  StartPhoneVerificationDto,
} from './phone-verification.dto.js';

@Controller('me')
@UseGuards(FirebaseAuthGuard)
export class PhoneVerificationController {
  constructor(private readonly phones: PhoneVerificationService) {}
  @Post('phone-verifications') @Header('Cache-Control', 'no-store') start(
    @Req() request: AuthenticatedRequest,
    @Body() dto: StartPhoneVerificationDto,
  ) {
    return this.phones.start(request.user, dto.phone);
  }
  @Post('phone-verifications/:verificationId/confirm')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  confirm(
    @Req() request: AuthenticatedRequest,
    @Param('verificationId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ConfirmPhoneVerificationDto,
  ) {
    return this.phones.confirm(request.user, id, dto.code);
  }
  @Get('verified-phones') @Header('Cache-Control', 'private, no-store') list(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.phones.verifiedPhones(request.user);
  }
}
