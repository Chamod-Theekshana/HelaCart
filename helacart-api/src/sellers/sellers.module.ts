import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AdminGuard } from './admin.guard.js';
import {
  AdminSellerApplicationsController,
  SellerApplicationsController,
} from './seller-applications.controller.js';
import { SellerApplicationsService } from './seller-applications.service.js';
import { SellerDocumentsService } from './seller-documents.service.js';
import { ShopVerificationService } from './shop-verification.service.js';
import { AdminSellersController } from './seller-status.controller.js';
import { SellerStatusService } from './seller-status.service.js';

@Module({
  imports: [AuthModule, PrismaModule, NotificationsModule],
  controllers: [
    SellerApplicationsController,
    AdminSellerApplicationsController,
    AdminSellersController,
  ],
  providers: [
    SellerApplicationsService,
    SellerDocumentsService,
    ShopVerificationService,
    SellerStatusService,
    AdminGuard,
  ],
  exports: [AdminGuard],
})
export class SellersModule {}
