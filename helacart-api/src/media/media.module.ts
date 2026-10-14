import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ProductImagesController } from './product-images.controller.js';
import { ProductImagesService } from './product-images.service.js';

@Module({
  imports: [AuthModule, CatalogModule, PrismaModule],
  controllers: [ProductImagesController],
  providers: [ProductImagesService],
})
export class MediaModule {}
