import { Prisma } from '../generated/prisma/client.js';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import { FavoriteAlertDto } from './discovery.dto.js';
import { activeOffers, discountedMinor } from './pricing.js';
@Injectable()
export class FavoriteAlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}
  async settings(id: string, identity: DecodedIdToken, dto: FavoriteAlertDto) {
    if (!identity.email_verified)
      throw new ForbiddenException(
        'Verify your email to enable favorite alerts',
      );
    const user = await this.auth.getOrCreateProfile(identity);
    return this.prisma.$transaction(
      async (tx) => {
        const favorite = await tx.productFavorite.findFirst({
          where: { id, userId: user.id },
          include: {
            product: {
              include: {
                variants: true,
                seller: { select: { status: true } },
                category: { select: { isActive: true } },
              },
            },
          },
        });
        if (!favorite) throw new NotFoundException('Favorite not found');
        const p = favorite.product,
          visible =
            p?.status === 'APPROVED' &&
            p.seller.status === 'APPROVED' &&
            p.category.isActive;
        const offer = p ? (await activeOffers(tx, [p.id])).get(p.id) : null;
        const choices = p?.variants.filter((v) => v.onHand > v.reserved) ?? [];
        const price = choices.length
          ? Math.min(
              ...choices.map((v) =>
                offer
                  ? discountedMinor(v.priceLkrMinor, offer.discountBps)
                  : v.priceLkrMinor,
              ),
            )
          : null;
        const updated = await tx.productFavorite.updateMany({
          where: { id, userId: user.id, alertVersion: dto.version },
          data: {
            priceAlerts: dto.priceAlerts,
            restockAlerts: dto.restockAlerts,
            alertVersion: { increment: 1 },
            observedAvailable: visible ? choices.length > 0 : null,
            observedPriceMinor: visible ? price : null,
            lowestNotifiedMinor: visible ? price : null,
            nextCheckAt: new Date(Date.now() + 60000),
          },
        });
        if (!updated.count)
          throw new ConflictException(
            'Favorite alert settings changed. Refresh before saving',
          );
        return { saved: true };
      },
      { timeout: 30000, maxWait: 10000 },
    );
  }
  async processDue(limit = 100) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 500)
      throw Error('Invalid favorite alert batch size');
    return this.prisma.$transaction(
      async (tx) => {
        const ids = await tx.$queryRaw<
          { id: string }[]
        >`SELECT f.id FROM "ProductFavorite" f JOIN "User" u ON u.id=f."userId" WHERE (f."priceAlerts" OR f."restockAlerts") AND f."nextCheckAt"<=NOW() AND u."accessStatus"='ACTIVE' AND u."emailVerified" ORDER BY f."nextCheckAt",f.id LIMIT ${limit} FOR UPDATE OF f SKIP LOCKED`;
        const favorites = await tx.productFavorite.findMany({
          where: { id: { in: ids.map((r) => r.id) } },
          include: {
            product: {
              include: {
                variants: true,
                seller: { select: { status: true } },
                category: { select: { isActive: true } },
              },
            },
          },
        });
        const offers = await activeOffers(
          tx,
          favorites.flatMap((f) => (f.productId ? [f.productId] : [])),
        );
        let notifications = 0;
        const updates: {
          id: string;
          available: boolean | null;
          price: number | null;
          lowest: number | null;
        }[] = [];
        const messages: Prisma.NotificationCreateManyInput[] = [];
        for (const f of favorites) {
          const p = f.product,
            visible =
              p?.status === 'APPROVED' &&
              p.seller.status === 'APPROVED' &&
              p.category.isActive;
          if (!visible) {
            updates.push({
              id: f.id,
              available: f.observedAvailable,
              price: f.observedPriceMinor,
              lowest: f.lowestNotifiedMinor,
            });
            continue;
          }
          const choices = p!.variants.filter((v) => v.onHand > v.reserved),
            offer = offers.get(p!.id),
            available = choices.length > 0;
          const price = available
            ? Math.min(
                ...choices.map((v) =>
                  offer
                    ? discountedMinor(v.priceLkrMinor, offer.discountBps)
                    : v.priceLkrMinor,
                ),
              )
            : null;
          const drop =
            f.priceAlerts &&
            price !== null &&
            f.lowestNotifiedMinor !== null &&
            price < f.lowestNotifiedMinor;
          const restock =
            f.restockAlerts && f.observedAvailable === false && available;
          if (drop)
            messages.push({
              userId: f.userId,
              type: 'FAVORITE_PRICE_DROP',
              subjectId: p!.id,
              message: 'Price dropped for ' + p!.title.slice(0, 120),
              href: '/products/' + p!.id,
            });
          if (restock)
            messages.push({
              userId: f.userId,
              type: 'FAVORITE_RESTOCK',
              subjectId: p!.id,
              message: 'Back in stock: ' + p!.title.slice(0, 120),
              href: '/products/' + p!.id,
            });
          updates.push({
            id: f.id,
            available,
            price,
            lowest: drop ? price : (f.lowestNotifiedMinor ?? price),
          });
        }
        if (updates.length)
          await tx.$executeRaw(
            Prisma.sql`UPDATE "ProductFavorite" f SET "observedAvailable"=x.available,"observedPriceMinor"=x.price,"lowestNotifiedMinor"=x.lowest,"nextCheckAt"=NOW()+INTERVAL '1 minute' FROM (VALUES ${Prisma.join(updates.map((r) => Prisma.sql`(${r.id}::uuid,${r.available}::boolean,${r.price}::integer,${r.lowest}::integer)`))}) x(id,available,price,lowest) WHERE f.id=x.id`,
          );
        if (messages.length)
          await tx.notification.createMany({ data: messages });
        notifications = messages.length;
        return { processed: ids.length, notifications };
      },
      { timeout: 45000, maxWait: 10000 },
    );
  }
}
