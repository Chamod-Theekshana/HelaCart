import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SellersModule } from '../sellers/sellers.module.js';
import {
  AdminCategoriesController,
  AdminHeroController,
  PublicContentController,
} from './content.controller.js';
import { CategoriesAdminService } from './categories-admin.service.js';
import { HeroAdminService } from './hero-admin.service.js';
import { ContentImageStorageService } from './content-image-storage.service.js';
@Module({
  imports: [AuthModule, PrismaModule, SellersModule],
  controllers: [
    AdminCategoriesController,
    AdminHeroController,
    PublicContentController,
  ],
  providers: [
    CategoriesAdminService,
    HeroAdminService,
    ContentImageStorageService,
  ],
})
export class StorefrontContentModule {}
