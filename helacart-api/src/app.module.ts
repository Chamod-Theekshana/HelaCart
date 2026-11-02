import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
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
import { ProductFeedbackModule } from './product-feedback/product-feedback.module.js';
import { AccountPermissionsModule } from './account-permissions/account-permissions.module.js';
import { BusinessToolsModule } from './business-tools/business-tools.module.js';
import { DiscoveryModule } from './discovery/discovery.module.js';
import { AuditModule } from './audit/audit.module.js';
import { PhoneVerificationModule } from './phone-verification/phone-verification.module.js';
import { AccountModule } from './account/account.module.js';
import { AppConfigController } from './app-config/app-config.controller.js';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    PrismaModule,
    AuditModule,
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
    ProductFeedbackModule,
    AccountPermissionsModule,
    BusinessToolsModule,
    DiscoveryModule,
    PhoneVerificationModule,
    AccountModule,
  ],
  controllers: [HealthController, AppConfigController],
  providers: [
    { provide: APP_GUARD, useClass: RequestLimitGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
