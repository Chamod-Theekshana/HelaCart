import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  FirebaseAuthGuard,
  type AuthenticatedRequest,
} from '../auth/firebase-auth.guard.js';
import {
  AdjustStockDto,
  CreateVariantDto,
  UpdateVariantDto,
} from './dto/inventory.dto.js';
import { InventoryService } from './inventory.service.js';

const uuid = new ParseUUIDPipe({ version: '4' });

@Controller('sellers/:sellerId/products/:productId/variants')
@UseGuards(FirebaseAuthGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  create(
    @Param('sellerId', uuid) sellerId: string,
    @Param('productId', uuid) productId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateVariantDto,
  ) {
    return this.inventory.createVariant(sellerId, productId, request.user, dto);
  }

  @Patch(':variantId')
  @Header('Cache-Control', 'no-store')
  edit(
    @Param('sellerId', uuid) sellerId: string,
    @Param('productId', uuid) productId: string,
    @Param('variantId', uuid) variantId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.inventory.updateVariant(
      sellerId,
      productId,
      variantId,
      request.user,
      dto,
    );
  }

  @Post(':variantId/stock-adjustments')
  @Header('Cache-Control', 'no-store')
  stock(
    @Param('sellerId', uuid) sellerId: string,
    @Param('productId', uuid) productId: string,
    @Param('variantId', uuid) variantId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: AdjustStockDto,
  ) {
    return this.inventory.adjustStock(
      sellerId,
      productId,
      variantId,
      request.user,
      dto,
    );
  }

  @Get(':variantId/stock-movements')
  @Header('Cache-Control', 'no-store')
  movements(
    @Param('sellerId', uuid) sellerId: string,
    @Param('productId', uuid) productId: string,
    @Param('variantId', uuid) variantId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inventory.movements(
      sellerId,
      productId,
      variantId,
      request.user,
    );
  }
}
