import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { ConfigService } from '@nestjs/config';
import {
  CodReconciliationDecision,
  NotificationType,
  Prisma,
  ReturnStatus,
  SellerOrderStatus,
} from '../generated/prisma/client.js';
import { AuthService } from '../auth/auth.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ListReturnsDto,
  PageDto,
  ReconcileCodDto,
  RequestReturnDto,
} from './operations.dto.js';

@Injectable()
export class OperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  async requestReturn(identity: DecodedIdToken, dto: RequestReturnDto) {
    if (!identity.email_verified)
      throw new ForbiddenException(
        'Verify your email before requesting a return',
      );
    const buyer = await this.auth.getOrCreateProfile(identity);
    const cutoff = new Date(
      Date.now() -
        this.config.getOrThrow<number>('RETURN_WINDOW_DAYS') * 86_400_000,
    );
    try {
      return await this.prisma.$transaction(async (tx) => {
        const order = await tx.sellerOrder.findFirst({
          where: {
            id: dto.sellerOrderId,
            status: SellerOrderStatus.DELIVERED,
            events: {
              some: {
                toStatus: SellerOrderStatus.DELIVERED,
                createdAt: { gte: cutoff },
              },
            },
            order: { buyerId: buyer.id },
          },
          select: { id: true, sellerId: true },
        });
        if (!order)
          throw new NotFoundException(
            'Eligible delivered seller order not found within return window',
          );
        const created = await tx.returnRequest.create({
          data: {
            sellerOrderId: order.id,
            buyerId: buyer.id,
            reason: dto.reason,
          },
        });
        await this.notifications.forSeller(
          tx,
          order.sellerId,
          NotificationType.RETURN_REQUESTED,
          created.id,
          'A buyer requested a return',
        );
        return created;
      });
    } catch (error) {
      this.unique(
        error,
        'A return request already exists for this seller order',
      );
    }
  }

  async myReturns(identity: DecodedIdToken) {
    const buyer = await this.auth.getOrCreateProfile(identity);
    return this.prisma.returnRequest.findMany({
      where: { buyerId: buyer.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        sellerOrder: { select: { id: true, sellerId: true, orderId: true } },
      },
    });
  }

  returns(status: ReturnStatus = ReturnStatus.PENDING) {
    return this.prisma.returnRequest.findMany({
      where: { status },
      orderBy: { createdAt: 'asc' },
      take: 50,
      include: { sellerOrder: { include: { items: true } } },
    });
  }

  async returnsPage(query: ListReturnsDto) {
    const limit = query.limit ?? 20;
    const rows = await this.prisma.returnRequest.findMany({
      where: { status: query.status ?? ReturnStatus.PENDING },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: limit + 1,
      include: { sellerOrder: { include: { items: true } } },
    });
    return {
      items: rows.slice(0, limit),
      nextCursor: rows.length > limit ? rows[limit - 1].id : null,
    };
  }

  async reviewReturn(
    returnId: string,
    reviewer: DecodedIdToken,
    decision: 'APPROVED' | 'REJECTED',
    reason?: string,
  ) {
    if (decision === ReturnStatus.REJECTED && !reason)
      throw new BadRequestException('Rejection requires a reason');
    const admin = await this.auth.getOrCreateProfile(reviewer);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.returnRequest.updateMany({
        where: { id: returnId, status: ReturnStatus.PENDING },
        data: {
          status: decision,
          reviewReason: reason,
          reviewerUserId: admin.id,
          reviewedAt: new Date(),
        },
      });
      if (!updated.count)
        throw new ConflictException('Return request is not pending');
      const result = await tx.returnRequest.findUniqueOrThrow({
        where: { id: returnId },
        include: { sellerOrder: { select: { sellerId: true } } },
      });
      await this.notifications.forUser(
        tx,
        result.buyerId,
        NotificationType.RETURN_REVIEWED,
        result.id,
        `Your return request was ${decision.toLowerCase()}`,
      );
      await this.notifications.forSeller(
        tx,
        result.sellerOrder.sellerId,
        NotificationType.RETURN_REVIEWED,
        result.id,
        `Return request was ${decision.toLowerCase()}`,
      );
      return result;
    });
  }

  async resolveReturn(
    returnId: string,
    reviewer: DecodedIdToken,
    note: string,
  ) {
    if (!note || note.trim().length < 10)
      throw new BadRequestException('Provide a resolution note');
    const admin = await this.auth.getOrCreateProfile(reviewer);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.returnRequest.updateMany({
        where: { id: returnId, status: ReturnStatus.APPROVED },
        data: {
          status: ReturnStatus.RESOLVED,
          resolvedAt: new Date(),
          resolutionNote: note.trim(),
          resolverUserId: admin.id,
        },
      });
      if (!updated.count)
        throw new ConflictException('Approved return request required');
      const result = await tx.returnRequest.findUniqueOrThrow({
        where: { id: returnId },
      });
      await this.notifications.forUser(
        tx,
        result.buyerId,
        NotificationType.RETURN_REVIEWED,
        result.id,
        'Your return case was resolved',
      );
      return result;
    });
  }

  async codQueue() {
    return this.prisma.sellerOrder.findMany({
      where: {
        status: SellerOrderStatus.DELIVERED,
        paymentCollectedAt: { not: null },
        codReconciliations: {
          none: { decision: CodReconciliationDecision.RECONCILED },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
      select: {
        id: true,
        sellerId: true,
        totalLkrMinor: true,
        paymentCollectedAt: true,
        codReconciliations: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  async codQueuePage(query: PageDto) {
    const limit = query.limit ?? 20;
    const rows = await this.prisma.sellerOrder.findMany({
      where: {
        status: SellerOrderStatus.DELIVERED,
        paymentCollectedAt: { not: null },
        codReconciliations: {
          none: { decision: CodReconciliationDecision.RECONCILED },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: limit + 1,
      select: {
        id: true,
        sellerId: true,
        totalLkrMinor: true,
        paymentCollectedAt: true,
        codReconciliations: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    return {
      items: rows.slice(0, limit),
      nextCursor: rows.length > limit ? rows[limit - 1].id : null,
    };
  }

  async reconcileCod(
    sellerOrderId: string,
    reviewer: DecodedIdToken,
    dto: ReconcileCodDto,
  ) {
    const admin = await this.auth.getOrCreateProfile(reviewer);
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Lock the seller order so two administrators cannot reconcile it at once.
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "SellerOrder" WHERE "id" = ${sellerOrderId}::uuid FOR UPDATE`;
        if (!locked.length)
          throw new NotFoundException('Seller order not found');
        const order = await tx.sellerOrder.findUniqueOrThrow({
          where: { id: sellerOrderId },
          include: {
            codReconciliations: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        });
        if (
          order.status !== SellerOrderStatus.DELIVERED ||
          !order.paymentCollectedAt
        )
          throw new ConflictException(
            'COD collection has not been marked as delivered',
          );
        if (
          order.codReconciliations[0]?.decision ===
          CodReconciliationDecision.RECONCILED
        )
          throw new ConflictException('COD is already reconciled');
        const decision =
          dto.amountReceivedMinor === order.totalLkrMinor
            ? CodReconciliationDecision.RECONCILED
            : CodReconciliationDecision.DISPUTED;
        if (decision === CodReconciliationDecision.DISPUTED && !dto.note)
          throw new BadRequestException('Explain the COD amount difference');
        const result = await tx.codReconciliation.create({
          data: {
            sellerOrderId,
            reviewerUserId: admin.id,
            decision,
            amountReceivedMinor: dto.amountReceivedMinor,
            reference: dto.reference,
            note: dto.note,
          },
        });
        await this.notifications.forSeller(
          tx,
          order.sellerId,
          NotificationType.COD_RECONCILED,
          order.id,
          decision === CodReconciliationDecision.RECONCILED
            ? 'COD collection was reconciled'
            : 'COD collection needs review',
        );
        return result;
      });
    } catch (error) {
      this.unique(
        error,
        'This COD reference is already recorded for the order',
      );
    }
  }

  private unique(error: unknown, message: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      throw new ConflictException(message);
    throw error;
  }
}
