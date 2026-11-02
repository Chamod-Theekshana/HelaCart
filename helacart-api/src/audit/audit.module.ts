import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AdminAuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';

/** Global so any admin feature can record decisions without import cycles. */
@Global()
@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [AdminAuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
