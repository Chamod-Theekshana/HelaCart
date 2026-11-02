import { Injectable } from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import type { AuditLogQueryDto } from './audit.dto.js';

export const auditActions = [
  'ORDER_CANCEL',
  'ORDER_MARK_DELIVERY_FAILED',
  'ORDER_MARK_RETURNED',
  'ORDER_MARK_DELIVERED',
  'SELLER_SUSPEND',
  'SELLER_REINSTATE',
  'PRODUCT_APPROVE',
  'PRODUCT_REJECT',
  'CATEGORY_CREATE',
  'CATEGORY_UPDATE',
  'HERO_UPDATE',
  'ACCOUNT_ACCESS_CHANGE',
  'COMMISSION_RATE_CHANGE',
] as const;
export type AuditAction = (typeof auditActions)[number];
export type AuditActor = { id: string; email: string };
export type AuditEntry = {
  action: AuditAction;
  subjectType: string;
  subjectId: string;
  reason?: string | null;
  details?: Record<string, unknown>;
};
type Db = Pick<Prisma.TransactionClient, 'adminAuditLog'>;

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  /** Resolves the HelaCart profile of the signed-in administrator. */
  async actor(identity: DecodedIdToken): Promise<AuditActor> {
    const profile = await this.auth.getOrCreateProfile(identity);
    return {
      id: profile.id,
      email: (profile as { email?: string }).email ?? identity.email ?? '',
    };
  }

  /** Writes one append-only audit row; pass the transaction client when inside one. */
  record(db: Db, actor: AuditActor, entry: AuditEntry) {
    return db.adminAuditLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email.slice(0, 320),
        action: entry.action,
        subjectType: entry.subjectType,
        subjectId: entry.subjectId,
        reason: entry.reason ?? null,
        details: (entry.details ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async list(query: AuditLogQueryDto) {
    const limit = query.limit ?? 50;
    const rows = await this.prisma.adminAuditLog.findMany({
      where: query.action ? { action: query.action } : {},
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: limit + 1,
      select: {
        id: true,
        actorId: true,
        actorEmail: true,
        action: true,
        subjectType: true,
        subjectId: true,
        reason: true,
        details: true,
        createdAt: true,
      },
    });
    return {
      items: rows.slice(0, limit),
      nextCursor: rows.length > limit ? rows[limit - 1].id : null,
    };
  }
}
