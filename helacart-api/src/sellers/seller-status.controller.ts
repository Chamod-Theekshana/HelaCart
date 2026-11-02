import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  FirebaseAuthGuard,
  type AuthenticatedRequest,
} from '../auth/firebase-auth.guard.js';
import { AdminGuard } from './admin.guard.js';
import { SellerStatusService } from './seller-status.service.js';
import {
  ListSellersDto,
  UpdateSellerStatusDto,
} from './dto/seller-status.dto.js';

@Controller('admin/sellers')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminSellersController {
  constructor(private readonly sellers: SellerStatusService) {}
  @Get() @Header('Cache-Control', 'private, no-store') list(
    @Query() query: ListSellersDto,
  ) {
    return this.sellers.list(query);
  }
  @Patch(':sellerId/status') @Header('Cache-Control', 'no-store') update(
    @Param('sellerId', new ParseUUIDPipe({ version: '4' })) sellerId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateSellerStatusDto,
  ) {
    return this.sellers.update(sellerId, request.user, dto);
  }
}
