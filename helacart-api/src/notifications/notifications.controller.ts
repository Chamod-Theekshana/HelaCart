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
