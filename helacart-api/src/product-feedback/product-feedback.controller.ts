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
} from '@nestjs/common';
import {
  FirebaseAuthGuard,
  type AuthenticatedRequest,
} from '../auth/firebase-auth.guard.js';
import { AdminGuard } from '../sellers/admin.guard.js';
import { ProductFeedbackService } from './product-feedback.service.js';
import {
  FeedbackPageDto,
  FeedbackVersionDto,
  WriteProductFeedbackDto,
  ProductReplyDto,
  ReportProductFeedbackDto,
  ProductReportsDto,
  ModerateProductFeedbackDto,
} from './product-feedback.dto.js';
const uuid = new ParseUUIDPipe({ version: '4' });
@Controller('me/product-reviews')
@UseGuards(FirebaseAuthGuard)
export class BuyerProductFeedbackController {
  constructor(private readonly service: ProductFeedbackService) {}
  @Get() @Header('Cache-Control', 'private, no-store') mine(
    @Req() req: AuthenticatedRequest,
    @Query() q: FeedbackPageDto,
  ) {
    return this.service.mine(req.user, q);
  }
}
@Controller('products/:productId/customer-reviews')
export class ProductFeedbackController {
  constructor(private readonly service: ProductFeedbackService) {}
  @Get() @Header('Cache-Control', 'no-store') list(
    @Param('productId', uuid) id: string,
    @Query() q: FeedbackPageDto,
  ) {
    return this.service.list(id, q);
  }
  @Get('access')
  @UseGuards(FirebaseAuthGuard)
  @Header('Cache-Control', 'private, no-store')
  access(
    @Param('productId', uuid) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.access(id, req.user);
  }
  @Put('mine')
  @UseGuards(FirebaseAuthGuard)
  @Header('Cache-Control', 'private, no-store')
  save(
    @Param('productId', uuid) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: WriteProductFeedbackDto,
  ) {
    return this.service.save(id, req.user, dto);
  }
  @Delete('mine')
  @UseGuards(FirebaseAuthGuard)
  @Header('Cache-Control', 'private, no-store')
  remove(
    @Param('productId', uuid) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: FeedbackVersionDto,
  ) {
    return this.service.remove(id, req.user, dto);
  }
  @Post(':reviewId/reports')
  @UseGuards(FirebaseAuthGuard)
  @Header('Cache-Control', 'private, no-store')
  report(
    @Param('productId', uuid) id: string,
    @Param('reviewId', uuid) review: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: ReportProductFeedbackDto,
  ) {
    return this.service.report(id, review, req.user, dto);
  }
}
@Controller('sellers/:sellerId/product-reviews')
@UseGuards(FirebaseAuthGuard)
export class SellerProductFeedbackController {
  constructor(private readonly service: ProductFeedbackService) {}
  @Get() @Header('Cache-Control', 'private, no-store') list(
    @Param('sellerId', uuid) id: string,
    @Req() req: AuthenticatedRequest,
    @Query() q: FeedbackPageDto,
  ) {
    return this.service.sellerList(id, req.user, q);
  }
  @Put(':reviewId/reply') @Header('Cache-Control', 'private, no-store') reply(
    @Param('sellerId', uuid) id: string,
    @Param('reviewId', uuid) review: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: ProductReplyDto,
  ) {
    return this.service.reply(id, review, req.user, dto);
  }
}
@Controller('admin/product-review-reports')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminProductFeedbackController {
  constructor(private readonly service: ProductFeedbackService) {}
  @Get() @Header('Cache-Control', 'private, no-store') list(
    @Query() q: ProductReportsDto,
  ) {
    return this.service.reports(q);
  }
  @Patch(':id') @Header('Cache-Control', 'private, no-store') moderate(
    @Param('id', uuid) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: ModerateProductFeedbackDto,
  ) {
    return this.service.moderate(id, req.user, dto);
  }
}
