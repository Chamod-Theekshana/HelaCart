import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { commissionMinor } from '../commission/commission-ledger.js';
import { returnOptions } from './return-workflow.js';
import {
  AfterSalesQuery,
  CaseDecisionDto,
  CaseMessageDto,
  CreateCaseDto,
  RefundRecordDto,
  RefundReviewDto,
  RefundReversalDto,
} from './after-sales.dto.js';
type Scope = { role: 'BUYER' | 'SELLER' | 'ADMIN'; sellerId?: string };
type Db = Prisma.TransactionClient;
const options = { timeout: 30000, maxWait: 10000 } as const;
const normalize = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toUpperCase();
const caseStatuses = [
  'OPEN',
  'UNDER_REVIEW',
  'WAITING_BUYER',
  'WAITING_SELLER',
  'RESOLVED',
  'CLOSED',
];
const returnStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'RESOLVED'];
const refundStatuses = ['PENDING', 'APPROVED', 'REJECTED'];
const page = <T>(items: T[], total: number, q: AfterSalesQuery) => ({
  items,
  total,
  page: q.page,
  pageSize: q.limit,
  pages: Math.max(1, Math.ceil(total / q.limit)),
});
export const refundSelect = {
  id: true,
  sellerId: true,
  returnItemId: true,
  merchandiseMinor: true,
  shippingMinor: true,
  amountMinor: true,
  method: true,
  reference: true,
  paidOn: true,
  note: true,
  status: true,
  reviewNote: true,
  reviewedAt: true,
  createdAt: true,
  reversal: {
    select: { id: true, reason: true, reference: true, createdAt: true },
  },
  returnItem: {
    select: {
      quantity: true,
      baseMinor: true,
      orderItem: { select: { productTitle: true, sku: true } },
      returnRequest: {
        select: {
          id: true,
          buyerId: true,
          sellerOrder: {
            select: {
              id: true,
              orderId: true,
              seller: { select: { name: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.RefundRecordSelect;
const caseSelect = {
  id: true,
  title: true,
  category: true,
  status: true,
  version: true,
  financeHold: true,
  resolution: true,
  sellerOrderId: true,
  createdAt: true,
  updatedAt: true,
  opener: { select: { name: true } },
  seller: { select: { name: true } },
  sellerOrder: { select: { orderId: true, status: true } },
} satisfies Prisma.SupportCaseSelect;

@Injectable()
export class AfterSalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly catalog: CatalogService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}
  private async actor(identity: DecodedIdToken, scope: Scope) {
    if (!identity.email_verified)
      throw new ForbiddenException(
        'Verify your email before accessing support or refunds',
      );
    if (
      scope.role === 'ADMIN' &&
      !this.config
        .getOrThrow<string[]>('ADMIN_FIREBASE_UIDS')
        .includes(identity.uid)
    )
      throw new ForbiddenException('Administrator access required');
    if (scope.role === 'SELLER')
      return this.catalog.requireSellerMember(scope.sellerId!, identity, false);
    return this.auth.getOrCreateProfile(identity);
  }
  private filter(q: AfterSalesQuery, allowed: string[]) {
    if (q.status !== 'ALL' && !allowed.includes(q.status))
      throw new BadRequestException('Invalid status for this workspace');
  }
  private caseWhere(
    scope: Scope,
    userId: string,
  ): Prisma.SupportCaseWhereInput {
    return scope.role === 'ADMIN'
      ? {}
      : scope.role === 'SELLER'
        ? { sellerId: scope.sellerId }
        : { buyerId: userId };
  }
  private async ownedCase(tx: Db, id: string, scope: Scope, userId: string) {
    const row = await tx.supportCase.findFirst({
      where: { id, ...this.caseWhere(scope, userId) },
    });
    if (!row) throw new NotFoundException('Support case not found');
    return row;
  }
  private async lockSeller(tx: Db, sellerId: string) {
    const rows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM "Seller" WHERE id=${sellerId}::uuid FOR UPDATE`;
    if (!rows.length) throw new NotFoundException('Shop not found');
  }
  options(identity: DecodedIdToken, sellerOrderId: string) {
    return returnOptions(
      this.prisma,
      this.auth,
      this.config,
      identity,
      sellerOrderId,
    );
  }

  async returns(identity: DecodedIdToken, scope: Scope, q: AfterSalesQuery) {
    const user = await this.actor(identity, scope);
    this.filter(q, returnStatuses);
    const where: Prisma.ReturnRequestWhereInput = {
      ...(scope.role === 'BUYER'
        ? { buyerId: user.id }
        : scope.role === 'SELLER'
          ? { sellerOrder: { sellerId: scope.sellerId } }
          : {}),
      ...(q.status === 'ALL' ? {} : { status: q.status as 'PENDING' }),
      ...(q.q
        ? {
            OR: [
              { reason: { contains: q.q, mode: 'insensitive' } },
              {
                sellerOrder: {
                  order: { recipient: { contains: q.q, mode: 'insensitive' } },
                },
              },
            ],
          }
        : {}),
    };
    const [total, items] = await this.prisma.$transaction(
      async (tx) => {
        const total = await tx.returnRequest.count({ where });
        const items = await tx.returnRequest.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (q.page - 1) * q.limit,
          take: q.limit,
          include: {
            sellerOrder: {
              select: {
                id: true,
                orderId: true,
                status: true,
                shippingLkrMinor: true,
                seller: { select: { name: true } },
              },
            },
            items: {
              include: {
                orderItem: { select: { productTitle: true, sku: true } },
                refunds: { select: refundSelect },
              },
            },
          },
        });
        return [total, items] as const;
      },
      {
        ...options,
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );
    const totals = items.length
      ? await this.prisma.$queryRaw<{ id: string; used: bigint }[]>(
          Prisma.sql`SELECT rr."sellerOrderId" AS id, SUM(fr."shippingMinor") AS used FROM "RefundRecord" fr JOIN "ReturnItem" ri ON ri.id=fr."returnItemId" JOIN "ReturnRequest" rr ON rr.id=ri."returnRequestId" WHERE rr."sellerOrderId" IN (${Prisma.join([...new Set(items.map((row) => row.sellerOrderId))].map((id) => Prisma.sql`${id}::uuid`))}) AND fr.status<>'REJECTED' AND NOT EXISTS(SELECT 1 FROM "RefundReversal" x WHERE x."refundRecordId"=fr.id) GROUP BY rr."sellerOrderId"`,
        )
      : [];
    return page(
      items.map((row) => ({
        ...row,
        remainingShippingMinor: Math.max(
          0,
          row.sellerOrder.shippingLkrMinor -
            Number(totals.find((t) => t.id === row.sellerOrderId)?.used ?? 0),
        ),
      })),
      total,
      q,
    );
  }
  async refunds(identity: DecodedIdToken, scope: Scope, q: AfterSalesQuery) {
    const user = await this.actor(identity, scope);
    this.filter(q, refundStatuses);
    const where: Prisma.RefundRecordWhereInput = {
      ...(scope.role === 'BUYER'
        ? { returnItem: { returnRequest: { buyerId: user.id } } }
        : scope.role === 'SELLER'
          ? { sellerId: scope.sellerId }
          : {}),
      ...(q.status === 'ALL' ? {} : { status: q.status as 'PENDING' }),
      ...(q.q ? { reference: { contains: q.q, mode: 'insensitive' } } : {}),
    };
    const [total, items] = await this.prisma.$transaction(
      async (tx) => {
        const total = await tx.refundRecord.count({ where });
        const items = await tx.refundRecord.findMany({
          where,
          select: refundSelect,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (q.page - 1) * q.limit,
          take: q.limit,
        });
        return [total, items] as const;
      },
      {
        ...options,
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );
    return page(items, total, q);
  }
  async submitRefund(
    sellerId: string,
    identity: DecodedIdToken,
    dto: RefundRecordDto,
  ) {
    const actor = await this.actor(identity, { role: 'SELLER', sellerId });
    const amount = dto.merchandiseMinor + dto.shippingMinor,
      reference = normalize(dto.reference);
    if (amount < 1 || amount > 1000000000)
      throw new BadRequestException(
        'Enter a positive refund within the supported amount',
      );
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const paid = new Date(`${dto.paidOn}T00:00:00Z`);
    if (
      !Number.isFinite(paid.getTime()) ||
      paid.toISOString().slice(0, 10) !== dto.paidOn ||
      dto.paidOn > today
    )
      throw new BadRequestException(
        'Use a valid refund date that is not in the future',
      );
    return this.prisma.$transaction(async (tx) => {
      await this.lockSeller(tx, sellerId);
      const previous = await tx.refundRecord.findUnique({
        where: {
          sellerId_requestKey: { sellerId, requestKey: dto.requestKey },
        },
      });
      if (previous) {
        if (
          previous.returnItemId !== dto.returnItemId ||
          previous.merchandiseMinor !== dto.merchandiseMinor ||
          previous.shippingMinor !== dto.shippingMinor ||
          previous.reference !== reference ||
          previous.paidOn !== dto.paidOn ||
          previous.method !== dto.method ||
          (previous.note ?? '') !== (dto.note ?? '')
        )
          throw new ConflictException(
            'Refund request key was used for different details',
          );
        return tx.refundRecord.findUniqueOrThrow({
          where: { id: previous.id },
          select: refundSelect,
        });
      }
      const item = await tx.returnItem.findFirst({
        where: {
          id: dto.returnItemId,
          returnRequest: {
            sellerOrder: { sellerId },
            status: { in: ['APPROVED', 'RESOLVED'] },
          },
        },
        include: {
          returnRequest: { include: { sellerOrder: true } },
          refunds: { where: { status: { not: 'REJECTED' }, reversal: null } },
        },
      });
      if (!item)
        throw new NotFoundException(
          'Approved return item not found for this shop',
        );
      const delivered = item.returnRequest.sellerOrder.paymentCollectedAt;
      if (
        delivered &&
        dto.paidOn <
          new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Colombo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(delivered)
      )
        throw new BadRequestException(
          'Refund date cannot precede successful delivery',
        );
      const used = item.refunds.reduce((sum, r) => sum + r.merchandiseMinor, 0);
      const shipping = await tx.refundRecord.aggregate({
        where: {
          status: { not: 'REJECTED' },
          reversal: null,
          returnItem: {
            returnRequest: { sellerOrderId: item.returnRequest.sellerOrderId },
          },
        },
        _sum: { shippingMinor: true },
      });
      if (
        used + dto.merchandiseMinor > item.baseMinor ||
        (shipping._sum.shippingMinor ?? 0) + dto.shippingMinor >
          item.returnRequest.sellerOrder.shippingLkrMinor
      )
        throw new ConflictException(
          'Refund exceeds this item’s remaining merchandise or the order’s remaining delivery amount',
        );
      const duplicate = await tx.refundRecord.findFirst({
        where: {
          returnItemId: item.id,
          reference,
          status: { not: 'REJECTED' },
        },
      });
      if (duplicate)
        throw new ConflictException(
          'This refund reference is already recorded for this item',
        );
      const record = await tx.refundRecord.create({
        data: {
          sellerId,
          submitterId: actor.id,
          requestKey: dto.requestKey,
          returnItemId: item.id,
          merchandiseMinor: dto.merchandiseMinor,
          shippingMinor: dto.shippingMinor,
          amountMinor: amount,
          reference,
          paidOn: dto.paidOn,
          method: dto.method,
          note: dto.note,
        },
        select: refundSelect,
      });
      await this.notifications.forUser(
        tx,
        item.returnRequest.buyerId,
        'REFUND_UPDATED',
        record.id,
        'Your shop submitted a refund record for verification',
        '/account/returns',
      );
      await this.notifications.forAdmins(
        tx,
        'REFUND_UPDATED',
        record.id,
        'A seller refund record requires verification',
        '/admin/refunds',
      );
      return record;
    }, options);
  }
  private async creditCommission(
    tx: Db,
    sellerId: string,
    actorId: string,
    orderItemId: string,
    sellerOrderId: string,
    baseMinor: number,
    recordId: string,
  ) {
    if (!baseMinor) return null;
    const charge = await tx.commissionCharge.findFirst({
      where: {
        sellerId,
        sellerOrderId,
        OR: [{ orderItemId }, { orderItemId: null }],
      },
      include: { refunds: { include: { correction: true } } },
    });
    if (!charge) return null;
    const base = charge.refunds.reduce(
        (s, r) => s + r.baseMinor - (r.correction?.baseMinor ?? 0),
        0,
      ),
      credits = charge.refunds.reduce(
        (s, r) => s + r.creditMinor - (r.correction?.amountMinor ?? 0),
        0,
      );
    const additional = Math.min(baseMinor, charge.baseMinor - base);
    if (additional <= 0) return null;
    const credit = await tx.commissionRefund.create({
      data: {
        sellerId,
        actorId,
        chargeId: charge.id,
        requestKey: randomUUID(),
        baseMinor: additional,
        creditMinor:
          commissionMinor(base + additional, charge.rateBps) - credits,
        reference: `REFUND-${recordId}`,
        reason: 'Commission credit for an administrator-verified buyer refund',
      },
    });
    return credit.id;
  }
  async reviewRefund(
    id: string,
    identity: DecodedIdToken,
    dto: RefundReviewDto,
  ) {
    const actor = await this.actor(identity, { role: 'ADMIN' }),
      target = await this.prisma.refundRecord.findUnique({
        where: { id },
        select: { sellerId: true },
      });
    if (!target) throw new NotFoundException('Refund record not found');
    return this.prisma.$transaction(async (tx) => {
      await this.lockSeller(tx, target.sellerId);
      const record = await tx.refundRecord.findUniqueOrThrow({
        where: { id },
        include: { returnItem: { include: { returnRequest: true } } },
      });
      if (record.status !== 'PENDING')
        throw new ConflictException('Refund record has already been reviewed');
      if (record.submitterId === actor.id)
        throw new ForbiddenException(
          'You cannot verify your own refund submission',
        );
      const commissionRefundId =
        dto.decision === 'APPROVED'
          ? await this.creditCommission(
              tx,
              record.sellerId,
              actor.id,
              record.returnItem.orderItemId,
              record.returnItem.returnRequest.sellerOrderId,
              record.merchandiseMinor,
              record.id,
            )
          : null;
      const result = await tx.refundRecord.update({
        where: { id },
        data: {
          status: dto.decision,
          reviewerId: actor.id,
          reviewedAt: new Date(),
          reviewNote: dto.reason,
          commissionRefundId,
        },
        select: refundSelect,
      });
      await this.notifications.forUser(
        tx,
        record.returnItem.returnRequest.buyerId,
        'REFUND_UPDATED',
        id,
        `Refund record ${dto.decision === 'APPROVED' ? 'verified' : 'rejected after review'}`,
        '/account/returns',
      );
      await this.notifications.forSeller(
        tx,
        record.sellerId,
        'REFUND_UPDATED',
        id,
        `Refund record ${dto.decision.toLowerCase()}`,
        '/seller/returns',
      );
      return result;
    }, options);
  }
  async reverseRefund(
    id: string,
    identity: DecodedIdToken,
    dto: RefundReversalDto,
  ) {
    const actor = await this.actor(identity, { role: 'ADMIN' }),
      target = await this.prisma.refundRecord.findUnique({
        where: { id },
        select: { sellerId: true },
      });
    if (!target) throw new NotFoundException('Refund record not found');
    return this.prisma.$transaction(async (tx) => {
      await this.lockSeller(tx, target.sellerId);
      const previous = await tx.refundReversal.findUnique({
        where: { requestKey: dto.requestKey },
      });
      if (previous) {
        if (
          previous.refundRecordId !== id ||
          previous.reference !== normalize(dto.reference) ||
          previous.reason !== dto.reason
        )
          throw new ConflictException(
            'Reversal request key was used for different details',
          );
        return previous;
      }
      const record = await tx.refundRecord.findUniqueOrThrow({
        where: { id },
        include: {
          reversal: true,
          returnItem: { include: { returnRequest: true } },
          commissionRefund: {
            include: {
              correction: true,
              charge: {
                include: { refunds: { include: { correction: true } } },
              },
            },
          },
        },
      });
      if (record.status !== 'APPROVED' || record.reversal)
        throw new ConflictException(
          'Only an uncorrected verified refund record can be reversed',
        );
      const credit = record.commissionRefund;
      if (credit && !credit.correction) {
        const base = credit.charge.refunds.reduce(
            (s, r) => s + r.baseMinor - (r.correction?.baseMinor ?? 0),
            0,
          ),
          credits = credit.charge.refunds.reduce(
            (s, r) => s + r.creditMinor - (r.correction?.amountMinor ?? 0),
            0,
          );
        await tx.commissionCorrection.create({
          data: {
            sellerId: record.sellerId,
            actorId: actor.id,
            refundId: credit.id,
            requestKey: randomUUID(),
            amountMinor:
              credits -
              commissionMinor(base - credit.baseMinor, credit.charge.rateBps),
            baseMinor: credit.baseMinor,
            reference: `REFUND-REVERSAL-${id}`,
            reason: dto.reason,
          },
        });
      }
      const result = await tx.refundReversal.create({
        data: {
          refundRecordId: id,
          actorId: actor.id,
          requestKey: dto.requestKey,
          reference: normalize(dto.reference),
          reason: dto.reason,
        },
      });
      await this.notifications.forUser(
        tx,
        record.returnItem.returnRequest.buyerId,
        'REFUND_UPDATED',
        id,
        'An incorrect refund record was reversed with a recorded reason',
        '/account/returns',
      );
      await this.notifications.forSeller(
        tx,
        record.sellerId,
        'REFUND_UPDATED',
        id,
        'An incorrect refund record was reversed; review the recorded reason',
        '/seller/returns',
      );
      return result;
    }, options);
  }

  async cases(identity: DecodedIdToken, scope: Scope, q: AfterSalesQuery) {
    const actor = await this.actor(identity, scope);
    this.filter(q, caseStatuses);
    const where: Prisma.SupportCaseWhereInput = {
      ...this.caseWhere(scope, actor.id),
      ...(q.status === 'ALL' ? {} : { status: q.status }),
      ...(q.q ? { title: { contains: q.q, mode: 'insensitive' } } : {}),
    };
    const [total, items] = await this.prisma.$transaction(
      async (tx) => {
        const total = await tx.supportCase.count({ where });
        const items = await tx.supportCase.findMany({
          where,
          select: caseSelect,
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          skip: (q.page - 1) * q.limit,
          take: q.limit,
        });
        return [total, items] as const;
      },
      {
        ...options,
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );
    return page(items, total, q);
  }
  async caseDetail(id: string, identity: DecodedIdToken, scope: Scope) {
    const actor = await this.actor(identity, scope);
    await this.ownedCase(this.prisma, id, scope, actor.id);
    return this.prisma.supportCase.findUniqueOrThrow({
      where: { id },
      select: {
        ...caseSelect,
        events: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            fromStatus: true,
            toStatus: true,
            financeHold: true,
            reason: true,
            createdAt: true,
          },
        },
      },
    });
  }
  async caseMessages(
    id: string,
    identity: DecodedIdToken,
    scope: Scope,
    q: AfterSalesQuery,
  ) {
    const actor = await this.actor(identity, scope);
    await this.ownedCase(this.prisma, id, scope, actor.id);
    const [total, items] = await this.prisma.$transaction(
      async (tx) => {
        const total = await tx.supportMessage.count({ where: { caseId: id } });
        const items = await tx.supportMessage.findMany({
          where: { caseId: id },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (q.page - 1) * q.limit,
          take: q.limit,
          select: {
            id: true,
            body: true,
            authorRole: true,
            createdAt: true,
            author: { select: { name: true } },
          },
        });
        return [total, items] as const;
      },
      {
        ...options,
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );
    return page(items.reverse(), total, q);
  }
  private async notifyCase(
    tx: Db,
    row: {
      id: string;
      openerId: string;
      buyerId: string | null;
      sellerId: string | null;
    },
    actorId: string,
    message: string,
  ) {
    const recipients = new Map<string, string>();
    if (row.buyerId)
      recipients.set(row.buyerId, `/account/support?case=${row.id}`);
    if (row.sellerId) {
      const members = await tx.sellerMember.findMany({
        where: { sellerId: row.sellerId },
        select: { userId: true },
      });
      for (const member of members)
        recipients.set(member.userId, `/seller/support?case=${row.id}`);
    }
    if (!recipients.has(row.openerId))
      recipients.set(row.openerId, `/account/support?case=${row.id}`);
    const admins = await tx.user.findMany({
      where: {
        firebaseUid: {
          in: this.config.getOrThrow<string[]>('ADMIN_FIREBASE_UIDS'),
        },
      },
      select: { id: true },
    });
    for (const admin of admins)
      recipients.set(admin.id, `/admin/support?case=${row.id}`);
    recipients.delete(actorId);
    if (recipients.size)
      await tx.notification.createMany({
        data: [...recipients].map(([userId, href]) => ({
          userId,
          href,
          type: 'SUPPORT_UPDATED' as const,
          subjectId: row.id,
          message,
        })),
      });
  }
  async createCase(identity: DecodedIdToken, scope: Scope, dto: CreateCaseDto) {
    const actor = await this.actor(identity, scope);
    if (scope.role === 'ADMIN')
      throw new ForbiddenException(
        'Open a support case from a buyer or shop workspace',
      );
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${actor.id}::uuid FOR UPDATE`;
      const previous = await tx.supportCase.findUnique({
        where: {
          openerId_requestKey: {
            openerId: actor.id,
            requestKey: dto.requestKey,
          },
        },
        include: {
          messages: { where: { requestKey: dto.requestKey }, take: 1 },
        },
      });
      if (previous) {
        if (
          (scope.role === 'SELLER' && previous.sellerId !== scope.sellerId) ||
          (scope.role === 'BUYER' && previous.buyerId !== actor.id)
        )
          throw new NotFoundException(
            'Support case not found in this workspace',
          );
        if (
          previous.title !== dto.title ||
          previous.category !== dto.category ||
          (previous.sellerOrderId ?? null) !== (dto.sellerOrderId ?? null) ||
          previous.messages[0]?.body !== dto.body
        )
          throw new ConflictException(
            'Case request key was used for different details',
          );
        return previous;
      }
      let buyerId: string | null = scope.role === 'BUYER' ? actor.id : null,
        sellerId = scope.sellerId ?? null;
      if (dto.sellerOrderId) {
        const order = await tx.sellerOrder.findFirst({
          where: {
            id: dto.sellerOrderId,
            ...(scope.role === 'BUYER'
              ? { order: { buyerId: actor.id } }
              : { sellerId: scope.sellerId }),
          },
          select: { sellerId: true, order: { select: { buyerId: true } } },
        });
        if (!order)
          throw new NotFoundException('Order not found in this workspace');
        buyerId = order.order.buyerId;
        sellerId = order.sellerId;
      }
      const created = await tx.supportCase.create({
        data: {
          openerId: actor.id,
          buyerId,
          sellerId,
          sellerOrderId: dto.sellerOrderId,
          requestKey: dto.requestKey,
          title: dto.title,
          category: dto.category,
          messages: {
            create: {
              authorId: actor.id,
              authorRole: scope.role,
              requestKey: dto.requestKey,
              body: dto.body,
            },
          },
        },
      });
      await this.notifyCase(
        tx,
        created,
        actor.id,
        'A new support case needs attention',
      );
      return created;
    }, options);
  }
  async addMessage(
    id: string,
    identity: DecodedIdToken,
    scope: Scope,
    dto: CaseMessageDto,
  ) {
    const actor = await this.actor(identity, scope);
    return this.prisma.$transaction(async (tx) => {
      const row = await this.ownedCase(tx, id, scope, actor.id);
      await tx.$queryRaw`SELECT id FROM "SupportCase" WHERE id=${id}::uuid FOR UPDATE`;
      const previous = await tx.supportMessage.findUnique({
        where: {
          caseId_requestKey: { caseId: id, requestKey: dto.requestKey },
        },
      });
      if (previous) {
        if (previous.authorId !== actor.id || previous.body !== dto.body)
          throw new ConflictException(
            'Message request key was used for different details',
          );
        return previous;
      }
      const current = await tx.supportCase.findUniqueOrThrow({ where: { id } });
      if (current.status === 'CLOSED')
        throw new ConflictException(
          'This case is closed. Open a new case if you need further help',
        );
      const message = await tx.supportMessage.create({
        data: {
          caseId: id,
          authorId: actor.id,
          authorRole: scope.role,
          requestKey: dto.requestKey,
          body: dto.body,
        },
      });
      const updated = await tx.supportCase.update({
        where: { id },
        data: {
          version: { increment: 1 },
          ...(current.status === 'RESOLVED'
            ? { status: 'OPEN', resolution: null }
            : {}),
        },
      });
      if (current.status === 'RESOLVED')
        await tx.supportCaseEvent.create({
          data: {
            caseId: id,
            actorId: actor.id,
            version: updated.version,
            fromStatus: 'RESOLVED',
            toStatus: 'OPEN',
            financeHold: false,
            reason: 'Case reopened by a participant reply',
          },
        });
      await this.notifyCase(
        tx,
        row,
        actor.id,
        'There is a new reply on your support case',
      );
      return message;
    }, options);
  }
  async decideCase(id: string, identity: DecodedIdToken, dto: CaseDecisionDto) {
    const actor = await this.actor(identity, { role: 'ADMIN' });
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "SupportCase" WHERE id=${id}::uuid FOR UPDATE`;
      const before = await tx.supportCase.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Support case not found');
      if (before.version !== dto.version)
        throw new ConflictException(
          'Case changed. Reload the latest replies before deciding',
        );
      if (dto.financeHold && !before.sellerOrderId)
        throw new BadRequestException(
          'A commission hold requires an order-linked case',
        );
      const closed = ['RESOLVED', 'CLOSED'].includes(dto.status),
        financeHold = closed ? false : dto.financeHold;
      const after = await tx.supportCase.update({
        where: { id },
        data: {
          status: dto.status,
          financeHold,
          version: { increment: 1 },
          resolution: closed ? dto.reason : null,
        },
      });
      await tx.supportCaseEvent.create({
        data: {
          caseId: id,
          actorId: actor.id,
          version: after.version,
          fromStatus: before.status,
          toStatus: after.status,
          financeHold,
          reason: dto.reason,
        },
      });
      await this.notifyCase(
        tx,
        after,
        actor.id,
        `Support case ${dto.status.toLowerCase().replaceAll('_', ' ')}`,
      );
      return after;
    }, options);
  }
}
