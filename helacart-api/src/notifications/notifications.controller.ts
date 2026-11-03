import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  FirebaseAuthGuard,
  type AuthenticatedRequest,
} from '../auth/firebase-auth.guard.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationSettingsService } from './notification-settings.service.js';
import {
  NotificationPreferencesDto,
  RegisterDeviceDto,
  UnregisterDeviceDto,
} from './notification-settings.dto.js';

@Controller('me/notifications')
@UseGuards(FirebaseAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}
  @Get('inbox') @Header('Cache-Control', 'private, no-store') inbox(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.notifications.inbox(request.user);
  }
  @Patch('read-all') @Header('Cache-Control', 'private, no-store') readAll(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.notifications.markAllRead(request.user);
  }
  @Get() @Header('Cache-Control', 'no-store') list(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.notifications.list(request.user);
  }
  @Patch(':notificationId/read') @Header('Cache-Control', 'no-store') read(
    @Req() request: AuthenticatedRequest,
    @Param('notificationId', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.notifications.markRead(request.user, id);
  }
}

@Controller('me')
@UseGuards(FirebaseAuthGuard)
export class NotificationSettingsController {
  constructor(private readonly settings: NotificationSettingsService) {}
  @Post('devices') @Header('Cache-Control', 'private, no-store') register(
    @Req() request: AuthenticatedRequest,
    @Body() dto: RegisterDeviceDto,
  ) {
    return this.settings.registerDevice(request.user, dto);
  }
  @Post('devices/unregister')
  @HttpCode(204)
  @Header('Cache-Control', 'private, no-store')
  async unregister(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UnregisterDeviceDto,
  ) {
    await this.settings.unregisterDevice(request.user, dto.token);
  }
  @Get('notification-preferences')
  @Header('Cache-Control', 'private, no-store')
  preferences(@Req() request: AuthenticatedRequest) {
    return this.settings.preferences(request.user);
  }
  @Put('notification-preferences')
  @Header('Cache-Control', 'private, no-store')
  savePreferences(
    @Req() request: AuthenticatedRequest,
    @Body() dto: NotificationPreferencesDto,
  ) {
    return this.settings.savePreferences(request.user, dto);
  }
}
