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
import { SellerReviewDecision } from '../generated/prisma/client.js';
import type { AuthenticatedRequest } from '../auth/firebase-auth.guard.js';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard.js';
import { AdminGuard } from './admin.guard.js';
import { CreateSellerApplicationDto } from './dto/create-seller-application.dto.js';
import { ListSellerApplicationsDto } from './dto/list-seller-applications.dto.js';
import { RejectSellerApplicationDto } from './dto/reject-seller-application.dto.js';
import { SellerApplicationsService } from './seller-applications.service.js';

@Controller('seller-applications')
@UseGuards(FirebaseAuthGuard)
export class SellerApplicationsController {
  constructor(private readonly applications: SellerApplicationsService) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  apply(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateSellerApplicationDto,
  ) {
    return this.applications.apply(request.user, dto);
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  mine(@Req() request: AuthenticatedRequest) {
    return this.applications.mine(request.user);
  }
}

@Controller('admin/seller-applications')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminSellerApplicationsController {
  constructor(private readonly applications: SellerApplicationsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Query() query: ListSellerApplicationsDto) {
    return this.applications.list(query.status);
  }

  @Patch(':id/approve')
  @Header('Cache-Control', 'no-store')
  approve(
    @Param('id', new ParseUUIDPipe({ version: '4' })) sellerId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.applications.review(
      sellerId,
      request.user,
      SellerReviewDecision.APPROVED,
    );
  }

  @Patch(':id/reject')
  @Header('Cache-Control', 'no-store')
  reject(
    @Param('id', new ParseUUIDPipe({ version: '4' })) sellerId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: RejectSellerApplicationDto,
  ) {
    return this.applications.review(
      sellerId,
      request.user,
      SellerReviewDecision.REJECTED,
      dto.reason,
    );
  }
}
