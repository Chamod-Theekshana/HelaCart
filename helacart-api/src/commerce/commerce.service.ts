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
  accrueCommission,
  commissionSnapshot,
  itemCommissionSnapshot,
} from '../commission/commission-ledger.js';
import {
  AddressDto,
  CheckoutDto,
  SellerOrderStatusDto,
  DeliverySettingsDto,
  ShipmentDto,
} from './commerce.dto.js';
import { canonicalDistrict, deliveryFor } from './delivery-rules.js';

export const buyerOrderItemFields = {
  variant: { select: { productId: true } },
  id: true,
  sellerOrderId: true,
  variantId: true,
  productTitle: true,
  sku: true,
  optionValues: true,
  unitLkrMinor: true,
  quantity: true,
  lineLkrMinor: true,
} as const;
export const buyerSellerOrderFields = {
  id: true,
  orderId: true,
  sellerId: true,
  status: true,
  subtotalLkrMinor: true,
  shippingLkrMinor: true,
  totalLkrMinor: true,
  paymentCollectedAt: true,
  createdAt: true,
  updatedAt: true,
  deliveryDistrict: true,
  deliveryRateRevision: true,
  deliveryMinDays: true,
  deliveryMaxDays: true,
} as const;
const orderDetail = {
  sellerOrders: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      ...buyerSellerOrderFields,
      seller: { select: { id: true, name: true, slug: true } },
      items: { select: buyerOrderItemFields },
      shipment: true,
      events: { orderBy: { createdAt: 'asc' as const } },
    },
  },
} as const;
const orderWriteOptions = { timeout: 45_000, maxWait: 10_000 } as const;

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

  async cart(identity: DecodedIdToken, addressId?: string) {
    const user = await this.buyer(identity);
    const address = addressId
      ? await this.prisma.buyerAddress.findFirst({
          where: { id: addressId, userId: user.id, isActive: true },
        })
      : undefined;
    if (addressId && !address) throw new NotFoundException('Address not found');
    const rows = await this.cartRows(this.prisma, user.id);
    const delivery = this.deliveryQuotes(rows, address?.district);
    const items = rows.map((item) => ({
      variantId: item.variantId,
      quantity: item.quantity,
      productId: item.variant.productId,
      title: item.variant.product.title,
      sellerId: item.variant.sellerId,
      sellerName: item.variant.product.seller.name,
      sellerSlug: item.variant.product.seller.slug,
      imageUrl: item.variant.product.imageUrls[0] ?? null,
      shippingFeeLkrMinor: delivery.find(
        (d) => d.sellerId === item.variant.sellerId,
      )!.feeMinor,
      sku: item.variant.sku,
      optionValues: item.variant.optionValues,
      priceLkrMinor: item.variant.priceLkrMinor,
      availableQuantity: item.variant.onHand - item.variant.reserved,
      available: this.isAvailable(item),
      shippingConfigured: delivery.find(
        (d) => d.sellerId === item.variant.sellerId,
      )!.available,
    }));
    const subtotal = items.reduce(
      (sum, item) => sum + item.priceLkrMinor * item.quantity,
      0,
    );
    const shipping = delivery.reduce((sum, d) => sum + (d.feeMinor ?? 0), 0);
    return {
      items,
      subtotalLkrMinor: subtotal,
      shippingLkrMinor: shipping,
      totalLkrMinor: subtotal + shipping,
      checkoutQuote: this.quote(rows, address ?? undefined),
      addressId: address?.id ?? null,
      deliveryQuoted: Boolean(address),
      deliveryBySeller: delivery,
      canCheckout:
        items.length > 0 &&
        items.length <= 50 &&
        Number.isSafeInteger(subtotal + shipping) &&
        subtotal + shipping <= 1_000_000_000 &&
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
      data: { shippingFeeLkrMinor, deliveryRevision: { increment: 1 } },
      select: { id: true, shippingFeeLkrMinor: true },
    });
  }
  async deliverySettings(sellerId: string, identity: DecodedIdToken) {
    await this.catalog.requireSellerMember(sellerId, identity, false);
    return this.prisma.seller.findUniqueOrThrow({
      where: { id: sellerId },
      select: {
        id: true,
        shippingFeeLkrMinor: true,
        deliveryRevision: true,
        deliveryRules: true,
        freeShippingThresholdMinor: true,
        deliveryMinDays: true,
        deliveryMaxDays: true,
      },
    });
  }
  async setDeliverySettings(
    sellerId: string,
    identity: DecodedIdToken,
    dto: DeliverySettingsDto,
  ) {
    await this.catalog.requireSellerMember(sellerId, identity, true);
    if (
      (dto.deliveryMinDays == null) !== (dto.deliveryMaxDays == null) ||
      (dto.deliveryMinDays != null &&
        dto.deliveryMinDays > dto.deliveryMaxDays!)
    )
      throw new BadRequestException(
        'Set both delivery estimates, with minimum no greater than maximum',
      );
    const changed = await this.prisma.seller.updateMany({
      where: {
        id: sellerId,
        deliveryRevision: dto.version,
        status: SellerStatus.APPROVED,
      },
      data: {
        shippingFeeLkrMinor: dto.shippingFeeLkrMinor,
        deliveryRevision: { increment: 1 },
        deliveryRules: [...dto.districtRates].sort((a, b) =>
          a.district.localeCompare(b.district),
        ) as unknown as Prisma.InputJsonValue,
        freeShippingThresholdMinor: dto.freeShippingThresholdMinor,
        deliveryMinDays: dto.deliveryMinDays,
        deliveryMaxDays: dto.deliveryMaxDays,
      },
    });
    if (!changed.count)
      throw new ConflictException(
        'Delivery settings changed. Reload before saving',
      );
    return this.deliverySettings(sellerId, identity);
  }

  async checkout(identity: DecodedIdToken, dto: CheckoutDto) {
    const user = await this.buyer(identity);
    const previous = await this.prisma.order.findUnique({
      where: {
        buyerId_checkoutKey: { buyerId: user.id, checkoutKey: dto.checkoutKey },
      },
      include: orderDetail,
    });
    if (previous) return this.sameCheckout(previous, dto.addressId, dto.quote);
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
            if (repeated)
              return this.sameCheckout(repeated, dto.addressId, dto.quote);
            const address = await tx.buyerAddress.findFirst({
              where: { id: dto.addressId, userId: user.id, isActive: true },
            });
            if (!address) throw new NotFoundException('Address not found');
            const rows = await this.cartRows(tx, user.id);
            if (!rows.length) throw new BadRequestException('Cart is empty');
            if (rows.length > 50)
              throw new BadRequestException('Cart exceeds 50 items');
            const hasCustomDelivery = rows.some((row) => {
              const s = row.variant.product.seller;
              return (
                (Array.isArray(s.deliveryRules) &&
                  s.deliveryRules.length > 0) ||
                s.freeShippingThresholdMinor != null ||
                s.deliveryMinDays != null
              );
            });
            if (
              this.quote(rows, address) !== dto.quote &&
              (hasCustomDelivery || this.quote(rows) !== dto.quote)
            )
              throw new ConflictException(
                'Your cart or delivery charges changed. Review the updated cart before placing your order.',
              );
            for (const row of rows) {
              if (
                !this.isAvailable(row) ||
                row.variant.product.seller.shippingFeeLkrMinor === null
              )
                throw new ConflictException(
                  'Product or seller delivery is unavailable',
                );
            }
            const delivery = this.deliveryQuotes(rows, address.district);
            if (delivery.some((d) => !d.available))
              throw new ConflictException(
                'A shop cannot deliver to this address. Review delivery details before checkout',
              );
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
            const shipping = delivery.reduce((sum, d) => sum + d.feeMinor!, 0);
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
            const hash = this.checkoutHash(dto.addressId, dto.quote);
            const commission = await commissionSnapshot(tx);
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
                    const deliveryTerms = delivery.find(
                      (d) => d.sellerId === sellerId,
                    )!;
                    const shippingLkrMinor = deliveryTerms.feeMinor!;
                    return {
                      deliveryDistrict: canonicalDistrict(address.district),
                      deliveryRateRevision: deliveryTerms.revision,
                      deliveryMinDays: deliveryTerms.minDays,
                      deliveryMaxDays: deliveryTerms.maxDays,
                      sellerId,
                      subtotalLkrMinor,
                      shippingLkrMinor,
                      totalLkrMinor: subtotalLkrMinor + shippingLkrMinor,
                      items: {
                        create: group.map((row) => ({
                          variantId: row.variantId,
                          productTitle: row.variant.product.title,
                          ...itemCommissionSnapshot(
                            row.variant.product,
                            row.quantity * row.variant.priceLkrMinor,
                            commission,
                          ),
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
            await tx.inventoryMovement.createMany({
              data: rows.map((row) => ({
                variantId: row.variantId,
                actorUserId: user.id,
                delta: -row.quantity,
                reason: `COD order ${order.id} placed`,
              })),
            });
            await tx.cartItem.deleteMany({ where: { userId: user.id } });
            await this.notifications.forUser(
              tx,
              user.id,
              NotificationType.ORDER_PLACED,
              order.id,
              'Your COD order was placed',
              `/orders?order=${order.id}`,
            );
            await this.notifications.forSellerOrders(tx, order.sellerOrders);
            await this.notifications.forAdmins(
              tx,
              NotificationType.ORDER_PLACED,
              order.id,
              'A new COD order was placed',
              `/admin/orders?order=${order.id}`,
            );
            return order;
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            ...orderWriteOptions,
          },
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2034' ||
            (error.code === 'P2010' &&
              ['40001', '40P01'].includes(
                String(
                  error.meta?.code ??
                    (
                      error.meta?.driverAdapterError as
                        { cause?: { originalCode?: unknown } } | undefined
                    )?.cause?.originalCode,
                ),
              )))
        ) {
          if (attempt < 2) continue;
          throw new ConflictException(
            'Checkout is busy. Review your cart and retry.',
          );
        }
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
          if (saved) return this.sameCheckout(saved, dto.addressId, dto.quote);
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
    if (
      dto.status !== SellerOrderStatus.SHIPPED &&
      (dto.courierName !== undefined || dto.trackingNumber !== undefined)
    )
      throw new BadRequestException(
        'Tracking details are supplied when marking an order shipped',
      );
    if (dto.trackingNumber !== undefined && !dto.courierName)
      throw new BadRequestException(
        'Provide the courier or delivery service name',
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
      if (dto.status === SellerOrderStatus.DELIVERED)
        await accrueCommission(tx, sellerOrderId);
      if (dto.status === SellerOrderStatus.SHIPPED && dto.courierName) {
        const shipment = await tx.sellerShipment.create({
          data: {
            sellerOrderId,
            courierName: dto.courierName,
            trackingNumber: dto.trackingNumber || null,
            shippedAt: new Date(),
          },
        });
        await tx.shipmentChange.create({
          data: {
            shipmentId: shipment.id,
            actorId: user.id,
            version: 1,
            before: {},
            after: {
              courierName: shipment.courierName,
              trackingNumber: shipment.trackingNumber,
            },
            reason: 'Shipment details recorded at dispatch',
          },
        });
      }
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
        select: { orderId: true, order: { select: { buyerId: true } } },
      });
      await this.notifications.forUser(
        tx,
        buyer.order.buyerId,
        NotificationType.ORDER_UPDATED,
        sellerOrderId,
        `Your seller order is ${dto.status.toLowerCase()}`,
        `/orders?order=${buyer.orderId}`,
      );
      await this.notifications.forSeller(
        tx,
        sellerId,
        NotificationType.ORDER_UPDATED,
        sellerOrderId,
        `Order ${sellerOrderId.slice(0, 8).toUpperCase()} is ${dto.status.toLowerCase()}`,
        `/seller/orders?order=${sellerOrderId}`,
      );
      return tx.sellerOrder.findUniqueOrThrow({
        where: { id: sellerOrderId },
        select: {
          ...buyerSellerOrderFields,
          items: { select: buyerOrderItemFields },
          events: true,
          shipment: true,
        },
      });
    }, orderWriteOptions);
  }

  async updateShipment(
    sellerId: string,
    sellerOrderId: string,
    identity: DecodedIdToken,
    dto: ShipmentDto,
  ) {
    const actor = await this.catalog.requireSellerMember(
      sellerId,
      identity,
      true,
    );
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "SellerOrder" WHERE id=${sellerOrderId}::uuid AND "sellerId"=${sellerId}::uuid FOR UPDATE`;
      if (!locked.length) throw new NotFoundException('Seller order not found');
      const order = await tx.sellerOrder.findUniqueOrThrow({
        where: { id: sellerOrderId },
        include: {
          shipment: true,
          events: {
            where: { toStatus: 'SHIPPED' },
            orderBy: { createdAt: 'asc' },
            take: 1,
          },
          order: { select: { buyerId: true } },
        },
      });
      if (order.status !== 'SHIPPED')
        throw new ConflictException(
          'Tracking details can be changed while the order is shipped',
        );
      if ((order.shipment?.version ?? 0) !== dto.version)
        throw new ConflictException('Tracking changed. Reload before saving');
      const data = {
        courierName: dto.courierName,
        trackingNumber: dto.trackingNumber || null,
      };
      const shipment = order.shipment
        ? await tx.sellerShipment.update({
            where: { id: order.shipment.id },
            data: { ...data, version: { increment: 1 } },
          })
        : await tx.sellerShipment.create({
            data: {
              ...data,
              sellerOrderId,
              shippedAt: order.events[0]?.createdAt ?? order.updatedAt,
            },
          });
      await tx.shipmentChange.create({
        data: {
          shipmentId: shipment.id,
          actorId: actor.id,
          version: shipment.version,
          before: order.shipment
            ? {
                courierName: order.shipment.courierName,
                trackingNumber: order.shipment.trackingNumber,
              }
            : {},
          after: data,
          reason: dto.reason,
        },
      });
      await this.notifications.forUser(
        tx,
        order.order.buyerId,
        NotificationType.ORDER_TRACKING_UPDATED,
        sellerOrderId,
        'Delivery tracking details were updated',
        `/orders?order=${order.orderId}`,
      );
      await this.notifications.forSeller(
        tx,
        sellerId,
        NotificationType.ORDER_TRACKING_UPDATED,
        sellerOrderId,
        'Order tracking details were updated',
        `/seller/orders?order=${sellerOrderId}`,
      );
      return shipment;
    }, orderWriteOptions);
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
        select: {
          orderId: true,
          order: { select: { buyerId: true } },
          sellerId: true,
        },
      });
      await this.notifications.forUser(
        tx,
        buyer.order.buyerId,
        NotificationType.ORDER_UPDATED,
        sellerOrderId,
        'A seller order was cancelled',
        `/orders?order=${buyer.orderId}`,
      );
      await this.notifications.forSeller(
        tx,
        buyer.sellerId,
        NotificationType.ORDER_UPDATED,
        sellerOrderId,
        'A seller order was cancelled',
        `/seller/orders?order=${sellerOrderId}`,
      );
      return tx.sellerOrder.findUniqueOrThrow({
        where: { id: sellerOrderId },
        select: {
          ...buyerSellerOrderFields,
          items: { select: buyerOrderItemFields },
          events: true,
        },
      });
    }, orderWriteOptions);
  }

  private checkoutHash(addressId: string, quote: string) {
    return createHash('sha256')
      .update(JSON.stringify({ addressId, quote }))
      .digest('hex');
  }

  private deliveryQuotes(rows: CartRow[], district?: string) {
    const groups = new Map<string, CartRow[]>();
    for (const row of rows)
      groups.set(row.variant.sellerId, [
        ...(groups.get(row.variant.sellerId) ?? []),
        row,
      ]);
    return [...groups].map(([sellerId, group]) => ({
      sellerId,
      sellerName: group[0].variant.product.seller.name,
      ...deliveryFor(
        group[0].variant.product.seller,
        group.reduce((s, r) => s + r.quantity * r.variant.priceLkrMinor, 0),
        district,
      ),
    }));
  }
  private quote(
    rows: CartRow[],
    address?: {
      id: string;
      district: string;
      recipient: string;
      phone: string;
      line1: string;
      line2?: string | null;
      city: string;
      postalCode: string;
    },
  ) {
    return createHash('sha256')
      .update(
        JSON.stringify({
          address: address ?? null,
          items: rows
            .map((row) => ({
              variantId: row.variantId,
              sellerId: row.variant.sellerId,
              quantity: row.quantity,
              price: row.variant.priceLkrMinor,
              delivery: row.variant.product.seller.shippingFeeLkrMinor,
              deliveryRules: row.variant.product.seller.deliveryRules ?? [],
              deliveryRevision:
                row.variant.product.seller.deliveryRevision ?? 0,
              freeShippingThresholdMinor:
                row.variant.product.seller.freeShippingThresholdMinor ?? null,
              deliveryMinDays:
                row.variant.product.seller.deliveryMinDays ?? null,
              deliveryMaxDays:
                row.variant.product.seller.deliveryMaxDays ?? null,
              title: row.variant.product.title,
              sku: row.variant.sku,
              options: Object.entries(
                row.variant.optionValues as Record<string, string>,
              ).sort(([a], [b]) => a.localeCompare(b)),
            }))
            .sort((a, b) => a.variantId.localeCompare(b.variantId)),
        }),
      )
      .digest('hex');
  }

  private sameCheckout<T extends { addressId: string; snapshotHash: string }>(
    order: T,
    addressId: string,
    quote: string,
  ) {
    if (
      order.addressId !== addressId ||
      order.snapshotHash !== this.checkoutHash(addressId, quote)
    )
      throw new ConflictException(
        'Checkout key already used for a different checkout. Check your orders before starting again.',
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
