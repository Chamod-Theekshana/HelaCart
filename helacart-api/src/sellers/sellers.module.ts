import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AdminGuard } from './admin.guard.js';
import {
  AdminSellerApplicationsController,
  SellerApplicationsController,
} from './seller-applications.controller.js';
import { SellerApplicationsService } from './seller-applications.service.js';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [
    SellerApplicationsController,
    AdminSellerApplicationsController,
  ],
  providers: [SellerApplicationsService, AdminGuard],
  exports: [AdminGuard],
})
export class SellersModule {}
