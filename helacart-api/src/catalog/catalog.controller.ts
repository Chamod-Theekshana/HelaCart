import {
  Body,
  Controller,
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
  ProductReviewDecision,
  ProductStatus,
} from '../generated/prisma/client.js';
import type { AuthenticatedRequest } from '../auth/firebase-auth.guard.js';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard.js';
import { AdminGuard } from '../sellers/admin.guard.js';
import { CatalogService } from './catalog.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import {
  CreateProductDto,
  ListPublicProductsDto,
  ListSellerProductsDto,
  RejectProductDto,
  UpdateProductDto,
} from './dto/product.dto.js';

const uuid = new ParseUUIDPipe({ version: '4' });

@Controller()
export class PublicCatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  categories() {
    return this.catalog.categories();
  }

  @Get('products')
  products(@Query() query: ListPublicProductsDto) {
    return this.catalog.publicProducts(query);
  }

  @Get('products/:productId')
  product(@Param('productId', uuid) productId: string) {
    return this.catalog.publicProduct(productId);
  }
}

@Controller('sellers/:sellerId/products')
@UseGuards(FirebaseAuthGuard)
export class SellerCatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  create(
    @Param('sellerId', uuid) sellerId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateProductDto,
  ) {
    return this.catalog.createProduct(sellerId, request.user, dto);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  list(
    @Param('sellerId', uuid) sellerId: string,
    @Req() request: AuthenticatedRequest,
    @Query() query: ListSellerProductsDto,
  ) {
    return this.catalog.sellerProducts(sellerId, request.user, query.status);
  }

  @Get(':productId')
  @Header('Cache-Control', 'no-store')
  detail(
    @Param('sellerId', uuid) sellerId: string,
    @Param('productId', uuid) productId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.catalog.sellerProduct(sellerId, productId, request.user);
  }

  @Patch(':productId')
  @Header('Cache-Control', 'no-store')
  edit(
    @Param('sellerId', uuid) sellerId: string,
    @Param('productId', uuid) productId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateProductDto,
  ) {
    return this.catalog.editProduct(sellerId, productId, request.user, dto);
  }

  @Post(':productId/submit')
  @Header('Cache-Control', 'no-store')
  submit(
    @Param('sellerId', uuid) sellerId: string,
    @Param('productId', uuid) productId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.catalog.submitProduct(sellerId, productId, request.user);
  }

  @Patch(':productId/hide')
  @Header('Cache-Control', 'no-store')
  hide(
    @Param('sellerId', uuid) sellerId: string,
    @Param('productId', uuid) productId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.catalog.hideProduct(sellerId, productId, request.user);
  }
}

@Controller('admin')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminCatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Post('categories')
  @Header('Cache-Control', 'no-store')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.catalog.createCategory(dto);
  }

  @Get('products')
  @Header('Cache-Control', 'no-store')
  products(@Query() query: ListSellerProductsDto) {
    return this.catalog.adminProducts(query.status ?? ProductStatus.PENDING);
  }

  @Patch('products/:productId/approve')
  @Header('Cache-Control', 'no-store')
  approve(
    @Param('productId', uuid) productId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.catalog.reviewProduct(
      productId,
      request.user,
      ProductReviewDecision.APPROVED,
    );
  }

  @Patch('products/:productId/reject')
  @Header('Cache-Control', 'no-store')
  reject(
    @Param('productId', uuid) productId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: RejectProductDto,
  ) {
    return this.catalog.reviewProduct(
      productId,
      request.user,
      ProductReviewDecision.REJECTED,
      dto.reason,
    );
  }
}
