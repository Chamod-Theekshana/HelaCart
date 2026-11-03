import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard.js';
import { AdminGuard } from '../sellers/admin.guard.js';
import { AuditService } from './audit.service.js';
import { AuditLogQueryDto } from './audit.dto.js';

@Controller('admin/audit-log')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminAuditController {
  constructor(private readonly audit: AuditService) {}
  @Get() @Header('Cache-Control', 'private, no-store') list(
    @Query() query: AuditLogQueryDto,
  ) {
    return this.audit.list(query);
  }
}
