import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SellersModule } from '../sellers/sellers.module.js';
import {
  AdminCatalogController,
  PublicCatalogController,
  SellerCatalogController,
} from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';
import { ReservationService } from './reservation.service.js';
import { ReservationExpiryService } from './reservation-expiry.service.js';

@Module({
  imports: [AuthModule, PrismaModule, SellersModule],
  controllers: [
    PublicCatalogController,
    SellerCatalogController,
    AdminCatalogController,
    InventoryController,
  ],
  providers: [
    CatalogService,
    InventoryService,
    ReservationService,
    ReservationExpiryService,
  ],
  exports: [CatalogService, ReservationService],
})
export class CatalogModule {}
