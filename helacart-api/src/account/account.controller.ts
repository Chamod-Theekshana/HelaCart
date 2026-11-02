import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  FirebaseAuthGuard,
  type AuthenticatedRequest,
} from '../auth/firebase-auth.guard.js';
import { AccountService } from './account.service.js';
import { DeleteAccountDto } from './account.dto.js';

@Controller('me')
@UseGuards(FirebaseAuthGuard)
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get('data-export')
  @Header('Cache-Control', 'private, no-store')
  async export(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.account.exportData(request.user);
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    return new StreamableFile(file.body);
  }

  @Delete('account')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async remove(
    @Req() request: AuthenticatedRequest,
    @Body() dto: DeleteAccountDto,
  ) {
    // DeleteAccountDto already rejects anything but { "confirm": "DELETE" }.
    if (dto.confirm === 'DELETE')
      await this.account.deleteAccount(request.user);
  }
}
