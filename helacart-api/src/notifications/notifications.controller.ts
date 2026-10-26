import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  FirebaseAuthGuard,
  type AuthenticatedRequest,
} from '../auth/firebase-auth.guard.js';
import { NotificationsService } from './notifications.service.js';

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
