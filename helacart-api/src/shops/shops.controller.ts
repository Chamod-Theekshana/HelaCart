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
  Put,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  StreamableFile,
  Res,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ReviewPhotosService } from './review-photos.service.js';
import {
  reviewPhotoMaxBytes,
  type ReviewPhotoFile,
} from './review-photo-storage.service.js';
import {
  FirebaseAuthGuard,
  type AuthenticatedRequest,
} from '../auth/firebase-auth.guard.js';
import { AdminGuard } from '../sellers/admin.guard.js';
import { ShopsService } from './shops.service.js';
import { ShopImagesService } from './shop-images.service.js';
import { ShopReviewsService } from './shop-reviews.service.js';
import {
  ModerateShopReviewDto,
  ReportShopReviewDto,
  ShopPageDto,
  ShopProductsDto,
  ShopReplyDto,
  ShopReportsDto,
  ShopReviewsDto,
  UpdateShopDto,
  UpdateShopBusinessDto,
  WriteShopReviewDto,
} from './shops.dto.js';
const uuid = new ParseUUIDPipe({ version: '4' });

@Controller('shops')
export class PublicShopsController {
  constructor(
    private readonly shops: ShopsService,
    private readonly reviews: ShopReviewsService,
    private readonly photos: ReviewPhotosService,
  ) {}
  @Get() directory(@Query() query: ShopPageDto) {
    return this.shops.directory(query);
  }
  @Get(':slug') profile(@Param('slug') slug: string) {
    return this.shops.profile(slug);
  }
  @Get(':slug/products') products(
    @Param('slug') slug: string,
    @Query() query: ShopProductsDto,
  ) {
    return this.shops.products(slug, query);
  }
  @Get(':slug/reviews') @Header('Cache-Control', 'no-store') listReviews(
    @Param('slug') slug: string,
    @Query() query: ShopReviewsDto,
  ) {
    return this.reviews.list(slug, query);
  }
  @Get(':slug/review-access')
  @UseGuards(FirebaseAuthGuard)
  @Header('Cache-Control', 'no-store')
  access(@Param('slug') slug: string, @Req() request: AuthenticatedRequest) {
    return this.reviews.access(slug, request.user);
  }
  @Put(':slug/reviews/:orderId')
  @UseGuards(FirebaseAuthGuard)
  @UseInterceptors(
    FilesInterceptor('photos', 3, {
      limits: {
        fileSize: reviewPhotoMaxBytes,
        files: 3,
        fields: 3,
        fieldSize: 8192,
      },
    }),
  )
  @Header('Cache-Control', 'no-store')
  save(
    @Param('slug') slug: string,
    @Param('orderId', uuid) orderId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: WriteShopReviewDto,
    @UploadedFiles() files?: ReviewPhotoFile[],
  ) {
    return this.reviews.save(slug, orderId, request.user, dto, files);
  }
  @Get(':slug/reviews/:reviewId/photos/:photoId')
  @Header('Cache-Control', 'private, no-store')
  @Header('Cross-Origin-Resource-Policy', 'cross-origin')
  async photo(
    @Param('slug') slug: string,
    @Param('reviewId', uuid) reviewId: string,
    @Param('photoId', uuid) photoId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const photo = await this.photos.publicPhoto(slug, reviewId, photoId);
    response.setHeader('Content-Type', photo.contentType);
    response.setHeader(
      'Content-Disposition',
      'inline; filename="review-photo"',
    );
    return new StreamableFile(photo.bytes);
  }
  @Delete(':slug/reviews/:id')
  @UseGuards(FirebaseAuthGuard)
  @Header('Cache-Control', 'no-store')
  remove(
    @Param('slug') slug: string,
    @Param('id', uuid) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.reviews.remove(slug, id, request.user);
  }
  @Post(':slug/reviews/:id/report')
  @UseGuards(FirebaseAuthGuard)
  @Header('Cache-Control', 'no-store')
  report(
    @Param('slug') slug: string,
    @Param('id', uuid) id: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: ReportShopReviewDto,
  ) {
    return this.reviews.report(slug, id, request.user, dto);
  }
}

@Controller('sellers/:sellerId')
@UseGuards(FirebaseAuthGuard)
export class SellerShopsController {
  constructor(
    private readonly shops: ShopsService,
    private readonly reviews: ShopReviewsService,
    private readonly images: ShopImagesService,
  ) {}
  @Patch('shop/business')
  @Header('Cache-Control', 'no-store')
  updateBusiness(
    @Param('sellerId', uuid) sellerId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateShopBusinessDto,
  ) {
    return this.shops.updateBusiness(sellerId, request.user, dto);
  }
  @Post('shop/images/:kind') uploadImage(
    @Param('sellerId', uuid) sellerId: string,
    @Param('kind') kind: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.images.upload(sellerId, kind, request.user, request);
  }
  @Delete('shop/images/:kind') removeImage(
    @Param('sellerId', uuid) sellerId: string,
    @Param('kind') kind: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.images.remove(sellerId, kind, request.user);
  }
  @Get('shop') @Header('Cache-Control', 'no-store') profile(
    @Param('sellerId', uuid) sellerId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.shops.privateProfile(sellerId, request.user);
  }
  @Patch('shop') @Header('Cache-Control', 'no-store') update(
    @Param('sellerId', uuid) sellerId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateShopDto,
  ) {
    return this.shops.update(sellerId, request.user, dto);
  }
  @Put('reviews/:id/reply') @Header('Cache-Control', 'no-store') reply(
    @Param('sellerId', uuid) sellerId: string,
    @Param('id', uuid) id: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: ShopReplyDto,
  ) {
    return this.reviews.reply(sellerId, id, request.user, dto);
  }
  @Delete('reviews/:id/reply') @Header('Cache-Control', 'no-store') removeReply(
    @Param('sellerId', uuid) sellerId: string,
    @Param('id', uuid) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.reviews.reply(sellerId, id, request.user, null);
  }
}

@Controller('admin/shop-review-reports')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminShopReviewsController {
  constructor(
    private readonly reviews: ShopReviewsService,
    private readonly photos: ReviewPhotosService,
  ) {}
  @Get(':id/photos/:photoId')
  @Header('Cache-Control', 'private, no-store')
  async photo(
    @Param('id', uuid) id: string,
    @Param('photoId', uuid) photoId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const photo = await this.photos.adminPhoto(id, photoId);
    response.setHeader('Content-Type', photo.contentType);
    response.setHeader(
      'Content-Disposition',
      'inline; filename="reported-review-photo"',
    );
    return new StreamableFile(photo.bytes);
  }
  @Get() @Header('Cache-Control', 'no-store') list(
    @Query() query: ShopReportsDto,
  ) {
    return this.reviews.reports(query);
  }
  @Patch(':id') @Header('Cache-Control', 'no-store') moderate(
    @Param('id', uuid) id: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: ModerateShopReviewDto,
  ) {
    return this.reviews.moderate(id, request.user, dto);
  }
}
