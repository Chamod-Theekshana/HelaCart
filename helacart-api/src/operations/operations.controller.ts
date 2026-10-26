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
import { ReturnStatus } from '../generated/prisma/client.js';
import { AdminGuard } from '../sellers/admin.guard.js';
import {
  ListReturnsDto,
  PageDto,
  ReconcileCodDto,
  RequestReturnDto,
  ResolveReturnDto,
  ReviewReturnDto,
} from './operations.dto.js';
import { OperationsService } from './operations.service.js';

const uuid = new ParseUUIDPipe({ version: '4' });

@Controller('me/returns')
@UseGuards(FirebaseAuthGuard)
export class BuyerReturnsController {
  constructor(private readonly operations: OperationsService) {}
  @Post() @Header('Cache-Control', 'no-store') create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: RequestReturnDto,
  ) {
    return this.operations.requestReturn(request.user, dto);
  }
  @Get() @Header('Cache-Control', 'no-store') mine(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.operations.myReturns(request.user);
  }
}

@Controller('admin')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminOperationsController {
  constructor(private readonly operations: OperationsService) {}
  @Get('returns') @Header('Cache-Control', 'no-store') returns(
    @Query() query: ListReturnsDto,
  ) {
    return this.operations.returns(query.status);
  }
  @Get('returns/page') @Header('Cache-Control', 'no-store') returnsPage(
    @Query() query: ListReturnsDto,
  ) {
    return this.operations.returnsPage(query);
  }
  @Patch('returns/:id/approve') @Header('Cache-Control', 'no-store') approve(
    @Req() request: AuthenticatedRequest,
    @Param('id', uuid) id: string,
    @Body() dto: ReviewReturnDto,
  ) {
    return this.operations.reviewReturn(
      id,
      request.user,
      ReturnStatus.APPROVED,
      dto.reason,
    );
  }
  @Patch('returns/:id/reject') @Header('Cache-Control', 'no-store') reject(
    @Req() request: AuthenticatedRequest,
    @Param('id', uuid) id: string,
    @Body() dto: ReviewReturnDto,
  ) {
    return this.operations.reviewReturn(
      id,
      request.user,
      ReturnStatus.REJECTED,
      dto.reason,
    );
  }
  @Patch('returns/:id/resolve') @Header('Cache-Control', 'no-store') resolve(
    @Req() request: AuthenticatedRequest,
    @Param('id', uuid) id: string,
    @Body() dto: ResolveReturnDto,
  ) {
    return this.operations.resolveReturn(
      id,
      request.user,
      dto.note,
      dto.outcome,
    );
  }
  @Get('cod/reconciliation-queue')
  @Header('Cache-Control', 'no-store')
  codQueue() {
    return this.operations.codQueue();
  }
  @Get('cod/reconciliation-queue/page')
  @Header('Cache-Control', 'no-store')
  codQueuePage(@Query() query: PageDto) {
    return this.operations.codQueuePage(query);
  }
  @Post('cod/:sellerOrderId/reconciliations')
  @Header('Cache-Control', 'no-store')
  reconcile(
    @Req() request: AuthenticatedRequest,
    @Param('sellerOrderId', uuid) id: string,
    @Body() dto: ReconcileCodDto,
  ) {
    return this.operations.reconcileCod(id, request.user, dto);
  }
}
