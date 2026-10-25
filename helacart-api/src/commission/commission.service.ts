import { createHash } from 'node:crypto';
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
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  CommissionReceiptsService,
  type ReceiptFile,
} from './commission-receipts.service.js';
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
import { commissionMinor } from './commission-ledger.js';

const transactionOptions = { timeout: 15000, maxWait: 10000 } as const;
const paymentSelect = {
  correction: {
    select: {
      id: true,
      amountMinor: true,
      reason: true,
      reference: true,
      createdAt: true,
    },
  },
  id: true,
  sellerId: true,
  amountMinor: true,
  reference: true,
  paidOn: true,
  status: true,
  note: true,
  reviewNote: true,
  reviewedAt: true,
  createdAt: true,
} satisfies Prisma.CommissionPaymentSelect;
type Db = Prisma.TransactionClient;
function number(value: unknown): number {
  const n = Number(value ?? 0);
  if (!Number.isSafeInteger(n))
    throw new Error('Commission amount exceeds safe reporting range');
  return n;
}
function plain(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [
      k,
      typeof v === 'bigint' ? number(v) : v,
    ]),
  );
}
function normalizedReference(value: string) {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}
function page<T>(items: T[], total: number, query: CommissionQueryDto) {
  return {
    items,
    total,
    page: query.page,
    pageSize: query.limit,
    pages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

// One aggregate per table, not one query per seller. Payments offset the oldest
// due obligations first; refund credits reduce their specific order's charge.
const balanceCte = Prisma.sql`WITH refunds AS (
  SELECT r."chargeId", SUM(r."creditMinor"-COALESCE(x."amountMinor",0)) AS credit
  FROM "CommissionRefund" r LEFT JOIN "CommissionCorrection" x ON x."refundId"=r.id GROUP BY r."chargeId"
), charges AS (
  SELECT c."sellerId", SUM(c."amountMinor") AS gross, SUM(COALESCE(r.credit,0)) AS credits,
    SUM(c."amountMinor"-COALESCE(r.credit,0)) AS net,
    SUM(CASE WHEN c."holdUntil" <= NOW() AND NOT COALESCE((SELECT h.held FROM "CommissionHoldEvent" h WHERE h."chargeId"=c.id ORDER BY h.version DESC LIMIT 1),false) AND NOT EXISTS (
      SELECT 1 FROM "ReturnRequest" rr WHERE rr."sellerOrderId"=c."sellerOrderId" AND rr.status IN ('PENDING','APPROVED')
    ) THEN c."amountMinor"-COALESCE(r.credit,0) ELSE 0 END) AS mature,
    SUM(CASE WHEN c."dueAt" < NOW() AND NOT COALESCE((SELECT h.held FROM "CommissionHoldEvent" h WHERE h."chargeId"=c.id ORDER BY h.version DESC LIMIT 1),false) AND NOT EXISTS (
      SELECT 1 FROM "ReturnRequest" rr WHERE rr."sellerOrderId"=c."sellerOrderId" AND rr.status IN ('PENDING','APPROVED')
    ) THEN c."amountMinor"-COALESCE(r.credit,0) ELSE 0 END) AS overdue
  FROM "CommissionCharge" c LEFT JOIN refunds r ON r."chargeId"=c.id GROUP BY c."sellerId"
), payments AS (
  SELECT p."sellerId", SUM(CASE WHEN p.status='APPROVED' THEN p."amountMinor"-COALESCE(x."amountMinor",0) ELSE 0 END) AS paid,
    SUM(CASE WHEN p.status='PENDING' THEN p."amountMinor" ELSE 0 END) AS pending
  FROM "CommissionPayment" p LEFT JOIN "CommissionCorrection" x ON x."paymentId"=p.id GROUP BY p."sellerId"
), b AS (
  SELECT s.id, s.name, s.slug, s.status,
    COALESCE(c.gross,0)::bigint AS "chargedMinor", COALESCE(c.credits,0)::bigint AS "creditedMinor",
    COALESCE(p.paid,0)::bigint AS "paidMinor", COALESCE(p.pending,0)::bigint AS "pendingMinor",
    (COALESCE(c.net,0)-COALESCE(p.paid,0))::bigint AS "balanceMinor",
    GREATEST(0,COALESCE(c.net,0)-COALESCE(p.paid,0))::bigint AS "outstandingMinor",
    GREATEST(0,COALESCE(c.mature,0)-COALESCE(p.paid,0))::bigint AS "payableMinor",
    GREATEST(0,COALESCE(c.mature,0)-COALESCE(p.paid,0)-COALESCE(p.pending,0))::bigint AS "availableToSubmitMinor",
    GREATEST(0,COALESCE(c.overdue,0)-COALESCE(p.paid,0))::bigint AS "overdueMinor",
    GREATEST(0,COALESCE(p.paid,0)-COALESCE(c.net,0))::bigint AS "creditBalanceMinor",
    (GREATEST(0,COALESCE(c.net,0)-COALESCE(p.paid,0))-GREATEST(0,COALESCE(c.mature,0)-COALESCE(p.paid,0)))::bigint AS "heldMinor"
  FROM "Seller" s LEFT JOIN charges c ON c."sellerId"=s.id LEFT JOIN payments p ON p."sellerId"=s.id
  WHERE s.status IN ('APPROVED','SUSPENDED') OR c."sellerId" IS NOT NULL OR p."sellerId" IS NOT NULL
)`;

@Injectable()
export class CommissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly receipts: CommissionReceiptsService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  private async member(sellerId: string, identity: DecodedIdToken) {
    if (!identity.email_verified)
      throw new ForbiddenException('Verify your email to access shop finances');
    const user = await this.auth.getOrCreateProfile(identity);
    await this.membership(this.prisma, sellerId, user.id);
    return user;
  }
  private async membership(tx: Db, sellerId: string, userId: string) {
    const member = await tx.sellerMember.findUnique({
      where: { sellerId_userId: { sellerId, userId } },
      select: { id: true },
    });
    if (!member)
      throw new ForbiddenException('This account cannot access this shop');
  }
  private async lockSeller(tx: Db, sellerId: string) {
    const rows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM "Seller" WHERE id=${sellerId}::uuid FOR UPDATE`;
    if (!rows.length) throw new NotFoundException('Shop not found');
  }
  private async balance(tx: Db, sellerId: string) {
    const [row] = await tx.$queryRaw<Record<string, unknown>[]>(
      Prisma.sql`${balanceCte} SELECT * FROM b WHERE id=${sellerId}::uuid`,
    );
    if (!row) throw new NotFoundException('Shop finance account not found');
    return plain(row);
  }
  async policy() {
    const policy = await this.prisma.commissionPolicy.findUniqueOrThrow({
      where: { id: 'platform' },
    });
    const { enabled: _enabled, rateBps: _rate, ...settings } = policy;
    return {
      ...settings,
      mode: 'PRODUCT' as const,
      returnDays: this.config.getOrThrow<number>('RETURN_WINDOW_DAYS'),
    };
  }
  async updatePolicy(identity: DecodedIdToken, dto: CommissionPolicyDto) {
    const actor = await this.auth.getOrCreateProfile(identity);
    const { version, reason, ...data } = dto;
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.commissionPolicy.findUniqueOrThrow({
        where: { id: 'platform' },
      });
      if (before.version !== version)
        throw new ConflictException(
          'Commission settings changed. Reload before saving',
        );
      const changed = await tx.commissionPolicy.updateMany({
        where: { id: 'platform', version },
        data: { ...data, version: { increment: 1 } },
      });
      if (!changed.count)
        throw new ConflictException(
          'Commission settings changed. Reload before saving',
        );
      const after = await tx.commissionPolicy.findUniqueOrThrow({
        where: { id: 'platform' },
      });
      await tx.commissionPolicyChange.create({
        data: {
          version: after.version,
          actorId: actor.id,
          reason,
          before: JSON.parse(JSON.stringify(before)),
          after: JSON.parse(JSON.stringify(after)),
        },
      });
      return after;
    }, transactionOptions);
  }
  policyHistory() {
    return this.prisma.commissionPolicyChange.findMany({
      orderBy: { version: 'desc' },
      take: 20,
      select: {
        id: true,
        version: true,
        reason: true,
        before: true,
        after: true,
        createdAt: true,
        actor: { select: { email: true } },
      },
    });
  }
  async products(
    query: CommissionQueryDto,
    sellerId?: string,
    identity?: DecodedIdToken,
  ) {
    if (sellerId && identity) await this.member(sellerId, identity);
    const where: Prisma.ProductWhereInput = {
      ...(sellerId ? { sellerId } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { sku: { contains: query.q, mode: 'insensitive' } },
              { seller: { name: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [total, items] = await this.prisma.$transaction(
      [
        this.prisma.product.count({ where }),
        this.prisma.product.findMany({
          where,
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          orderBy: [{ title: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            title: true,
            sku: true,
            status: true,
            commissionRateBps: true,
            commissionVersion: true,
            seller: { select: { name: true } },
          },
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return page(items, total, query);
  }
  productHistory(productId: string) {
    return this.prisma.productCommissionChange.findMany({
      where: { productId },
      orderBy: { version: 'desc' },
      take: 20,
    });
  }
  async updateProduct(
    productId: string,
    identity: DecodedIdToken,
    dto: ProductCommissionDto,
  ) {
    const actor = await this.auth.getOrCreateProfile(identity);
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.product.findUnique({ where: { id: productId } });
      if (!before) throw new NotFoundException('Product not found');
      const changed = await tx.product.updateMany({
        where: { id: productId, commissionVersion: dto.version },
        data: {
          commissionRateBps: dto.rateBps,
          commissionVersion: { increment: 1 },
        },
      });
      if (!changed.count)
        throw new ConflictException(
          'Product rate changed. Reload before saving',
        );
      await tx.productCommissionChange.create({
        data: {
          productId,
          version: dto.version + 1,
          actorId: actor.id,
          beforeRateBps: before.commissionRateBps,
          rateBps: dto.rateBps,
          reason: dto.reason,
        },
      });
      return tx.product.findUniqueOrThrow({
        where: { id: productId },
        select: { id: true, commissionRateBps: true, commissionVersion: true },
      });
    }, transactionOptions);
  }
  async hold(
    chargeId: string,
    identity: DecodedIdToken,
    dto: CommissionHoldDto,
  ) {
    const actor = await this.auth.getOrCreateProfile(identity);
    return this.prisma.$transaction(async (tx) => {
      const charge = await tx.commissionCharge.findUnique({
        where: { id: chargeId },
      });
      if (!charge) throw new NotFoundException('Commission charge not found');
      await this.lockSeller(tx, charge.sellerId);
      const last = await tx.commissionHoldEvent.findFirst({
        where: { chargeId },
        orderBy: { version: 'desc' },
      });
      if ((last?.version ?? 0) !== dto.version)
        throw new ConflictException('Hold changed. Reload before saving');
      // Hold the entire shop order, including differently priced/rated items.
      const siblings = await tx.commissionCharge.findMany({
        where: { sellerOrderId: charge.sellerOrderId },
        select: { id: true, holds: { orderBy: { version: 'desc' }, take: 1 } },
      });
      const changes = siblings.map((sibling) => ({
        chargeId: sibling.id,
        actorId: actor.id,
        version: (sibling.holds[0]?.version ?? 0) + 1,
        held: dto.held,
        reason: dto.reason,
      }));
      await tx.commissionHoldEvent.createMany({ data: changes });
      await this.notifications.forSeller(
        tx,
        charge.sellerId,
        'COMMISSION_REVIEWED',
        charge.id,
        dto.held
          ? 'Commission payment paused for an unresolved case'
          : 'Manual commission hold released; open return cases remain paused',
      );
      return tx.commissionHoldEvent.findUniqueOrThrow({
        where: { chargeId_version: { chargeId, version: dto.version + 1 } },
      });
    }, transactionOptions);
  }
  async sellerSummary(sellerId: string, identity: DecodedIdToken) {
    await this.member(sellerId, identity);
    return this.prisma.$transaction(
      (tx) => this.balance(tx, sellerId),
      transactionOptions,
    );
  }
  sellerSummaryForAdmin(sellerId: string) {
    return this.prisma.$transaction(
      (tx) => this.balance(tx, sellerId),
      transactionOptions,
    );
  }
  async adminSummary() {
    const [row] = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >(Prisma.sql`${balanceCte}
      SELECT COALESCE(SUM("chargedMinor"),0)::bigint AS "chargedMinor", COALESCE(SUM("creditedMinor"),0)::bigint AS "creditedMinor",
      COALESCE(SUM("paidMinor"),0)::bigint AS "paidMinor", COALESCE(SUM("outstandingMinor"),0)::bigint AS "outstandingMinor",
      COALESCE(SUM("pendingMinor"),0)::bigint AS "pendingMinor", COALESCE(SUM("overdueMinor"),0)::bigint AS "overdueMinor",
      COUNT(*) FILTER (WHERE "overdueMinor">0) AS "overdueSellers" FROM b`);
    return plain(row);
  }
  async balances(query: CommissionQueryDto) {
    const filter =
      query.filter === 'OVERDUE'
        ? Prisma.sql`AND "overdueMinor">0`
        : query.filter === 'OUTSTANDING'
          ? Prisma.sql`AND "outstandingMinor">0`
          : query.filter === 'PENDING'
            ? Prisma.sql`AND "pendingMinor">0`
            : Prisma.empty;
    const search = query.q
      ? Prisma.sql`AND (name ILIKE ${'%' + query.q + '%'} OR slug ILIKE ${'%' + query.q + '%'})`
      : Prisma.empty;
    return this.prisma.$transaction(
      async (tx) => {
        const [count] = await tx.$queryRaw<{ count: bigint }[]>(
          Prisma.sql`${balanceCte} SELECT COUNT(*) AS count FROM b WHERE TRUE ${filter} ${search}`,
        );
        const rows = await tx.$queryRaw<Record<string, unknown>[]>(
          Prisma.sql`${balanceCte} SELECT * FROM b WHERE TRUE ${filter} ${search} ORDER BY "overdueMinor" DESC, "outstandingMinor" DESC, name, id LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`,
        );
        return page(rows.map(plain), number(count.count), query);
      },
      {
        ...transactionOptions,
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );
  }
  async charges(
    sellerId: string,
    query: CommissionQueryDto,
    identity?: DecodedIdToken,
  ) {
    if (identity) await this.member(sellerId, identity);
    const where = { sellerId };
    const [total, rows] = await this.prisma.$transaction(
      [
        this.prisma.commissionCharge.count({ where }),
        this.prisma.commissionCharge.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          include: {
            orderItem: { select: { productTitle: true, sku: true } },
            holds: { orderBy: { version: 'desc' }, take: 20 },
            refunds: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                baseMinor: true,
                creditMinor: true,
                reference: true,
                reason: true,
                createdAt: true,
                correction: {
                  select: {
                    id: true,
                    amountMinor: true,
                    baseMinor: true,
                    reason: true,
                    reference: true,
                    createdAt: true,
                  },
                },
              },
            },
            sellerOrder: {
              select: {
                orderId: true,
                returnRequest: { select: { status: true } },
              },
            },
          },
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return page(
      rows.map((row) => ({
        ...row,
        manualOnHold: row.holds[0]?.held ?? false,
        holdVersion: row.holds[0]?.version ?? 0,
        refundedBaseMinor: row.refunds.reduce(
          (s, r) => s + r.baseMinor - (r.correction?.baseMinor ?? 0),
          0,
        ),
        creditedMinor: row.refunds.reduce(
          (s, r) => s + r.creditMinor - (r.correction?.amountMinor ?? 0),
          0,
        ),
        returnOnHold: ['PENDING', 'APPROVED'].includes(
          row.sellerOrder.returnRequest?.status ?? '',
        ),
      })),
      total,
      query,
    );
  }
  async payments(
    query: CommissionQueryDto,
    sellerId?: string,
    identity?: DecodedIdToken,
  ) {
    if (sellerId && identity) await this.member(sellerId, identity);
    const where = {
      ...(sellerId ? { sellerId } : {}),
      ...(query.status !== 'ALL'
        ? { status: query.status as 'PENDING' | 'APPROVED' | 'REJECTED' }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction(
      [
        this.prisma.commissionPayment.count({ where }),
        this.prisma.commissionPayment.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          select: {
            ...paymentSelect,
            seller: { select: { name: true, slug: true } },
          },
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return page(rows, total, query);
  }
  async submit(
    sellerId: string,
    identity: DecodedIdToken,
    dto: CommissionPaymentDto,
    file?: ReceiptFile,
  ) {
    const user = await this.member(sellerId, identity);
    this.receipts.validate(file);
    const paidDate = new Date(dto.paidOn + 'T00:00:00.000Z');
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    if (
      !Number.isFinite(paidDate.getTime()) ||
      paidDate.toISOString().slice(0, 10) !== dto.paidOn ||
      dto.paidOn > today
    )
      throw new BadRequestException(
        'Payment date must be a valid date on or before today',
      );
    const reference = normalizedReference(dto.reference);
    const payloadHash = createHash('sha256')
      .update(
        JSON.stringify([
          dto.amountMinor,
          reference,
          dto.paidOn,
          dto.note ?? '',
          file.mimetype,
        ]),
      )
      .update(file.buffer)
      .digest('hex');
    const previous = await this.prisma.commissionPayment.findUnique({
      where: { sellerId_requestKey: { sellerId, requestKey: dto.requestKey } },
    });
    if (previous) {
      if (previous.payloadHash !== payloadHash)
        throw new ConflictException(
          'Payment request key was already used for different details',
        );
      return this.prisma.commissionPayment.findUniqueOrThrow({
        where: { id: previous.id },
        select: paymentSelect,
      });
    }
    const receipt = await this.receipts.upload(sellerId, file);
    let committed = false;
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await this.lockSeller(tx, sellerId);
        await this.membership(tx, sellerId, user.id);
        const repeated = await tx.commissionPayment.findUnique({
          where: {
            sellerId_requestKey: { sellerId, requestKey: dto.requestKey },
          },
        });
        if (repeated) {
          if (repeated.payloadHash !== payloadHash)
            throw new ConflictException(
              'Payment request key was already used for different details',
            );
          return {
            saved: false,
            payment: await tx.commissionPayment.findUniqueOrThrow({
              where: { id: repeated.id },
              select: paymentSelect,
            }),
          };
        }
        const balance = await this.balance(tx, sellerId);
        if (dto.amountMinor > number(balance.availableToSubmitMinor))
          throw new ConflictException(
            'Amount exceeds payable commission after pending submissions. Refresh your balance',
          );
        const payment = await tx.commissionPayment.create({
          data: {
            sellerId,
            submitterId: user.id,
            requestKey: dto.requestKey,
            payloadHash,
            amountMinor: dto.amountMinor,
            reference,
            paidOn: dto.paidOn,
            note: dto.note,
            ...receipt,
          },
          select: paymentSelect,
        });
        const admins = await tx.user.findMany({
          where: {
            firebaseUid: {
              in: this.config.getOrThrow<string[]>('ADMIN_FIREBASE_UIDS'),
            },
          },
          select: { id: true },
        });
        for (const admin of admins)
          await this.notifications.forUser(
            tx,
            admin.id,
            'COMMISSION_SUBMITTED',
            payment.id,
            'A seller submitted a commission bank payment for verification',
          );
        return { saved: true, payment };
      }, transactionOptions);
      committed = result.saved;
      return result.payment;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'This bank reference is already recorded. Check payment history',
        );
      throw error;
    } finally {
      if (!committed) {
        // A connection may fail after PostgreSQL commits. Never remove a
        // receipt whose commit is confirmed or whose outcome is still unknown.
        const persisted = await this.prisma.commissionPayment
          .findUnique({
            where: { storageKey: receipt.storageKey },
            select: { id: true },
          })
          .catch(() => undefined);
        if (persisted === null)
          await this.receipts.remove(receipt).catch(() => undefined);
      }
    }
  }
  async review(id: string, identity: DecodedIdToken, dto: CommissionReviewDto) {
    const actor = await this.auth.getOrCreateProfile(identity);
    const target = await this.prisma.commissionPayment.findUnique({
      where: { id },
      select: { sellerId: true },
    });
    if (!target) throw new NotFoundException('Payment not found');
    return this.prisma.$transaction(async (tx) => {
      await this.lockSeller(tx, target.sellerId);
      const payment = await tx.commissionPayment.findUniqueOrThrow({
        where: { id },
      });
      if (payment.submitterId === actor.id)
        throw new ForbiddenException(
          'You cannot review your own payment submission',
        );
      if (payment.status !== 'PENDING')
        throw new ConflictException('Payment has already been reviewed');
      const result = await tx.commissionPayment.update({
        where: { id },
        data: {
          status: dto.decision,
          reviewerId: actor.id,
          reviewNote: dto.reason,
          reviewedAt: new Date(),
        },
        select: paymentSelect,
      });
      await this.notifications.forSeller(
        tx,
        payment.sellerId,
        'COMMISSION_REVIEWED',
        id,
        `Commission payment ${payment.reference} was ${dto.decision.toLowerCase()}`,
      );
      return result;
    }, transactionOptions);
  }
  async receipt(id: string, sellerId?: string, identity?: DecodedIdToken) {
    if (sellerId && identity) await this.member(sellerId, identity);
    const payment = await this.prisma.commissionPayment.findFirst({
      where: { id, ...(sellerId ? { sellerId } : {}) },
      select: { storageKey: true, contentType: true, byteSize: true },
    });
    if (!payment) throw new NotFoundException('Payment receipt not found');
    return this.receipts.read(payment);
  }
  async refund(
    sellerId: string,
    identity: DecodedIdToken,
    dto: CommissionRefundDto,
  ) {
    const actor = await this.auth.getOrCreateProfile(identity);
    return this.prisma
      .$transaction(async (tx) => {
        await this.lockSeller(tx, sellerId);
        const reference = normalizedReference(dto.reference);
        const existing = await tx.commissionRefund.findUnique({
          where: { requestKey: dto.requestKey },
        });
        if (existing) {
          if (
            existing.sellerId !== sellerId ||
            existing.chargeId !== dto.chargeId ||
            existing.baseMinor !== dto.baseMinor ||
            existing.reference !== reference ||
            existing.reason !== dto.reason
          )
            throw new ConflictException('Refund request key was already used');
          return existing;
        }
        const charge = await tx.commissionCharge.findFirst({
          where: { id: dto.chargeId, sellerId },
          include: { refunds: { include: { correction: true } } },
        });
        if (!charge) throw new NotFoundException('Commission charge not found');
        const refunded = charge.refunds.reduce(
          (s, r) => s + r.baseMinor - (r.correction?.baseMinor ?? 0),
          0,
        );
        const credited = charge.refunds.reduce(
          (s, r) => s + r.creditMinor - (r.correction?.amountMinor ?? 0),
          0,
        );
        if (refunded + dto.baseMinor > charge.baseMinor)
          throw new ConflictException(
            'Refund exceeds the remaining merchandise amount',
          );
        const creditMinor =
          refunded + dto.baseMinor === charge.baseMinor
            ? charge.amountMinor - credited
            : commissionMinor(refunded + dto.baseMinor, charge.rateBps) -
              credited;
        const result = await tx.commissionRefund.create({
          data: {
            sellerId,
            chargeId: charge.id,
            actorId: actor.id,
            requestKey: dto.requestKey,
            baseMinor: dto.baseMinor,
            creditMinor,
            reference,
            reason: dto.reason,
          },
        });
        await this.notifications.forSeller(
          tx,
          sellerId,
          'COMMISSION_REVIEWED',
          result.id,
          'A merchandise refund commission credit was recorded',
        );
        return result;
      }, transactionOptions)
      .catch((error: unknown) => {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        )
          throw new ConflictException('Refund reference is already recorded');
        throw error;
      });
  }
  async correct(
    sellerId: string,
    identity: DecodedIdToken,
    dto: CommissionCorrectionDto,
  ) {
    const actor = await this.auth.getOrCreateProfile(identity);
    return this.prisma
      .$transaction(async (tx) => {
        await this.lockSeller(tx, sellerId);
        const reference = normalizedReference(dto.reference);
        const previous = await tx.commissionCorrection.findUnique({
          where: { requestKey: dto.requestKey },
        });
        if (previous) {
          if (
            previous.sellerId !== sellerId ||
            previous.reference !== reference ||
            previous.reason !== dto.reason ||
            (dto.kind === 'PAYMENT'
              ? previous.paymentId
              : previous.refundId) !== dto.targetId
          )
            throw new ConflictException(
              'Correction request key was already used',
            );
          return previous;
        }
        let amountMinor = 0,
          baseMinor = 0;
        if (dto.kind === 'PAYMENT') {
          const payment = await tx.commissionPayment.findFirst({
            where: { id: dto.targetId, sellerId },
            include: { correction: true },
          });
          if (!payment) throw new NotFoundException('Payment not found');
          if (payment.status !== 'APPROVED' || payment.correction)
            throw new ConflictException(
              'Only an uncorrected confirmed payment can be reversed',
            );
          amountMinor = payment.amountMinor;
        } else {
          const refund = await tx.commissionRefund.findFirst({
            where: { id: dto.targetId, sellerId },
            include: {
              correction: true,
              charge: {
                include: { refunds: { include: { correction: true } } },
              },
            },
          });
          if (!refund) throw new NotFoundException('Refund credit not found');
          if (refund.correction)
            throw new ConflictException('Refund credit was already corrected');
          const base = refund.charge.refunds.reduce(
            (s, r) => s + r.baseMinor - (r.correction?.baseMinor ?? 0),
            0,
          );
          const credits = refund.charge.refunds.reduce(
            (s, r) => s + r.creditMinor - (r.correction?.amountMinor ?? 0),
            0,
          );
          baseMinor = refund.baseMinor;
          amountMinor =
            credits - commissionMinor(base - baseMinor, refund.charge.rateBps);
        }
        const result = await tx.commissionCorrection.create({
          data: {
            sellerId,
            actorId: actor.id,
            requestKey: dto.requestKey,
            reference,
            reason: dto.reason,
            amountMinor,
            baseMinor,
            ...(dto.kind === 'PAYMENT'
              ? { paymentId: dto.targetId }
              : { refundId: dto.targetId }),
          },
        });
        await this.notifications.forSeller(
          tx,
          sellerId,
          'COMMISSION_REVIEWED',
          result.id,
          'An incorrect commission record was reversed with a recorded reason. Review your statement',
        );
        return result;
      }, transactionOptions)
      .catch((error: unknown) => {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        )
          throw new ConflictException(
            'This record or correction reference has already been used',
          );
        throw error;
      });
  }
  async remind(sellerId: string, identity: DecodedIdToken) {
    const actor = await this.auth.getOrCreateProfile(identity);
    return this.prisma.$transaction(async (tx) => {
      await this.lockSeller(tx, sellerId);
      const balance = await this.balance(tx, sellerId);
      const amount = number(balance.overdueMinor);
      if (!amount)
        throw new ConflictException('This shop has no overdue commission');
      const day = new Date().toLocaleDateString('en-CA', {
        timeZone: 'Asia/Colombo',
      });
      const exists = await tx.commissionReminder.findUnique({
        where: { sellerId_day: { sellerId, day } },
      });
      if (exists)
        return { sent: false, message: 'A reminder was already sent today' };
      const reminder = await tx.commissionReminder.create({
        data: { sellerId, actorId: actor.id, day, amountMinor: amount },
      });
      await this.notifications.forSeller(
        tx,
        sellerId,
        'COMMISSION_REMINDER',
        reminder.id,
        `Your shop has overdue commission of Rs. ${(amount / 100).toFixed(2)}. Open Commissions to review your statement`,
      );
      return { sent: true };
    }, transactionOptions);
  }
  async statement(
    sellerId: string,
    query: CommissionQueryDto,
    identity?: DecodedIdToken,
  ) {
    if (identity) await this.member(sellerId, identity);
    const month =
      query.month ??
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Colombo',
        year: 'numeric',
        month: '2-digit',
      }).format(new Date());
    // Sri Lanka monthly boundaries, including the local date on every entry.
    const [year, m] = month.split('-').map(Number);
    const from = new Date(Date.UTC(year, m - 1, 1) - 19800000),
      to = new Date(Date.UTC(year, m, 1) - 19800000);
    const ledger = Prisma.sql`WITH entries AS (
      SELECT id, 'CHARGE'::text AS kind, "sellerOrderId"::text AS reference, "amountMinor"::bigint AS "amountMinor", "createdAt", "dueAt", NULL::text AS note FROM "CommissionCharge" WHERE "sellerId"=${sellerId}::uuid
      UNION ALL SELECT id,'REFUND_CREDIT',reference,-"creditMinor"::bigint,"createdAt",NULL,reason FROM "CommissionRefund" WHERE "sellerId"=${sellerId}::uuid
      UNION ALL SELECT id,'PAYMENT',reference,-"amountMinor"::bigint,"reviewedAt",NULL,"reviewNote" FROM "CommissionPayment" WHERE "sellerId"=${sellerId}::uuid AND status='APPROVED'
      UNION ALL SELECT id,'ADJUSTMENT',reference,"amountMinor"::bigint,"createdAt",NULL,reason FROM "CommissionCorrection" WHERE "sellerId"=${sellerId}::uuid
    )`;
    return this.prisma.$transaction(
      async (tx) => {
        const [summary] = await tx.$queryRaw<
          Record<string, unknown>[]
        >(Prisma.sql`${ledger} SELECT
        COALESCE(SUM("amountMinor") FILTER (WHERE "createdAt"<${from}),0)::bigint AS "openingMinor",
        COALESCE(SUM("amountMinor") FILTER (WHERE "createdAt"<${to}),0)::bigint AS "closingMinor",
        COUNT(*) FILTER (WHERE "createdAt">=${from} AND "createdAt"<${to}) AS total FROM entries`);
        const rows = await tx.$queryRaw<Record<string, unknown>[]>(
          Prisma.sql`${ledger} SELECT * FROM entries WHERE "createdAt">=${from} AND "createdAt"<${to} ORDER BY "createdAt",id LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`,
        );
        return {
          ...page(rows.map(plain), number(summary.total), query),
          ...plain(summary),
          openingMinor: number(summary.openingMinor),
          closingMinor: number(summary.closingMinor),
          month,
          generatedAt: new Date(),
          currency: 'LKR',
        };
      },
      {
        ...transactionOptions,
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );
  }
  async exportStatement(
    sellerId: string,
    query: CommissionQueryDto,
    identity?: DecodedIdToken,
  ) {
    const statement = await this.statement(
      sellerId,
      { ...query, page: 1, limit: 5000 },
      identity,
    );
    if (statement.total > 5000)
      throw new BadRequestException(
        'This month exceeds the 5,000-entry export limit. Contact HelaCart for a larger account export',
      );
    const cell = (value: unknown) => {
      let text = String(value ?? '');
      if (typeof value === 'string' && /^[\s]*[=+\-@\t\r]/.test(text))
        text = "'" + text;
      return '"' + text.replaceAll('"', '""') + '"';
    };
    const rows: unknown[][] = [
      ['HelaCart commission account statement', statement.month, 'LKR'],
      ['Shop ID', sellerId],
      ['Generated at', statement.generatedAt.toISOString()],
      ['Opening balance (LKR)', number(statement.openingMinor) / 100],
      ['Closing balance (LKR)', number(statement.closingMinor) / 100],
      [
        'Recorded at',
        'Entry',
        'Reference',
        'Commission amount (LKR)',
        'Due at',
        'Note',
      ],
      ...statement.items.map((row) => [
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : row.createdAt,
        row.kind,
        row.reference,
        number(row.amountMinor) / 100,
        row.dueAt instanceof Date ? row.dueAt.toISOString() : row.dueAt,
        row.note,
      ]),
    ];
    return Buffer.from(
      '\ufeff' + rows.map((row) => row.map(cell).join(',')).join('\r\n'),
      'utf8',
    );
  }
}
