import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  FirebaseAuthGuard,
  type AuthenticatedRequest,
} from '../auth/firebase-auth.guard.js';
import { AdminGuard } from '../sellers/admin.guard.js';
import { CategoriesAdminService } from './categories-admin.service.js';
import { HeroAdminService } from './hero-admin.service.js';
import {
  CategoryListDto,
  ContentRevisionDto,
  UpdateCategoryDto,
  UpdateHeroDto,
} from './content.dto.js';
const uuid = new ParseUUIDPipe({ version: '4' });

@Controller('storefront')
export class PublicContentController {
  constructor(private readonly hero: HeroAdminService) {}
  @Get('hero') @Header('Cache-Control', 'no-store') get() {
    return this.hero.publicHero();
  }
}
@Controller('admin/categories')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminCategoriesController {
  constructor(private readonly categories: CategoriesAdminService) {}
  @Get() @Header('Cache-Control', 'no-store') list(
    @Query() query: CategoryListDto,
  ) {
    return this.categories.list(query);
  }
  @Patch(':id') @Header('Cache-Control', 'no-store') update(
    @Param('id', uuid) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categories.update(id, dto);
  }
  @Delete(':id') @Header('Cache-Control', 'no-store') remove(
    @Param('id', uuid) id: string,
    @Body() dto: ContentRevisionDto,
  ) {
    return this.categories.remove(id, dto.expectedRevision);
  }
  @Post(':id/image') @Header('Cache-Control', 'no-store') image(
    @Param('id', uuid) id: string,
    @Query() dto: ContentRevisionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.categories.image(id, dto.expectedRevision, req);
  }
  @Delete(':id/image') @Header('Cache-Control', 'no-store') removeImage(
    @Param('id', uuid) id: string,
    @Body() dto: ContentRevisionDto,
  ) {
    return this.categories.image(id, dto.expectedRevision);
  }
}
@Controller('admin/storefront/hero')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminHeroController {
  constructor(private readonly hero: HeroAdminService) {}
  @Get() @Header('Cache-Control', 'no-store') get() {
    return this.hero.admin();
  }
  @Patch() @Header('Cache-Control', 'no-store') update(
    @Body() dto: UpdateHeroDto,
  ) {
    return this.hero.update(dto);
  }
  @Post('publish') @Header('Cache-Control', 'no-store') publish(
    @Body() dto: ContentRevisionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.hero.publish(dto.expectedRevision, req.user);
  }
  @Post('images/:kind') @Header('Cache-Control', 'no-store') image(
    @Param('kind') kind: string,
    @Query() dto: ContentRevisionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.hero.image(kind, dto.expectedRevision, req);
  }
  @Delete('images/:kind') @Header('Cache-Control', 'no-store') removeImage(
    @Param('kind') kind: string,
    @Body() dto: ContentRevisionDto,
  ) {
    return this.hero.image(kind, dto.expectedRevision);
  }
}
