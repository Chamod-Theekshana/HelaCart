import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { FavoritesController } from './favorites.controller.js';
import { FavoritesService } from './favorites.service.js';
@Module({
  imports: [PrismaModule, AuthModule, CatalogModule],
  controllers: [FavoritesController],
  providers: [FavoritesService],
})
export class FavoritesModule {}
