import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SellersModule } from '../sellers/sellers.module.js';
import {
  AdminAccountsController,
  SellerTeamController,
} from './account-permissions.controller.js';
import { AccountPermissionsService } from './account-permissions.service.js';
@Module({
  imports: [AuthModule, PrismaModule, SellersModule],
  controllers: [AdminAccountsController, SellerTeamController],
  providers: [AccountPermissionsService],
})
export class AccountPermissionsModule {}
