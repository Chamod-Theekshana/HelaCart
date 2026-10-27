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
import { BulkToolsService } from './bulk-tools.service.js';
import { StockAlertsService } from './stock-alerts.service.js';
import { BusinessReportsService } from './business-reports.service.js';
import {
  BulkPreviewDto,
  ToolSearchDto,
  StockAlertQueryDto,
  StockAlertSettingsDto,
  BusinessReportQueryDto,
  BusinessExportQueryDto,
} from './business-tools.dto.js';
const uuid = new ParseUUIDPipe({ version: '4' });
@Controller('sellers/:sellerId')
@UseGuards(FirebaseAuthGuard)
export class SellerBusinessToolsController {
  constructor(
    private readonly bulk: BulkToolsService,
    private readonly stock: StockAlertsService,
    private readonly reports: BusinessReportsService,
  ) {}
  @Get('bulk-tools/stock-template.csv')
  @Header('Cache-Control', 'private, no-store')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="helacart-stock-template.csv"',
  )
  template(
    @Param('sellerId', uuid) id: string,
    @Req() req: AuthenticatedRequest,
    @Query() q: ToolSearchDto,
  ) {
    return this.bulk.template(id, req.user, q);
  }
  @Get('bulk-tools/jobs') @Header('Cache-Control', 'private, no-store') history(
    @Param('sellerId', uuid) id: string,
    @Req() req: AuthenticatedRequest,
    @Query() q: ToolSearchDto,
  ) {
    return this.bulk.history(req.user, id, q);
  }
  @Post('bulk-tools/preview')
  @Header('Cache-Control', 'private, no-store')
  preview(
    @Param('sellerId', uuid) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: BulkPreviewDto,
  ) {
    return this.bulk.preview(req.user, id, dto);
  }
  @Get('bulk-tools/jobs/:jobId')
  @Header('Cache-Control', 'private, no-store')
  job(
    @Param('sellerId', uuid) id: string,
    @Param('jobId', uuid) job: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.bulk.detail(job, req.user, id);
  }
  @Post('bulk-tools/jobs/:jobId/apply')
  @Header('Cache-Control', 'private, no-store')
  apply(
    @Param('sellerId', uuid) id: string,
    @Param('jobId', uuid) job: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.bulk.apply(job, req.user, id);
  }
  @Get('stock-alerts') @Header('Cache-Control', 'private, no-store') alerts(
    @Param('sellerId', uuid) id: string,
    @Req() req: AuthenticatedRequest,
    @Query() q: StockAlertQueryDto,
  ) {
    return this.stock.list(id, req.user, q);
  }
  @Patch('stock-alerts/:variantId/settings')
  @Header('Cache-Control', 'private, no-store')
  settings(
    @Param('sellerId', uuid) id: string,
    @Param('variantId', uuid) variant: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: StockAlertSettingsDto,
  ) {
    return this.stock.settings(id, variant, req.user, dto);
  }
  @Get('reports') @Header('Cache-Control', 'private, no-store') report(
    @Param('sellerId', uuid) id: string,
    @Req() req: AuthenticatedRequest,
    @Query() q: BusinessReportQueryDto,
  ) {
    return this.reports.report(req.user, id, q);
  }
  @Get('reports/export.csv')
  @Header('Cache-Control', 'private, no-store')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="helacart-business-report.csv"',
  )
  export(
    @Param('sellerId', uuid) id: string,
    @Req() req: AuthenticatedRequest,
    @Query() q: BusinessExportQueryDto,
  ) {
    return this.reports.export(req.user, id, q);
  }
}
@Controller('admin')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminBusinessToolsController {
  constructor(
    private readonly bulk: BulkToolsService,
    private readonly reports: BusinessReportsService,
  ) {}
  @Get('bulk-tools/jobs') @Header('Cache-Control', 'private, no-store') history(
    @Req() req: AuthenticatedRequest,
    @Query() q: ToolSearchDto,
  ) {
    return this.bulk.history(req.user, undefined, q);
  }
  @Post('bulk-tools/preview')
  @Header('Cache-Control', 'private, no-store')
  preview(@Req() req: AuthenticatedRequest, @Body() dto: BulkPreviewDto) {
    return this.bulk.preview(req.user, undefined, dto);
  }
  @Get('bulk-tools/jobs/:jobId')
  @Header('Cache-Control', 'private, no-store')
  job(@Param('jobId', uuid) id: string, @Req() req: AuthenticatedRequest) {
    return this.bulk.detail(id, req.user);
  }
  @Post('bulk-tools/jobs/:jobId/apply')
  @Header('Cache-Control', 'private, no-store')
  apply(@Param('jobId', uuid) id: string, @Req() req: AuthenticatedRequest) {
    return this.bulk.apply(id, req.user);
  }
  @Get('reports') @Header('Cache-Control', 'private, no-store') report(
    @Req() req: AuthenticatedRequest,
    @Query() q: BusinessReportQueryDto,
  ) {
    return this.reports.report(req.user, undefined, q);
  }
  @Get('reports/export.csv')
  @Header('Cache-Control', 'private, no-store')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="helacart-business-report.csv"',
  )
  export(@Req() req: AuthenticatedRequest, @Query() q: BusinessExportQueryDto) {
    return this.reports.export(req.user, undefined, q);
  }
}
