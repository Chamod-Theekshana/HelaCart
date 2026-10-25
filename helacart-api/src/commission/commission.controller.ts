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
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  FirebaseAuthGuard,
  type AuthenticatedRequest,
} from '../auth/firebase-auth.guard.js';
import { AdminGuard } from '../sellers/admin.guard.js';
import { CommissionService } from './commission.service.js';
import {
  CommissionPaymentDto,
  CommissionPolicyDto,
  CommissionQueryDto,
  CommissionRefundDto,
  CommissionReviewDto,
  CommissionCorrectionDto,
  ProductCommissionDto,
  CommissionHoldDto,
} from './commission.dto.js';
import {
  receiptMaxBytes,
  type ReceiptFile,
} from './commission-receipts.service.js';
const uuid = new ParseUUIDPipe({ version: '4' });
class CommissionPrivateResponse implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    context
      .switchToHttp()
      .getResponse<Response>()
      .setHeader('Cache-Control', 'private, no-store');
    return next.handle();
  }
}

@Controller('sellers/:sellerId/commission')
@UseGuards(FirebaseAuthGuard)
@UseInterceptors(CommissionPrivateResponse)
export class SellerCommissionController {
  constructor(private readonly commission: CommissionService) {}
  @Get('products') products(
    @Param('sellerId', uuid) sellerId: string,
    @Req() req: AuthenticatedRequest,
    @Query() query: CommissionQueryDto,
  ) {
    return this.commission.products(query, sellerId, req.user);
  }
  @Get('summary') summary(
    @Param('sellerId', uuid) sellerId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.commission.sellerSummary(sellerId, req.user);
  }
  @Get('policy') async policy(
    @Param('sellerId', uuid) sellerId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.commission.sellerSummary(sellerId, req.user);
    const {
      paymentDays,
      bankName,
      accountName,
      accountNumber,
      instructions,
      returnDays,
    } = await this.commission.policy();
    return {
      paymentDays,
      bankName,
      accountName,
      accountNumber,
      instructions,
      returnDays,
    };
  }
  @Get('charges') charges(
    @Param('sellerId', uuid) sellerId: string,
    @Req() req: AuthenticatedRequest,
    @Query() query: CommissionQueryDto,
  ) {
    return this.commission.charges(sellerId, query, req.user);
  }
  @Get('statement') statement(
    @Param('sellerId', uuid) sellerId: string,
    @Req() req: AuthenticatedRequest,
    @Query() query: CommissionQueryDto,
  ) {
    return this.commission.statement(sellerId, query, req.user);
  }
  @Get('statement.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="helacart-commission-statement.csv"',
  )
  async exportStatement(
    @Param('sellerId', uuid) sellerId: string,
    @Req() req: AuthenticatedRequest,
    @Query() query: CommissionQueryDto,
  ) {
    return new StreamableFile(
      await this.commission.exportStatement(sellerId, query, req.user),
    );
  }
  @Get('payments') payments(
    @Param('sellerId', uuid) sellerId: string,
    @Req() req: AuthenticatedRequest,
    @Query() query: CommissionQueryDto,
  ) {
    return this.commission.payments(query, sellerId, req.user);
  }
  @Post('payments')
  @UseInterceptors(
    FileInterceptor('receipt', {
      limits: {
        files: 1,
        fileSize: receiptMaxBytes,
        fields: 6,
        fieldSize: 2000,
      },
    }),
  )
  submit(
    @Param('sellerId', uuid) sellerId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CommissionPaymentDto,
    @UploadedFile() file?: ReceiptFile,
  ) {
    return this.commission.submit(sellerId, req.user, dto, file);
  }
  @Get('payments/:id/receipt')
  @Header('Cache-Control', 'private, no-store')
  async receipt(
    @Param('sellerId', uuid) sellerId: string,
    @Param('id', uuid) id: string,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const receipt = await this.commission.receipt(id, sellerId, req.user);
    res.setHeader('Content-Type', receipt.contentType);
    res.setHeader(
      'Content-Disposition',
      'inline; filename="commission-receipt"',
    );
    return new StreamableFile(receipt.bytes);
  }
}

@Controller('admin/commission')
@UseGuards(FirebaseAuthGuard, AdminGuard)
@UseInterceptors(CommissionPrivateResponse)
export class AdminCommissionController {
  constructor(private readonly commission: CommissionService) {}
  @Get('products') products(@Query() query: CommissionQueryDto) {
    return this.commission.products(query);
  }
  @Get('products/:id/history') productHistory(@Param('id', uuid) id: string) {
    return this.commission.productHistory(id);
  }
  @Patch('products/:id') productRate(
    @Param('id', uuid) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: ProductCommissionDto,
  ) {
    return this.commission.updateProduct(id, req.user, dto);
  }
  @Post('charges/:id/hold') hold(
    @Param('id', uuid) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CommissionHoldDto,
  ) {
    return this.commission.hold(id, req.user, dto);
  }
  @Post('sellers/:sellerId/corrections')
  correct(
    @Param('sellerId', uuid) sellerId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CommissionCorrectionDto,
  ) {
    return this.commission.correct(sellerId, req.user, dto);
  }
  @Get('policy') policy() {
    return this.commission.policy();
  }
  @Patch('policy') updatePolicy(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CommissionPolicyDto,
  ) {
    return this.commission.updatePolicy(req.user, dto);
  }
  @Get('policy/history') history() {
    return this.commission.policyHistory();
  }
  @Get('summary') summary() {
    return this.commission.adminSummary();
  }
  @Get('sellers') sellers(@Query() query: CommissionQueryDto) {
    return this.commission.balances(query);
  }
  @Get('sellers/:sellerId/summary') seller(
    @Param('sellerId', uuid) sellerId: string,
  ) {
    return this.commission.sellerSummaryForAdmin(sellerId);
  }
  @Get('sellers/:sellerId/charges') charges(
    @Param('sellerId', uuid) sellerId: string,
    @Query() query: CommissionQueryDto,
  ) {
    return this.commission.charges(sellerId, query);
  }
  @Get('sellers/:sellerId/statement') statement(
    @Param('sellerId', uuid) sellerId: string,
    @Query() query: CommissionQueryDto,
  ) {
    return this.commission.statement(sellerId, query);
  }
  @Get('sellers/:sellerId/statement.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="helacart-commission-statement.csv"',
  )
  async exportStatement(
    @Param('sellerId', uuid) sellerId: string,
    @Query() query: CommissionQueryDto,
  ) {
    return new StreamableFile(
      await this.commission.exportStatement(sellerId, query),
    );
  }
  @Post('sellers/:sellerId/refunds') refund(
    @Param('sellerId', uuid) sellerId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CommissionRefundDto,
  ) {
    return this.commission.refund(sellerId, req.user, dto);
  }
  @Post('sellers/:sellerId/reminder') remind(
    @Param('sellerId', uuid) sellerId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.commission.remind(sellerId, req.user);
  }
  @Get('payments') payments(@Query() query: CommissionQueryDto) {
    return this.commission.payments(query, query.sellerId);
  }
  @Patch('payments/:id') review(
    @Param('id', uuid) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CommissionReviewDto,
  ) {
    return this.commission.review(id, req.user, dto);
  }
  @Get('payments/:id/receipt')
  @Header('Cache-Control', 'private, no-store')
  async receipt(
    @Param('id', uuid) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const receipt = await this.commission.receipt(id);
    res.setHeader('Content-Type', receipt.contentType);
    res.setHeader(
      'Content-Disposition',
      'inline; filename="commission-receipt"',
    );
    return new StreamableFile(receipt.bytes);
  }
}
