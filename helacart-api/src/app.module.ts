import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { validateEnvironment } from './config/environment.js';
import { RequestLimitGuard } from './config/request-limit.guard.js';
import { HealthController } from './health/health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SellersModule } from './sellers/sellers.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { CommerceModule } from './commerce/commerce.module.js';
import { MediaModule } from './media/media.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { OperationsModule } from './operations/operations.module.js';
import { ShopsModule } from './shops/shops.module.js';
import { WorkspaceModule } from './workspace/workspace.module.js';
import { StorefrontContentModule } from './storefront-content/storefront-content.module.js';
import { FavoritesModule } from './favorites/favorites.module.js';
import { CommissionModule } from './commission/commission.module.js';
import { AfterSalesModule } from './after-sales/after-sales.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    PrismaModule,
    AuthModule,
    SellersModule,
    CatalogModule,
    CommerceModule,
    MediaModule,
    NotificationsModule,
    OperationsModule,
    ShopsModule,
    WorkspaceModule,
    StorefrontContentModule,
    FavoritesModule,
    CommissionModule,
    AfterSalesModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService, { provide: APP_GUARD, useClass: RequestLimitGuard }],
})
export class AppModule {}
