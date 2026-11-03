import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SellersModule } from '../sellers/sellers.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { CommissionReceiptsService } from './commission-receipts.service.js';
import { CommissionService } from './commission.service.js';
import {
  AdminCommissionController,
  SellerCommissionController,
} from './commission.controller.js';
@Module({
  imports: [AuthModule, PrismaModule, SellersModule, NotificationsModule],
  controllers: [AdminCommissionController, SellerCommissionController],
  providers: [CommissionService, CommissionReceiptsService],
})
export class CommissionModule {}
