import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  CreatePromotionDto,
  PromotionDecisionDto,
  PromotionListDto,
} from './discovery.dto.js';
const select = {
  id: true,
  productId: true,
  name: true,
  discountBps: true,
  startsAt: true,
  endsAt: true,
  status: true,
  version: true,
  createdAt: true,
  product: { select: { id: true, title: true, sku: true } },
  seller: { select: { name: true } },
  events: {
    orderBy: { version: 'desc' as const },
    take: 10,
    select: { version: true, status: true, reason: true, createdAt: true },
  },
} as const;
@Injectable()
export class PromotionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly catalog: CatalogService,
    private readonly notices: NotificationsService,
    private readonly config: ConfigService,
  ) {}
  private async actor(
    identity: DecodedIdToken,
    sellerId?: string,
    write = false,
  ) {
    if (sellerId)
      return this.catalog.requireSellerMember(sellerId, identity, write);
    if (
      !identity.email_verified ||
      !this.config
        .getOrThrow<string[]>('ADMIN_FIREBASE_UIDS')
        .includes(identity.uid)
    )
      throw new ForbiddenException('Administrator access required');
    return this.auth.getOrCreateProfile(identity);
  }
  async list(
    identity: DecodedIdToken,
    sellerId: string | undefined,
    q: PromotionListDto,
  ) {
    await this.actor(identity, sellerId);
    const where = {
      ...(sellerId ? { sellerId } : {}),
      ...(q.status !== 'ALL' ? { status: q.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.promotion.findMany({
        where,
        select,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.promotion.count({ where }),
    ]);
    return {
      items,
      total,
      page: q.page,
      pageSize: q.limit,
      pages: Math.max(1, Math.ceil(total / q.limit)),
    };
  }
  async create(
    sellerId: string,
    identity: DecodedIdToken,
    dto: CreatePromotionDto,
  ) {
    const actor = await this.actor(identity, sellerId, true),
      startsAt = new Date(dto.startsAt),
      endsAt = new Date(dto.endsAt);
    if (
      !/[TZ+-]/.test(dto.startsAt.slice(10)) ||
      !/(Z|[+-]\d{2}:\d{2})$/.test(dto.startsAt) ||
      !/(Z|[+-]\d{2}:\d{2})$/.test(dto.endsAt) ||
      !Number.isFinite(startsAt.getTime()) ||
      !Number.isFinite(endsAt.getTime()) ||
      endsAt <= startsAt ||
      endsAt.getTime() - startsAt.getTime() > 90 * 86400000 ||
      endsAt.getTime() <= Date.now() ||
      startsAt.getTime() > Date.now() + 366 * 86400000
    )
      throw new BadRequestException(
        'Use timezone-qualified start/end dates, lasting up to 90 days, starting within one year and ending in the future',
      );
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id=${actor.id}::uuid FOR UPDATE`;
        const existing = await tx.promotion.findUnique({
          where: {
            submitterId_requestKey: {
              submitterId: actor.id,
              requestKey: dto.requestKey,
            },
          },
          select: { ...select, sellerId: true },
        });
        if (existing) {
          if (
            existing.sellerId !== sellerId ||
            existing.productId !== dto.productId ||
            existing.name !== dto.name ||
            existing.discountBps !== dto.discountBps ||
            existing.startsAt.getTime() !== startsAt.getTime() ||
            existing.endsAt.getTime() !== endsAt.getTime()
          )
            throw new ConflictException(
              'This request key belongs to a different promotion',
            );
          const { sellerId: _scope, ...result } = existing;
          return result;
        }
        const product = await tx.product.findFirst({
          where: {
            id: dto.productId,
            sellerId,
            status: 'APPROVED',
            seller: { status: 'APPROVED' },
            category: { isActive: true },
          },
          select: { id: true },
        });
        if (!product)
          throw new BadRequestException(
            'Choose an approved product in your shop',
          );
        if (
          (await tx.promotion.count({
            where: {
              sellerId,
              endsAt: { gt: new Date() },
              status: { in: ['PENDING', 'APPROVED'] },
            },
          })) >= 100
        )
          throw new BadRequestException(
            'Manage existing promotions before creating more; a shop can have 100 pending or scheduled offers',
          );
        const promotion = await tx.promotion.create({
          data: {
            sellerId,
            productId: dto.productId,
            submitterId: actor.id,
            requestKey: dto.requestKey,
            name: dto.name,
            discountBps: dto.discountBps,
            startsAt,
            endsAt,
          },
          select,
        });
        await this.notices.forAdmins(
          tx,
          'PROMOTION_UPDATED',
          promotion.id,
          'A product promotion needs approval',
          '/admin/promotions',
        );
        return promotion;
      },
      { timeout: 30000, maxWait: 10000 },
    );
  }
  async decide(
    id: string,
    identity: DecodedIdToken,
    sellerId: string | undefined,
    dto: PromotionDecisionDto,
  ) {
    const actor = await this.actor(identity, sellerId);
    if (sellerId && dto.status !== 'CANCELLED')
      throw new ForbiddenException(
        'Only administrators approve or reject promotions',
      );
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Promotion" WHERE id=${id}::uuid FOR UPDATE`;
        const current = await tx.promotion.findFirst({
          where: { id, ...(sellerId ? { sellerId } : {}) },
          include: {
            product: {
              select: {
                status: true,
                category: { select: { isActive: true } },
              },
            },
            seller: { select: { status: true } },
          },
        });
        if (!current) throw new NotFoundException('Promotion not found');
        if (
          current.version !== dto.version ||
          !['PENDING', 'APPROVED'].includes(current.status) ||
          (dto.status !== 'CANCELLED' && current.status !== 'PENDING')
        )
          throw new ConflictException(
            'Promotion changed or was already decided. Refresh before continuing',
          );
        if (
          dto.status === 'APPROVED' &&
          (current.endsAt <= new Date() ||
            current.product.status !== 'APPROVED' ||
            !current.product.category.isActive ||
            current.seller.status !== 'APPROVED')
        )
          throw new ConflictException(
            'Promotion expired or its product, category or shop is unavailable',
          );
        const result = await tx.promotion.update({
          where: { id },
          data: { status: dto.status, version: { increment: 1 } },
          select,
        });
        await tx.promotionEvent.create({
          data: {
            promotionId: id,
            actorId: actor.id,
            version: dto.version + 1,
            status: dto.status,
            reason: dto.reason,
          },
        });
        await this.notices.forSeller(
          tx,
          current.sellerId,
          'PROMOTION_UPDATED',
          id,
          `Promotion ${dto.status.toLowerCase()}: ${current.name}`,
          '/seller/promotions',
        );
        return result;
      },
      { timeout: 30000, maxWait: 10000 },
    );
  }
}
