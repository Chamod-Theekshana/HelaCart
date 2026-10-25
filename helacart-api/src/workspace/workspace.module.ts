import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { SellersModule } from '../sellers/sellers.module.js';
import { WorkspaceService } from './workspace.service.js';
import {
  AdminWorkspaceController,
  BuyerWorkspaceController,
  CatalogBrowseController,
  SellerWorkspaceController,
} from './workspace.controller.js';
@Module({
  imports: [PrismaModule, AuthModule, CatalogModule, SellersModule],
  controllers: [
    AdminWorkspaceController,
    BuyerWorkspaceController,
    CatalogBrowseController,
    SellerWorkspaceController,
  ],
  providers: [WorkspaceService],
})
export class WorkspaceModule {}
