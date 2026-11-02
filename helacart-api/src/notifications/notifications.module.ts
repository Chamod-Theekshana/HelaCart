import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import {
  NotificationSettingsController,
  NotificationsController,
} from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationSettingsService } from './notification-settings.service.js';
import { ChannelProvidersService } from './channel-providers.service.js';
import { NotificationDeliveryService } from './notification-delivery.service.js';
import { NotificationDeliveryWorker } from './notification-delivery.worker.js';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [NotificationsController, NotificationSettingsController],
  providers: [
    NotificationsService,
    NotificationSettingsService,
    ChannelProvidersService,
    NotificationDeliveryService,
    NotificationDeliveryWorker,
  ],
  exports: [NotificationsService, ChannelProvidersService],
})
export class NotificationsModule {}
