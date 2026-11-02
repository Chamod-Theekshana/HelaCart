import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { Prisma, SellerStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { openSellerOrderStatuses } from '../commerce/order-state.js';
import {
  ListSellersDto,
  UpdateSellerStatusDto,
} from './dto/seller-status.dto.js';

const sellerRowSelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
  isVerified: true,
  createdAt: true,
  statusReason: true,
  statusChangedAt: true,
  _count: {
    select: {
      products: true,
      sellerOrders: { where: { status: { in: [...openSellerOrderStatuses] } } },
    },
  },
} satisfies Prisma.SellerSelect;

type SellerRow = Prisma.SellerGetPayload<{ select: typeof sellerRowSelect }>;

function present({ _count, ...row }: SellerRow) {
  return {
    ...row,
    productCount: _count.products,
    openOrderCount: _count.sellerOrders,
  };
}

/** Admin shop list and suspension (contract §5). */
@Injectable()
export class SellerStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(query: ListSellersDto) {
    const limit = query.limit ?? 20;
    const where: Prisma.SellerWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { slug: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const rows = await this.prisma.seller.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: limit + 1,
      select: sellerRowSelect,
    });
    return {
      items: rows.slice(0, limit).map(present),
      nextCursor: rows.length > limit ? rows[limit - 1].id : null,
    };
  }

  async update(
    sellerId: string,
    identity: DecodedIdToken,
    dto: UpdateSellerStatusDto,
  ) {
    const admin = await this.audit.actor(identity);
    const from =
      dto.status === SellerStatus.SUSPENDED
        ? SellerStatus.APPROVED
        : SellerStatus.SUSPENDED;
    return this.prisma.$transaction(
      async (tx) => {
        const changed = await tx.seller.updateMany({
          where: { id: sellerId, status: from },
          data: {
            status: dto.status,
            statusReason: dto.reason,
            statusChangedAt: new Date(),
          },
        });
        if (!changed.count) {
          const seller = await tx.seller.findUnique({
            where: { id: sellerId },
            select: { status: true },
          });
          if (!seller) throw new NotFoundException('Shop not found');
          throw new ConflictException(
            'Only approved shops can be suspended and only suspended shops reinstated',
          );
        }
        await this.audit.record(tx, admin, {
          action:
            dto.status === SellerStatus.SUSPENDED
              ? 'SELLER_SUSPEND'
              : 'SELLER_REINSTATE',
          subjectType: 'SELLER',
          subjectId: sellerId,
          reason: dto.reason,
          details: { from, to: dto.status },
        });
        await this.notifications.forSeller(
          tx,
          sellerId,
          'SELLER_STATUS_CHANGED',
          sellerId,
          dto.status === SellerStatus.SUSPENDED
            ? `Your shop was suspended: ${dto.reason}`
            : 'Your shop was reinstated and can sell again',
          '/seller',
        );
        return present(
          await tx.seller.findUniqueOrThrow({
            where: { id: sellerId },
            select: sellerRowSelect,
          }),
        );
      },
      { timeout: 15_000, maxWait: 10_000 },
    );
  }
}
