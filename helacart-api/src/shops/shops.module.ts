import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { SellersModule } from '../sellers/sellers.module.js';
import {
  PublicShopsController,
  SellerShopsController,
  AdminShopReviewsController,
} from './shops.controller.js';
import { ShopsService } from './shops.service.js';
import { ShopReviewsService } from './shop-reviews.service.js';
import { ShopImagesService } from './shop-images.service.js';
import { ReviewPhotosService } from './review-photos.service.js';
import { ReviewPhotoStorageService } from './review-photo-storage.service.js';

@Module({
  imports: [PrismaModule, AuthModule, CatalogModule, SellersModule],
  controllers: [
    PublicShopsController,
    SellerShopsController,
    AdminShopReviewsController,
  ],
  providers: [
    ShopsService,
    ShopReviewsService,
    ShopImagesService,
    ReviewPhotosService,
    ReviewPhotoStorageService,
  ],
})
export class ShopsModule {}
