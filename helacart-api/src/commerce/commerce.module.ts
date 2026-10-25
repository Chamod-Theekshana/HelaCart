import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SellersModule } from '../sellers/sellers.module.js';
import {
  BuyerCommerceController,
  SellerCommerceController,
  AdminCommerceController,
} from './commerce.controller.js';
import { CommerceService } from './commerce.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CatalogModule,
    SellersModule,
    NotificationsModule,
  ],
  controllers: [
    BuyerCommerceController,
    SellerCommerceController,
    AdminCommerceController,
  ],
  providers: [CommerceService],
})
export class CommerceModule {}
