import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { SellersModule } from '../sellers/sellers.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import {
  BuyerProductFeedbackController,
  ProductFeedbackController,
  SellerProductFeedbackController,
  AdminProductFeedbackController,
} from './product-feedback.controller.js';
import { ProductFeedbackService } from './product-feedback.service.js';
@Module({
  imports: [AuthModule, CatalogModule, SellersModule, PrismaModule],
  controllers: [
    BuyerProductFeedbackController,
    ProductFeedbackController,
    SellerProductFeedbackController,
    AdminProductFeedbackController,
  ],
  providers: [ProductFeedbackService],
})
export class ProductFeedbackModule {}
