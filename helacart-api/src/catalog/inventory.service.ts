import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import {
  Prisma,
  ProductStatus,
  SellerStatus,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CatalogService } from './catalog.service.js';
import {
  AdjustStockDto,
  CreateVariantDto,
  UpdateVariantDto,
} from './dto/inventory.dto.js';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  async createVariant(
    sellerId: string,
    productId: string,
    identity: DecodedIdToken,
    dto: CreateVariantDto,
  ) {
    await this.catalog.requireSellerMember(sellerId, identity, true);
    const options = this.validateOptions(dto.optionValues);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.moveToDraft(tx, sellerId, productId);
        return tx.productVariant.create({
          data: {
            productId,
            sellerId,
            position: dto.position,
            sku: dto.sku,
            optionValues: options,
            priceLkrMinor: dto.priceLkrMinor,
          },
        });
      });
    } catch (error) {
      this.uniqueError(error);
    }
  }

  async updateVariant(
    sellerId: string,
    productId: string,
    variantId: string,
    identity: DecodedIdToken,
    dto: UpdateVariantDto,
  ) {
    await this.catalog.requireSellerMember(sellerId, identity, true);
    if (!Object.keys(dto).length)
      throw new BadRequestException('Supply at least one variant field');
    const options =
      dto.optionValues === undefined
        ? undefined
        : this.validateOptions(dto.optionValues);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const variant = await tx.productVariant.findFirst({
          where: { id: variantId, productId, sellerId },
        });
        if (!variant) throw new NotFoundException('Variant not found');
        if (variant.position === 0)
          throw new ConflictException(
            'Edit default SKU and price on the product',
          );
        await this.moveToDraft(tx, sellerId, productId);
        return tx.productVariant.update({
          where: { id: variantId },
          data: {
            sku: dto.sku,
            priceLkrMinor: dto.priceLkrMinor,
            optionValues: options,
          },
        });
      });
    } catch (error) {
      this.uniqueError(error);
    }
  }

  async adjustStock(
    sellerId: string,
    productId: string,
    variantId: string,
    identity: DecodedIdToken,
    dto: AdjustStockDto,
  ) {
    const actor = await this.catalog.requireSellerMember(
      sellerId,
      identity,
      true,
    );
    if (dto.delta === 0)
      throw new BadRequestException('Stock delta must not be zero');
    return this.prisma.$transaction(async (tx) => {
      // Conditional UPDATE takes a row lock. Concurrent reservations and adjustments
      // cannot drive available stock below zero.
      const rows = await tx.$queryRaw<
        Array<{ id: string; onHand: number; reserved: number }>
      >`
        UPDATE "ProductVariant" AS v
        SET "onHand" = v."onHand" + ${dto.delta}, "updatedAt" = NOW()
        WHERE v."id" = ${variantId}::uuid AND v."productId" = ${productId}::uuid
          AND v."sellerId" = ${sellerId}::uuid
          AND v."onHand" + ${dto.delta} >= v."reserved"
          AND v."onHand" + ${dto.delta} >= 0
          AND v."onHand" + ${dto.delta} <= 1000000000
          AND EXISTS (SELECT 1 FROM "Seller" s WHERE s."id" = v."sellerId" AND s."status" = 'APPROVED')
        RETURNING v."id", v."onHand", v."reserved"`;
      if (!rows.length) {
        const variant = await tx.productVariant.findFirst({
          where: { id: variantId, productId, sellerId },
          select: { id: true },
        });
        if (!variant) throw new NotFoundException('Variant not found');
        throw new ConflictException(
          'Stock adjustment exceeds unreserved quantity or seller is inactive',
        );
      }
      await tx.inventoryMovement.create({
        data: {
          variantId,
          actorUserId: actor.id,
          delta: dto.delta,
          reason: dto.reason,
        },
      });
      return {
        ...rows[0],
        availableQuantity: rows[0].onHand - rows[0].reserved,
      };
    });
  }

  async movements(
    sellerId: string,
    productId: string,
    variantId: string,
    identity: DecodedIdToken,
  ) {
    await this.catalog.requireSellerMember(sellerId, identity, false);
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId, sellerId },
      select: { id: true },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    return this.prisma.inventoryMovement.findMany({
      where: { variantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        delta: true,
        reason: true,
        actorUserId: true,
        createdAt: true,
      },
    });
  }

  private async moveToDraft(
    tx: Prisma.TransactionClient,
    sellerId: string,
    productId: string,
  ) {
    const updated = await tx.product.updateMany({
      where: {
        id: productId,
        sellerId,
        seller: { status: SellerStatus.APPROVED },
        status: {
          in: [
            ProductStatus.DRAFT,
            ProductStatus.REJECTED,
            ProductStatus.APPROVED,
            ProductStatus.HIDDEN,
          ],
        },
      },
      data: { status: ProductStatus.DRAFT },
    });
    if (updated.count) return;
    const product = await tx.product.findFirst({
      where: { id: productId, sellerId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    throw new ConflictException('Product cannot change in its current state');
  }

  private validateOptions(options: Record<string, unknown>): Prisma.JsonObject {
    const entries = Object.entries(options);
    if (
      !entries.length ||
      entries.length > 5 ||
      entries.some(
        ([key, value]) =>
          !/^[a-zA-Z][a-zA-Z0-9]{0,39}$/.test(key) ||
          typeof value !== 'string' ||
          value.trim().length < 1 ||
          value.length > 80,
      )
    ) {
      throw new BadRequestException(
        'Provide 1 to 5 named options with string values (for example size and color)',
      );
    }
    return options as Prisma.JsonObject;
  }

  private uniqueError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      throw new ConflictException('Variant SKU or position already exists');
    throw error;
  }
}
