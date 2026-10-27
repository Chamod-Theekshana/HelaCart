import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { SellersModule } from '../sellers/sellers.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { DiscoveryService } from './discovery.service.js';
import { PromotionsService } from './promotions.service.js';
import { FavoriteAlertsService } from './favorite-alerts.service.js';
import { DiscoveryWorker } from './discovery-worker.service.js';
import {
  PublicDiscoveryController,
  BuyerDiscoveryController,
  SellerPromotionsController,
  AdminPromotionsController,
} from './discovery.controller.js';
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CatalogModule,
    SellersModule,
    NotificationsModule,
  ],
  providers: [
    DiscoveryService,
    PromotionsService,
    FavoriteAlertsService,
    DiscoveryWorker,
  ],
  controllers: [
    PublicDiscoveryController,
    BuyerDiscoveryController,
    SellerPromotionsController,
    AdminPromotionsController,
  ],
})
export class DiscoveryModule {}
