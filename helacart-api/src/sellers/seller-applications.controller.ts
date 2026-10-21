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
  UseInterceptors,
  UploadedFiles,
  StreamableFile,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { SellerReviewDecision } from '../generated/prisma/client.js';
import type { AuthenticatedRequest } from '../auth/firebase-auth.guard.js';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard.js';
import { AdminGuard } from './admin.guard.js';
import { CreateSellerApplicationDto } from './dto/create-seller-application.dto.js';
import { ListSellerApplicationsDto } from './dto/list-seller-applications.dto.js';
import { RejectSellerApplicationDto } from './dto/reject-seller-application.dto.js';
import { SellerApplicationsService } from './seller-applications.service.js';
import { ShopVerificationService } from './shop-verification.service.js';
import { UpdateShopVerificationDto } from './dto/update-shop-verification.dto.js';
import { ApproveSellerApplicationDto } from './dto/approve-seller-application.dto.js';
import {
  SellerDocumentsService,
  sellerDocumentMaxBytes,
  type ApplicationFiles,
} from './seller-documents.service.js';

@Controller('seller-applications')
@UseGuards(FirebaseAuthGuard)
export class SellerApplicationsController {
  constructor(private readonly applications: SellerApplicationsService) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'identityFront', maxCount: 1 },
        { name: 'identityBack', maxCount: 1 },
        { name: 'businessRegistration', maxCount: 1 },
      ],
      {
        limits: {
          fileSize: sellerDocumentMaxBytes,
          files: 3,
          fields: 6,
          fieldSize: 4000,
          parts: 9,
        },
      },
    ),
  )
  apply(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateSellerApplicationDto,
    @UploadedFiles() files: ApplicationFiles,
  ) {
    return this.applications.apply(request.user, dto, files);
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
  constructor(
    private readonly applications: SellerApplicationsService,
    private readonly documents: SellerDocumentsService,
    private readonly verification: ShopVerificationService,
  ) {}

  @Patch(':id/verification')
  @Header('Cache-Control', 'no-store')
  verify(
    @Param('id', new ParseUUIDPipe({ version: '4' })) sellerId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateShopVerificationDto,
  ) {
    return this.verification.update(sellerId, request.user, dto);
  }

  @Get(':id/documents/:documentId')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async document(
    @Param('id', new ParseUUIDPipe({ version: '4' })) sellerId: string,
    @Param('documentId', new ParseUUIDPipe({ version: '4' }))
    documentId: string,
  ) {
    const { bytes, contentType } = await this.documents.read(
      sellerId,
      documentId,
    );
    return new StreamableFile(bytes, {
      type: contentType,
      disposition: 'inline',
      length: bytes.length,
    });
  }

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
    @Body() dto: ApproveSellerApplicationDto,
  ) {
    return this.applications.review(
      sellerId,
      request.user,
      SellerReviewDecision.APPROVED,
      undefined,
      dto,
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
