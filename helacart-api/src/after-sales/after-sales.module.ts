import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { SellersModule } from '../sellers/sellers.module.js';
import { AfterSalesService } from './after-sales.service.js';
import {
  BuyerAfterSalesController,
  SellerAfterSalesController,
  AdminAfterSalesController,
} from './after-sales.controller.js';
@Module({
  imports: [
    AuthModule,
    CatalogModule,
    PrismaModule,
    NotificationsModule,
    SellersModule,
  ],
  providers: [AfterSalesService],
  controllers: [
    BuyerAfterSalesController,
    SellerAfterSalesController,
    AdminAfterSalesController,
  ],
})
export class AfterSalesModule {}
