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

@Module({
  imports: [AuthModule, PrismaModule, SellersModule],
  controllers: [
    PublicCatalogController,
    SellerCatalogController,
    AdminCatalogController,
  ],
  providers: [CatalogService],
})
export class CatalogModule {}
