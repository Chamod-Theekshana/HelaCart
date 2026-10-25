import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryReservationStatus,
  Prisma,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

// Internal checkout primitive. Do not expose a public reservation endpoint until
// orders have buyer ownership, payment reconciliation and rate limiting.
@Injectable()
export class ReservationService {
  constructor(private readonly prisma: PrismaService) {}

  async reserve(variantId: string, quantity: number, requestKey: string) {
    if (
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > 100 ||
      !/^[a-zA-Z0-9:_-]{8,120}$/.test(requestKey)
    )
      throw new BadRequestException(
        'Invalid reservation quantity or request key',
      );
    await this.expireDue(100);
    const existing = await this.prisma.inventoryReservation.findUnique({
      where: { requestKey },
    });
    if (existing) return this.existing(existing, variantId, quantity);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<Array<{ id: string }>>`
          UPDATE "ProductVariant" AS v SET "reserved" = v."reserved" + ${quantity}, "updatedAt" = NOW()
          FROM "Product" p, "Seller" s, "Category" c
          WHERE v."id" = ${variantId}::uuid AND v."productId" = p."id"
            AND v."sellerId" = s."id" AND p."categoryId" = c."id"
            AND p."sellerId" = s."id" AND p."status" = 'APPROVED'
            AND s."status" = 'APPROVED' AND c."isActive" = TRUE
            AND v."onHand" - v."reserved" >= ${quantity}
          RETURNING v."id"`;
        if (!rows.length)
          throw new ConflictException(
            'Variant unavailable or insufficient stock',
          );
        return tx.inventoryReservation.create({
          data: {
            requestKey,
            variantId,
            quantity,
            expiresAt: new Date(Date.now() + 15 * 60_000),
          },
        });
      });
    } catch (error) {
      if (
        error instanceof ConflictException ||
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002')
      ) {
        const saved = await this.prisma.inventoryReservation.findUnique({
          where: { requestKey },
        });
        if (saved) return this.existing(saved, variantId, quantity);
      }
      throw error;
    }
  }

  async release(reservationId: string) {
    return this.finish(reservationId, InventoryReservationStatus.RELEASED);
  }

  async commit(reservationId: string) {
    return this.finish(reservationId, InventoryReservationStatus.COMMITTED);
  }

  async expireDue(limit = 100) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new BadRequestException('Invalid batch size');
    const due = await this.prisma.inventoryReservation.findMany({
      where: {
        status: InventoryReservationStatus.ACTIVE,
        expiresAt: { lte: new Date() },
      },
      select: { id: true },
      take: limit,
      orderBy: { expiresAt: 'asc' },
    });
    for (const reservation of due) {
      try {
        await this.finish(reservation.id, InventoryReservationStatus.EXPIRED);
      } catch (error) {
        if (!(error instanceof ConflictException)) throw error;
        // Another worker may already have released or committed this reservation.
      }
    }
    return due.length;
  }

  private existing(
    existing: {
      variantId: string;
      quantity: number;
      status: InventoryReservationStatus;
    },
    variantId: string,
    quantity: number,
  ) {
    if (existing.variantId !== variantId || existing.quantity !== quantity)
      throw new ConflictException(
        'Request key was used for a different reservation',
      );
    return existing;
  }

  private async finish(id: string, status: InventoryReservationStatus) {
    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.inventoryReservation.findUnique({
        where: { id },
      });
      if (!reservation) throw new NotFoundException('Reservation not found');
      if (reservation.status === status) return reservation;
      if (reservation.status !== InventoryReservationStatus.ACTIVE)
        throw new ConflictException('Reservation already finalized');
      if (
        status === InventoryReservationStatus.COMMITTED &&
        reservation.expiresAt <= new Date()
      )
        throw new ConflictException('Reservation has expired');
      const updated = await tx.inventoryReservation.updateMany({
        where: { id, status: InventoryReservationStatus.ACTIVE },
        data: { status },
      });
      if (!updated.count)
        throw new ConflictException('Reservation already finalized');
      const quantity = reservation.quantity;
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        UPDATE "ProductVariant" SET "reserved" = "reserved" - ${quantity},
          "onHand" = "onHand" - ${status === InventoryReservationStatus.COMMITTED ? quantity : 0},
          "updatedAt" = NOW()
        WHERE "id" = ${reservation.variantId}::uuid AND "reserved" >= ${quantity}
        RETURNING "id"`;
      if (!rows.length)
        throw new ConflictException('Reservation stock is inconsistent');
      if (status === InventoryReservationStatus.COMMITTED)
        await tx.inventoryMovement.create({
          data: {
            variantId: reservation.variantId,
            delta: -quantity,
            reason: `Reservation ${reservation.id} committed`,
          },
        });
      return tx.inventoryReservation.findUniqueOrThrow({ where: { id } });
    });
  }
}
