import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import {
  Prisma,
  ProductStatus,
  SellerOrderStatus,
  SellerStatus,
  NotificationType,
} from '../generated/prisma/client.js';
import { AuthService } from '../auth/auth.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  AddressDto,
  CheckoutDto,
  SellerOrderStatusDto,
} from './commerce.dto.js';

const orderDetail = {
  sellerOrders: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      seller: { select: { id: true, name: true, slug: true } },
      items: true,
      events: { orderBy: { createdAt: 'asc' as const } },
    },
  },
} as const;

type CartRow = Prisma.CartItemGetPayload<{
  include: {
    variant: {
      include: { product: { include: { seller: true; category: true } } };
    };
  };
}>;

@Injectable()
export class CommerceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly catalog: CatalogService,
    private readonly notifications: NotificationsService,
  ) {}

  private async buyer(identity: DecodedIdToken) {
    if (!identity.email_verified)
      throw new ForbiddenException('Verify your email before shopping');
    return this.auth.getOrCreateProfile(identity);
  }

  async addresses(identity: DecodedIdToken) {
    const user = await this.buyer(identity);
    return this.prisma.buyerAddress.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async addAddress(identity: DecodedIdToken, dto: AddressDto) {
    const user = await this.buyer(identity);
    if (
      (await this.prisma.buyerAddress.count({
        where: { userId: user.id, isActive: true },
      })) >= 20
    )
      throw new ConflictException('Too many saved addresses');
    return this.prisma.buyerAddress.create({
      data: { ...dto, userId: user.id },
    });
  }

  async removeAddress(identity: DecodedIdToken, addressId: string) {
    const user = await this.buyer(identity);
    const result = await this.prisma.buyerAddress.updateMany({
      where: { id: addressId, userId: user.id, isActive: true },
      data: { isActive: false },
    });
    if (!result.count) throw new NotFoundException('Address not found');
    return { deleted: true };
  }

  async setCartItem(
    identity: DecodedIdToken,
    variantId: string,
    quantity: number,
  ) {
    const user = await this.buyer(identity);
    const variant = await this.prisma.productVariant.findFirst({
      where: {
        id: variantId,
        product: {
          status: ProductStatus.APPROVED,
          category: { isActive: true },
          seller: { status: SellerStatus.APPROVED },
        },
      },
      select: { id: true, onHand: true, reserved: true },
    });
    if (!variant) throw new NotFoundException('Variant unavailable');
    if (variant.onHand - variant.reserved < quantity)
      throw new ConflictException('Insufficient available stock');
    const existing = await this.prisma.cartItem.findUnique({
      where: { userId_variantId: { userId: user.id, variantId } },
      select: { id: true },
    });
    if (
      !existing &&
      (await this.prisma.cartItem.count({ where: { userId: user.id } })) >= 50
    )
      throw new ConflictException('Cart has reached 50 items');
    return this.prisma.cartItem.upsert({
      where: { userId_variantId: { userId: user.id, variantId } },
      update: { quantity },
      create: { userId: user.id, variantId, quantity },
    });
  }

  async removeCartItem(identity: DecodedIdToken, variantId: string) {
    const user = await this.buyer(identity);
    await this.prisma.cartItem.deleteMany({
      where: { userId: user.id, variantId },
    });
    return { deleted: true };
  }

  async cart(identity: DecodedIdToken) {
    const user = await this.buyer(identity);
    const rows = await this.cartRows(this.prisma, user.id);
    const items = rows.map((item) => ({
      variantId: item.variantId,
      quantity: item.quantity,
      productId: item.variant.productId,
      title: item.variant.product.title,
      sellerId: item.variant.sellerId,
      sku: item.variant.sku,
      optionValues: item.variant.optionValues,
      priceLkrMinor: item.variant.priceLkrMinor,
      availableQuantity: item.variant.onHand - item.variant.reserved,
      available: this.isAvailable(item),
      shippingConfigured:
        item.variant.product.seller.shippingFeeLkrMinor !== null,
    }));
    const subtotal = items.reduce(
      (sum, item) => sum + item.priceLkrMinor * item.quantity,
      0,
    );
    const sellers = new Map(
      rows.map((row) => [
        row.variant.sellerId,
        row.variant.product.seller.shippingFeeLkrMinor,
      ]),
    );
    const shipping = [...sellers.values()].reduce<number>(
      (sum, fee) => sum + (fee ?? 0),
      0,
    );
    return {
      items,
      subtotalLkrMinor: subtotal,
      shippingLkrMinor: shipping,
      totalLkrMinor: subtotal + shipping,
      canCheckout:
        items.length > 0 &&
        items.every(
          (item) =>
            item.available &&
            item.availableQuantity >= item.quantity &&
            item.shippingConfigured,
        ),
    };
  }

  async setShippingFee(
    sellerId: string,
    identity: DecodedIdToken,
    shippingFeeLkrMinor: number,
  ) {
    await this.catalog.requireSellerMember(sellerId, identity, true);
    return this.prisma.seller.update({
      where: { id: sellerId },
      data: { shippingFeeLkrMinor },
      select: { id: true, shippingFeeLkrMinor: true },
    });
  }

  async checkout(identity: DecodedIdToken, dto: CheckoutDto) {
    const user = await this.buyer(identity);
    const previous = await this.prisma.order.findUnique({
      where: {
        buyerId_checkoutKey: { buyerId: user.id, checkoutKey: dto.checkoutKey },
      },
      include: orderDetail,
    });
    if (previous) return this.sameCheckout(previous, dto.addressId);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const repeated = await tx.order.findUnique({
              where: {
                buyerId_checkoutKey: {
                  buyerId: user.id,
                  checkoutKey: dto.checkoutKey,
                },
              },
              include: orderDetail,
            });
            if (repeated) return this.sameCheckout(repeated, dto.addressId);
            const address = await tx.buyerAddress.findFirst({
              where: { id: dto.addressId, userId: user.id, isActive: true },
            });
            if (!address) throw new NotFoundException('Address not found');
            const rows = await this.cartRows(tx, user.id);
            if (!rows.length) throw new BadRequestException('Cart is empty');
            if (rows.length > 50)
              throw new BadRequestException('Cart exceeds 50 items');
            for (const row of rows) {
              if (
                !this.isAvailable(row) ||
                row.variant.product.seller.shippingFeeLkrMinor === null
              )
                throw new ConflictException(
                  'Product or seller delivery is unavailable',
                );
            }
            const grouped = new Map<string, CartRow[]>();
            for (const row of rows)
              grouped.set(row.variant.sellerId, [
                ...(grouped.get(row.variant.sellerId) ?? []),
                row,
              ]);
            const subtotal = rows.reduce(
              (sum, row) => sum + row.quantity * row.variant.priceLkrMinor,
              0,
            );
            const shipping = [...grouped.values()].reduce(
              (sum, group) =>
                sum + group[0].variant.product.seller.shippingFeeLkrMinor!,
              0,
            );
            if (
              !Number.isSafeInteger(subtotal + shipping) ||
              subtotal + shipping > 1_000_000_000
            )
              throw new BadRequestException(
                'Order total exceeds supported amount',
              );
            // Every conditional UPDATE locks one SKU. A failed item rolls back all stock
            // writes, the order, movements and cart deletion together.
            for (const row of rows) {
              const changed = await tx.$queryRaw<Array<{ id: string }>>`
              UPDATE "ProductVariant" AS v SET "onHand" = v."onHand" - ${row.quantity}, "updatedAt" = NOW()
              FROM "Product" p, "Seller" s, "Category" c
              WHERE v."id" = ${row.variantId}::uuid AND v."productId" = p."id" AND v."sellerId" = s."id"
                AND p."sellerId" = s."id" AND p."categoryId" = c."id"
                AND p."status" = 'APPROVED' AND s."status" = 'APPROVED' AND c."isActive" = TRUE
                AND s."shippingFeeLkrMinor" IS NOT NULL
                AND v."onHand" - v."reserved" >= ${row.quantity}
              RETURNING v."id"`;
              if (!changed.length)
                throw new ConflictException(
                  'Stock changed; review cart and retry',
                );
            }
            const hash = createHash('sha256')
              .update(
                JSON.stringify({
                  addressId: dto.addressId,
                  rows: rows.map((row) => [
                    row.variantId,
                    row.quantity,
                    row.variant.priceLkrMinor,
                  ]),
                  shipping,
                }),
              )
              .digest('hex');
            const order = await tx.order.create({
              data: {
                buyerId: user.id,
                addressId: address.id,
                checkoutKey: dto.checkoutKey,
                snapshotHash: hash,
                recipient: address.recipient,
                phone: address.phone,
                line1: address.line1,
                line2: address.line2,
                city: address.city,
                district: address.district,
                postalCode: address.postalCode,
                subtotalLkrMinor: subtotal,
                shippingLkrMinor: shipping,
                totalLkrMinor: subtotal + shipping,
                sellerOrders: {
                  create: [...grouped.entries()].map(([sellerId, group]) => {
                    const subtotalLkrMinor = group.reduce(
                      (sum, row) =>
                        sum + row.quantity * row.variant.priceLkrMinor,
                      0,
                    );
                    const shippingLkrMinor =
                      group[0].variant.product.seller.shippingFeeLkrMinor!;
                    return {
                      sellerId,
                      subtotalLkrMinor,
                      shippingLkrMinor,
                      totalLkrMinor: subtotalLkrMinor + shippingLkrMinor,
                      items: {
                        create: group.map((row) => ({
                          variantId: row.variantId,
                          productTitle: row.variant.product.title,
                          sku: row.variant.sku,
                          optionValues: row.variant
                            .optionValues as Prisma.InputJsonValue,
                          unitLkrMinor: row.variant.priceLkrMinor,
                          quantity: row.quantity,
                          lineLkrMinor:
                            row.quantity * row.variant.priceLkrMinor,
                        })),
                      },
                    };
                  }),
                },
              },
              include: orderDetail,
            });
            for (const row of rows)
              await tx.inventoryMovement.create({
                data: {
                  variantId: row.variantId,
                  delta: -row.quantity,
                  reason: `COD order ${order.id} placed`,
                },
              });
            await tx.cartItem.deleteMany({ where: { userId: user.id } });
            await this.notifications.forUser(
              tx,
              user.id,
              NotificationType.ORDER_PLACED,
              order.id,
              'Your COD order was placed',
            );
            for (const sellerOrder of order.sellerOrders)
              await this.notifications.forSeller(
                tx,
                sellerOrder.sellerId,
                NotificationType.ORDER_PLACED,
                sellerOrder.id,
                'A new COD order needs fulfillment',
              );
            return order;
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            timeout: 15_000,
          },
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034' &&
          attempt < 2
        )
          continue;
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const saved = await this.prisma.order.findUnique({
            where: {
              buyerId_checkoutKey: {
                buyerId: user.id,
                checkoutKey: dto.checkoutKey,
              },
            },
            include: orderDetail,
          });
          if (saved) return this.sameCheckout(saved, dto.addressId);
        }
        throw error;
      }
    }
    throw new ConflictException('Checkout contention; retry');
  }

  async myOrders(identity: DecodedIdToken) {
    const user = await this.buyer(identity);
    return this.prisma.order.findMany({
      where: { buyerId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: orderDetail,
    });
  }

  async myOrder(identity: DecodedIdToken, orderId: string) {
    const user = await this.buyer(identity);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, buyerId: user.id },
      include: orderDetail,
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async sellerOrders(sellerId: string, identity: DecodedIdToken) {
    await this.catalog.requireSellerMember(sellerId, identity, false);
    return this.prisma.sellerOrder.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        order: {
          select: {
            id: true,
            recipient: true,
            phone: true,
            line1: true,
            line2: true,
            city: true,
            district: true,
            postalCode: true,
            createdAt: true,
          },
        },
        items: true,
        events: true,
      },
    });
  }

  adminOrders() {
    return this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: orderDetail,
    });
  }

  async buyerCancel(
    identity: DecodedIdToken,
    orderId: string,
    sellerOrderId: string,
  ) {
    const user = await this.buyer(identity);
    return this.cancel(sellerOrderId, user.id, {
      orderId,
      buyerId: user.id,
      allowed: [SellerOrderStatus.PLACED],
    });
  }

  async sellerStatus(
    sellerId: string,
    sellerOrderId: string,
    identity: DecodedIdToken,
    dto: SellerOrderStatusDto,
  ) {
    const user = await this.catalog.requireSellerMember(
      sellerId,
      identity,
      true,
    );
    if (dto.status === SellerOrderStatus.CANCELLED)
      return this.cancel(sellerOrderId, user.id, {
        sellerId,
        allowed: [
          SellerOrderStatus.PLACED,
          SellerOrderStatus.ACCEPTED,
          SellerOrderStatus.PACKED,
        ],
      });
    if (
      dto.status === SellerOrderStatus.DELIVERED &&
      dto.paymentCollected !== true
    )
      throw new BadRequestException(
        'Confirm COD payment collection before delivery completion',
      );
    if (
      dto.status !== SellerOrderStatus.DELIVERED &&
      dto.paymentCollected !== undefined
    )
      throw new BadRequestException(
        'Payment collection is only confirmed on delivery',
      );
    const before: Record<string, SellerOrderStatus> = {
      ACCEPTED: SellerOrderStatus.PLACED,
      PACKED: SellerOrderStatus.ACCEPTED,
      SHIPPED: SellerOrderStatus.PACKED,
      DELIVERED: SellerOrderStatus.SHIPPED,
    };
    return this.prisma.$transaction(async (tx) => {
      const previous = before[dto.status];
      const changed = await tx.sellerOrder.updateMany({
        where: { id: sellerOrderId, sellerId, status: previous },
        data: {
          status: dto.status,
          ...(dto.status === SellerOrderStatus.DELIVERED
            ? { paymentCollectedAt: new Date() }
            : {}),
        },
      });
      if (!changed.count)
        throw new ConflictException('Order cannot advance to that status');
      await tx.sellerOrderEvent.create({
        data: {
          sellerOrderId,
          actorUserId: user.id,
          fromStatus: previous,
          toStatus: dto.status,
        },
      });
      const buyer = await tx.sellerOrder.findUniqueOrThrow({
        where: { id: sellerOrderId },
        select: { order: { select: { buyerId: true } } },
      });
      await this.notifications.forUser(
        tx,
        buyer.order.buyerId,
        NotificationType.ORDER_UPDATED,
        sellerOrderId,
        `Your seller order is ${dto.status.toLowerCase()}`,
      );
      return tx.sellerOrder.findUniqueOrThrow({
        where: { id: sellerOrderId },
        include: { items: true, events: true },
      });
    });
  }

  private async cancel(
    sellerOrderId: string,
    actorUserId: string,
    scope: {
      orderId?: string;
      buyerId?: string;
      sellerId?: string;
      allowed: SellerOrderStatus[];
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const sellerOrder = await tx.sellerOrder.findFirst({
        where: {
          id: sellerOrderId,
          ...(scope.sellerId
            ? { sellerId: scope.sellerId }
            : { orderId: scope.orderId, order: { buyerId: scope.buyerId } }),
        },
        include: { items: true },
      });
      if (!sellerOrder) throw new NotFoundException('Seller order not found');
      if (!scope.allowed.includes(sellerOrder.status))
        throw new ConflictException('Order cannot be cancelled in this state');
      const changed = await tx.sellerOrder.updateMany({
        where: { id: sellerOrderId, status: sellerOrder.status },
        data: { status: SellerOrderStatus.CANCELLED },
      });
      if (!changed.count)
        throw new ConflictException('Order status changed; retry');
      for (const item of sellerOrder.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { onHand: { increment: item.quantity } },
        });
        await tx.inventoryMovement.create({
          data: {
            variantId: item.variantId,
            actorUserId,
            delta: item.quantity,
            reason: `COD seller order ${sellerOrderId} cancelled`,
          },
        });
      }
      await tx.sellerOrderEvent.create({
        data: {
          sellerOrderId,
          actorUserId,
          fromStatus: sellerOrder.status,
          toStatus: SellerOrderStatus.CANCELLED,
        },
      });
      const buyer = await tx.sellerOrder.findUniqueOrThrow({
        where: { id: sellerOrderId },
        select: { order: { select: { buyerId: true } }, sellerId: true },
      });
      await this.notifications.forUser(
        tx,
        buyer.order.buyerId,
        NotificationType.ORDER_UPDATED,
        sellerOrderId,
        'A seller order was cancelled',
      );
      await this.notifications.forSeller(
        tx,
        buyer.sellerId,
        NotificationType.ORDER_UPDATED,
        sellerOrderId,
        'A seller order was cancelled',
      );
      return tx.sellerOrder.findUniqueOrThrow({
        where: { id: sellerOrderId },
        include: { items: true, events: true },
      });
    });
  }

  private sameCheckout<T extends { addressId: string }>(
    order: T,
    addressId: string,
  ) {
    if (order.addressId !== addressId)
      throw new ConflictException(
        'Checkout key already used with another address',
      );
    return order;
  }

  private isAvailable(item: CartRow) {
    const product = item.variant.product;
    return (
      product.status === ProductStatus.APPROVED &&
      product.category.isActive &&
      product.seller.status === SellerStatus.APPROVED
    );
  }

  private cartRows(tx: Prisma.TransactionClient, userId: string) {
    return tx.cartItem.findMany({
      where: { userId },
      orderBy: { variantId: 'asc' },
      take: 51,
      include: {
        variant: {
          include: { product: { include: { seller: true, category: true } } },
        },
      },
    });
  }
}
