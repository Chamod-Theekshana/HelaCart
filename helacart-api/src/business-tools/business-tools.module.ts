import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { SellersModule } from '../sellers/sellers.module.js';
import {
  SellerBusinessToolsController,
  AdminBusinessToolsController,
} from './business-tools.controller.js';
import { BulkToolsService } from './bulk-tools.service.js';
import { StockAlertsService } from './stock-alerts.service.js';
import { StockAlertsWorker } from './stock-alerts-worker.service.js';
import { BusinessReportsService } from './business-reports.service.js';
@Module({
  imports: [AuthModule, PrismaModule, CatalogModule, SellersModule],
  controllers: [SellerBusinessToolsController, AdminBusinessToolsController],
  providers: [
    BulkToolsService,
    StockAlertsService,
    StockAlertsWorker,
    BusinessReportsService,
  ],
})
export class BusinessToolsModule {}
