import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SellersModule } from '../sellers/sellers.module.js';
import {
  AdminOperationsController,
  BuyerReturnsController,
} from './operations.controller.js';
import { OperationsService } from './operations.service.js';

@Module({
  imports: [AuthModule, PrismaModule, SellersModule, NotificationsModule],
  controllers: [BuyerReturnsController, AdminOperationsController],
  providers: [OperationsService],
})
export class OperationsModule {}
