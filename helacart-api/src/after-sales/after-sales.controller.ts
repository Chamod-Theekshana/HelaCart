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
  FirebaseAuthGuard,
  type AuthenticatedRequest,
} from '../auth/firebase-auth.guard.js';
import { AdminGuard } from '../sellers/admin.guard.js';
import { AfterSalesService } from './after-sales.service.js';
import {
  AfterSalesQuery,
  CaseDecisionDto,
  CaseMessageDto,
  CreateCaseDto,
  RefundRecordDto,
  RefundReviewDto,
  RefundReversalDto,
} from './after-sales.dto.js';
const uuid = new ParseUUIDPipe({ version: '4' });
@Controller('me/after-sales')
@UseGuards(FirebaseAuthGuard)
export class BuyerAfterSalesController {
  constructor(private readonly service: AfterSalesService) {}
  @Get('return-options/:id')
  @Header('Cache-Control', 'private, no-store')
  options(@Req() req: AuthenticatedRequest, @Param('id', uuid) id: string) {
    return this.service.options(req.user, id);
  }
  @Get('returns') @Header('Cache-Control', 'private, no-store') returns(
    @Req() req: AuthenticatedRequest,
    @Query() q: AfterSalesQuery,
  ) {
    return this.service.returns(req.user, { role: 'BUYER' }, q);
  }
  @Get('refunds') @Header('Cache-Control', 'private, no-store') refunds(
    @Req() req: AuthenticatedRequest,
    @Query() q: AfterSalesQuery,
  ) {
    return this.service.refunds(req.user, { role: 'BUYER' }, q);
  }
  @Get('support') @Header('Cache-Control', 'private, no-store') cases(
    @Req() req: AuthenticatedRequest,
    @Query() q: AfterSalesQuery,
  ) {
    return this.service.cases(req.user, { role: 'BUYER' }, q);
  }
  @Post('support') @Header('Cache-Control', 'private, no-store') create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateCaseDto,
  ) {
    return this.service.createCase(req.user, { role: 'BUYER' }, dto);
  }
  @Get('support/:id') @Header('Cache-Control', 'private, no-store') detail(
    @Req() req: AuthenticatedRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.service.caseDetail(id, req.user, { role: 'BUYER' });
  }
  @Get('support/:id/messages')
  @Header('Cache-Control', 'private, no-store')
  messages(
    @Req() req: AuthenticatedRequest,
    @Param('id', uuid) id: string,
    @Query() q: AfterSalesQuery,
  ) {
    return this.service.caseMessages(id, req.user, { role: 'BUYER' }, q);
  }
  @Post('support/:id/messages')
  @Header('Cache-Control', 'private, no-store')
  reply(
    @Req() req: AuthenticatedRequest,
    @Param('id', uuid) id: string,
    @Body() dto: CaseMessageDto,
  ) {
    return this.service.addMessage(id, req.user, { role: 'BUYER' }, dto);
  }
}
@Controller('sellers/:sellerId/after-sales')
@UseGuards(FirebaseAuthGuard)
export class SellerAfterSalesController {
  constructor(private readonly service: AfterSalesService) {}
  @Get('returns') @Header('Cache-Control', 'private, no-store') returns(
    @Req() req: AuthenticatedRequest,
    @Param('sellerId', uuid) sellerId: string,
    @Query() q: AfterSalesQuery,
  ) {
    return this.service.returns(req.user, { role: 'SELLER', sellerId }, q);
  }
  @Get('refunds') @Header('Cache-Control', 'private, no-store') refunds(
    @Req() req: AuthenticatedRequest,
    @Param('sellerId', uuid) sellerId: string,
    @Query() q: AfterSalesQuery,
  ) {
    return this.service.refunds(req.user, { role: 'SELLER', sellerId }, q);
  }
  @Post('refunds') @Header('Cache-Control', 'private, no-store') submit(
    @Req() req: AuthenticatedRequest,
    @Param('sellerId', uuid) sellerId: string,
    @Body() dto: RefundRecordDto,
  ) {
    return this.service.submitRefund(sellerId, req.user, dto);
  }
  @Get('support') @Header('Cache-Control', 'private, no-store') cases(
    @Req() req: AuthenticatedRequest,
    @Param('sellerId', uuid) sellerId: string,
    @Query() q: AfterSalesQuery,
  ) {
    return this.service.cases(req.user, { role: 'SELLER', sellerId }, q);
  }
  @Post('support') @Header('Cache-Control', 'private, no-store') create(
    @Req() req: AuthenticatedRequest,
    @Param('sellerId', uuid) sellerId: string,
    @Body() dto: CreateCaseDto,
  ) {
    return this.service.createCase(req.user, { role: 'SELLER', sellerId }, dto);
  }
  @Get('support/:id') @Header('Cache-Control', 'private, no-store') detail(
    @Req() req: AuthenticatedRequest,
    @Param('sellerId', uuid) sellerId: string,
    @Param('id', uuid) id: string,
  ) {
    return this.service.caseDetail(id, req.user, { role: 'SELLER', sellerId });
  }
  @Get('support/:id/messages')
  @Header('Cache-Control', 'private, no-store')
  messages(
    @Req() req: AuthenticatedRequest,
    @Param('sellerId', uuid) sellerId: string,
    @Param('id', uuid) id: string,
    @Query() q: AfterSalesQuery,
  ) {
    return this.service.caseMessages(
      id,
      req.user,
      { role: 'SELLER', sellerId },
      q,
    );
  }
  @Post('support/:id/messages')
  @Header('Cache-Control', 'private, no-store')
  reply(
    @Req() req: AuthenticatedRequest,
    @Param('sellerId', uuid) sellerId: string,
    @Param('id', uuid) id: string,
    @Body() dto: CaseMessageDto,
  ) {
    return this.service.addMessage(
      id,
      req.user,
      { role: 'SELLER', sellerId },
      dto,
    );
  }
}
@Controller('admin/after-sales')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminAfterSalesController {
  constructor(private readonly service: AfterSalesService) {}
  @Get('refunds') @Header('Cache-Control', 'private, no-store') refunds(
    @Req() req: AuthenticatedRequest,
    @Query() q: AfterSalesQuery,
  ) {
    return this.service.refunds(req.user, { role: 'ADMIN' }, q);
  }
  @Patch('refunds/:id') @Header('Cache-Control', 'private, no-store') review(
    @Req() req: AuthenticatedRequest,
    @Param('id', uuid) id: string,
    @Body() dto: RefundReviewDto,
  ) {
    return this.service.reviewRefund(id, req.user, dto);
  }
  @Post('refunds/:id/reverse')
  @Header('Cache-Control', 'private, no-store')
  reverse(
    @Req() req: AuthenticatedRequest,
    @Param('id', uuid) id: string,
    @Body() dto: RefundReversalDto,
  ) {
    return this.service.reverseRefund(id, req.user, dto);
  }
  @Get('support') @Header('Cache-Control', 'private, no-store') cases(
    @Req() req: AuthenticatedRequest,
    @Query() q: AfterSalesQuery,
  ) {
    return this.service.cases(req.user, { role: 'ADMIN' }, q);
  }
  @Get('support/:id') @Header('Cache-Control', 'private, no-store') detail(
    @Req() req: AuthenticatedRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.service.caseDetail(id, req.user, { role: 'ADMIN' });
  }
  @Get('support/:id/messages')
  @Header('Cache-Control', 'private, no-store')
  messages(
    @Req() req: AuthenticatedRequest,
    @Param('id', uuid) id: string,
    @Query() q: AfterSalesQuery,
  ) {
    return this.service.caseMessages(id, req.user, { role: 'ADMIN' }, q);
  }
  @Post('support/:id/messages')
  @Header('Cache-Control', 'private, no-store')
  reply(
    @Req() req: AuthenticatedRequest,
    @Param('id', uuid) id: string,
    @Body() dto: CaseMessageDto,
  ) {
    return this.service.addMessage(id, req.user, { role: 'ADMIN' }, dto);
  }
  @Patch('support/:id') @Header('Cache-Control', 'private, no-store') decide(
    @Req() req: AuthenticatedRequest,
    @Param('id', uuid) id: string,
    @Body() dto: CaseDecisionDto,
  ) {
    return this.service.decideCase(id, req.user, dto);
  }
}
