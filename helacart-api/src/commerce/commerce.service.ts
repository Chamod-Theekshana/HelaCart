import { activeOffers, discountedMinor } from '../discovery/pricing.js';
import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { AuditService } from '../audit/audit.service.js';
import {
  accrueCommission,
  commissionSnapshot,
  itemCommissionSnapshot,
} from '../commission/commission-ledger.js';
import {
  AddressDto,
  AdminOrderActionDto,
  AttentionQueryDto,
  CheckoutDto,
  SellerOrderStatusDto,
  DeliverySettingsDto,
  ShipmentDto,
  UpdateAddressDto,
} from './commerce.dto.js';
import { canonicalDistrict, deliveryFor } from './delivery-rules.js';
import { apiError, type ApiErrorCode } from '../common/api-error.js';
import { describeError } from '../common/describe-error.js';
import { normalizeSriLankanMobile } from '../common/phone.js';
import {
  adminOrderActions,
  attentionPlacedCutoff,
  autoCancelCutoff,
  autoCancelReason,
  canTransition,
  openSellerOrderStatuses,
  reasonRequired,
  restoresStock,
  statusMessage,
  type OrderActor,
} from './order-state.js';

export const buyerOrderItemFields = {
  originalUnitLkrMinor: true,
  promotionDiscountBps: true,
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
  statusReason: true,
  statusChangedAt: true,
} as const;
/** Seller-order row returned by admin order routes. */
export const adminSellerOrderSelect = {
  ...buyerSellerOrderFields,
  seller: { select: { id: true, name: true, slug: true, status: true } },
  order: {
    select: {
      id: true,
      buyerId: true,
      recipient: true,
      phone: true,
      city: true,
      district: true,
      createdAt: true,
    },
  },
  items: { select: buyerOrderItemFields },
  shipment: true,
  events: { orderBy: { createdAt: 'asc' as const } },
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

type BaseCartRow = Prisma.CartItemGetPayload<{
  include: {
    variant: {
      include: { product: { include: { seller: true; category: true } } };
    };
  };
}>;

type CartRow = Omit<BaseCartRow, 'variant'> & {
  variant: BaseCartRow['variant'] & {
    originalPriceLkrMinor?: number;
    promotionId?: string;
    promotionDiscountBps?: number;
  };
};

type TransitionInput = {
  sellerOrderId: string;
  actor: OrderActor;
  /** Null only for background-job (SYSTEM) transitions. */
  actorUserId: string | null;
  to: SellerOrderStatus;
  reason?: string | null;
  /** Ownership filter: seller routes pass sellerId, buyer routes orderId+buyerId. */
  scope: { sellerId?: string; orderId?: string; buyerId?: string };
  shipment?: { courierName?: string; trackingNumber?: string };
};

export type CheckoutBlocker = Extract<
  ApiErrorCode,
  | 'PHONE_NOT_VERIFIED'
  | 'TOO_MANY_OPEN_ORDERS'
  | 'COD_LIMIT_EXCEEDED'
  | 'SELLER_SUSPENDED'
>;

const blockerErrors: Record<CheckoutBlocker, [number, string]> = {
  SELLER_SUSPENDED: [
    409,
    'A shop in your cart is not accepting orders right now. Remove its items to continue',
  ],
  COD_LIMIT_EXCEEDED: [
    400,
    'This order is above the cash-on-delivery limit. Reduce the order total',
  ],
  TOO_MANY_OPEN_ORDERS: [
    409,
    'You have too many orders awaiting delivery. Receive or cancel some before ordering again',
  ],
  PHONE_NOT_VERIFIED: [
    409,
    'Verify the delivery phone number before placing a cash-on-delivery order',
  ],
};

@Injectable()
export class CommerceService {
  private readonly logger = new Logger(CommerceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly catalog: CatalogService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private get limits() {
    return {
      requirePhone:
        this.config.get<boolean>('REQUIRE_PHONE_VERIFICATION') === true,
      maxOpenOrders: this.config.get<number>('MAX_OPEN_COD_ORDERS') ?? 5,
      maxCodMinor:
        this.config.get<number>('MAX_COD_ORDER_LKR_MINOR') ?? 50_000_000,
      acceptHours: this.config.get<number>('SELLER_ACCEPT_HOURS') ?? 48,
    };
  }

  private async buyer(identity: DecodedIdToken) {
    if (!identity.email_verified)
      throw new ForbiddenException('Verify your email before shopping');
    return this.auth.getOrCreateProfile(identity);
  }

  private async verifiedPhones(
    db: Prisma.TransactionClient,
    userId: string,
  ): Promise<Set<string>> {
    const rows = await db.verifiedPhone.findMany({
      where: { userId },
      select: { phone: true },
    });
    return new Set(rows.map((row) => row.phone));
  }

  private present<T extends { phone: string }>(
    address: T,
    verified: Set<string>,
  ) {
    const phone = normalizeSriLankanMobile(address.phone);
    return { ...address, phoneVerified: phone ? verified.has(phone) : false };
  }

  async addresses(identity: DecodedIdToken) {
    const user = await this.buyer(identity);
    const [rows, verified] = await Promise.all([
      this.prisma.buyerAddress.findMany({
        where: { userId: user.id, isActive: true },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        take: 20,
      }),
      this.verifiedPhones(this.prisma, user.id),
    ]);
    return rows.map((row) => this.present(row, verified));
  }

  async addAddress(identity: DecodedIdToken, dto: AddressDto) {
    const user = await this.buyer(identity);
    const { isDefault, ...fields } = dto;
    const created = await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id}::uuid FOR UPDATE`;
        const active = await tx.buyerAddress.findMany({
          where: { userId: user.id, isActive: true },
          select: { isDefault: true },
        });
        if (active.length >= 20)
          throw new ConflictException('Too many saved addresses');
        // The first address (or an explicit request) becomes the default.
        const makeDefault =
          isDefault === true || !active.some((row) => row.isDefault);
        if (makeDefault)
          await tx.buyerAddress.updateMany({
            where: { userId: user.id, isDefault: true },
            data: { isDefault: false },
          });
        return tx.buyerAddress.create({
          data: { ...fields, userId: user.id, isDefault: makeDefault },
        });
      },
      { timeout: 15_000, maxWait: 10_000 },
    );
    return this.present(
      created,
      await this.verifiedPhones(this.prisma, user.id),
    );
  }

  async updateAddress(
    identity: DecodedIdToken,
    addressId: string,
    dto: UpdateAddressDto,
  ) {
    const user = await this.buyer(identity);
    const { isDefault, ...fields } = dto;
    const changes = Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined),
    ) as Partial<AddressDto>;
    if (!Object.keys(changes).length && isDefault === undefined)
      throw new BadRequestException('Supply at least one address field');
    // Past orders keep their own address snapshot; only the saved address changes.
    const updated = await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id}::uuid FOR UPDATE`;
        const current = await tx.buyerAddress.findFirst({
          where: { id: addressId, userId: user.id, isActive: true },
          select: { id: true },
        });
        if (!current) throw new NotFoundException('Address not found');
        if (isDefault === true)
          await tx.buyerAddress.updateMany({
            where: { userId: user.id, isDefault: true, id: { not: addressId } },
            data: { isDefault: false },
          });
        return tx.buyerAddress.update({
          where: { id: addressId },
          data: {
            ...changes,
            ...(isDefault !== undefined ? { isDefault } : {}),
          },
        });
      },
      { timeout: 15_000, maxWait: 10_000 },
    );
    return this.present(
      updated,
      await this.verifiedPhones(this.prisma, user.id),
    );
  }

  async removeAddress(identity: DecodedIdToken, addressId: string) {
    const user = await this.buyer(identity);
    await this.prisma.$transaction(
      async (tx) => {
        // Same per-user lock as add/update, so default promotion cannot race
        // them into the one-default-per-user unique index.
        await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id}::uuid FOR UPDATE`;
        const address = await tx.buyerAddress.findFirst({
          where: { id: addressId, userId: user.id, isActive: true },
          select: { isDefault: true },
        });
        if (!address) throw new NotFoundException('Address not found');
        const result = await tx.buyerAddress.updateMany({
          where: { id: addressId, userId: user.id, isActive: true },
          data: { isActive: false, isDefault: false },
        });
        if (!result.count) throw new NotFoundException('Address not found');
        if (address.isDefault) {
          // Promote the most recent remaining address as the new default.
          const next = await tx.buyerAddress.findFirst({
            where: { userId: user.id, isActive: true },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            select: { id: true },
          });
          if (next)
            await tx.buyerAddress.update({
              where: { id: next.id },
              data: { isDefault: true },
            });
        }
      },
      { timeout: 15_000, maxWait: 10_000 },
    );
    return { deleted: true };
  }

  /** Checkout failures already known from the cart (contract §3.2). */
  private async checkoutBlockers(
    db: Prisma.TransactionClient,
    userId: string,
    rows: CartRow[],
    totalMinor: number,
    address?: { phone: string } | null,
  ): Promise<CheckoutBlocker[]> {
    const limits = this.limits;
    const blockers: CheckoutBlocker[] = [];
    if (
      rows.some(
        (row) => row.variant.product.seller.status === SellerStatus.SUSPENDED,
      )
    )
      blockers.push('SELLER_SUSPENDED');
    if (totalMinor > limits.maxCodMinor) blockers.push('COD_LIMIT_EXCEEDED');
    const open = await db.sellerOrder.count({
      where: {
        order: { buyerId: userId },
        status: { in: [...openSellerOrderStatuses] },
      },
    });
    // This checkout opens one seller order per shop in the cart.
    const incoming = new Set(rows.map((row) => row.variant.sellerId)).size;
    if (open + incoming > limits.maxOpenOrders)
      blockers.push('TOO_MANY_OPEN_ORDERS');
    if (limits.requirePhone && address) {
      const phone = normalizeSriLankanMobile(address.phone);
      const verified = phone
        ? await db.verifiedPhone.findUnique({
            where: { userId_phone: { userId, phone } },
            select: { id: true },
          })
        : null;
      if (!verified) blockers.push('PHONE_NOT_VERIFIED');
    }
    return blockers;
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
      originalPriceLkrMinor: item.variant.originalPriceLkrMinor,
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
    const checkoutBlockers = rows.length
      ? await this.checkoutBlockers(
          this.prisma,
          user.id,
          rows,
          subtotal + shipping,
          address,
        )
      : [];
    return {
      items,
      subtotalLkrMinor: subtotal,
      shippingLkrMinor: shipping,
      totalLkrMinor: subtotal + shipping,
      checkoutQuote: this.quote(rows, address ?? undefined),
      addressId: address?.id ?? null,
      deliveryQuoted: Boolean(address),
      deliveryBySeller: delivery,
      checkoutBlockers,
      canCheckout:
        items.length > 0 &&
        items.length <= 50 &&
        checkoutBlockers.length === 0 &&
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
    await this.catalog.requireSellerMember(sellerId, identity, true, {
      ownerOnly: true,
    });
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
    await this.catalog.requireSellerMember(sellerId, identity, true, {
      ownerOnly: true,
    });
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
            if (
              rows.some(
                (row) =>
                  row.variant.product.seller.status === SellerStatus.SUSPENDED,
              )
            )
              throw apiError(
                409,
                'SELLER_SUSPENDED',
                blockerErrors.SELLER_SUSPENDED[1],
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
            const [blocker] = await this.checkoutBlockers(
              tx,
              user.id,
              rows,
              subtotal + shipping,
              address,
            );
            if (blocker)
              throw apiError(
                blockerErrors[blocker][0],
                blocker,
                blockerErrors[blocker][1],
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
                          originalUnitLkrMinor:
                            row.variant.originalPriceLkrMinor,
                          promotionId: row.variant.promotionId,
                          promotionDiscountBps:
                            row.variant.promotionDiscountBps,
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
    reason?: string,
  ) {
    const user = await this.buyer(identity);
    return this.prisma.$transaction(async (tx) => {
      await this.transition(tx, {
        sellerOrderId,
        actor: 'BUYER',
        actorUserId: user.id,
        to: SellerOrderStatus.CANCELLED,
        reason: reason ?? 'Cancelled by the buyer',
        scope: { orderId, buyerId: user.id },
      });
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

  /** Buyer confirms a shipped COD parcel arrived and was paid (contract §1.4). */
  async confirmReceipt(
    identity: DecodedIdToken,
    orderId: string,
    sellerOrderId: string,
  ) {
    const user = await this.buyer(identity);
    await this.prisma.$transaction(
      (tx) =>
        this.transition(tx, {
          sellerOrderId,
          actor: 'BUYER',
          actorUserId: user.id,
          to: SellerOrderStatus.DELIVERED,
          reason: 'Buyer confirmed receipt',
          scope: { orderId, buyerId: user.id },
        }),
      orderWriteOptions,
    );
    return this.myOrder(identity, orderId);
  }

  async sellerStatus(
    sellerId: string,
    sellerOrderId: string,
    identity: DecodedIdToken,
    dto: SellerOrderStatusDto,
  ) {
    // Suspended shops may still fulfil or cancel existing orders (contract §5).
    const user = await this.catalog.requireSellerMember(
      sellerId,
      identity,
      true,
      { allowSuspended: true },
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
    if (reasonRequired(dto.status) && !dto.reason)
      throw new BadRequestException(
        'Give a reason of 5 to 500 characters for this status change',
      );
    return this.prisma.$transaction(async (tx) => {
      await this.transition(tx, {
        sellerOrderId,
        actor: 'SELLER',
        actorUserId: user.id,
        to: dto.status,
        reason: dto.reason,
        scope: { sellerId },
        shipment: {
          courierName: dto.courierName,
          trackingNumber: dto.trackingNumber,
        },
      });
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

  /** Admin intervention on a seller order (contract §1.5). */
  async adminAction(
    identity: DecodedIdToken,
    sellerOrderId: string,
    dto: AdminOrderActionDto,
  ) {
    const admin = await this.audit.actor(identity);
    const to = adminOrderActions[dto.action];
    return this.prisma.$transaction(async (tx) => {
      const { previous } = await this.transition(tx, {
        sellerOrderId,
        actor: 'ADMIN',
        actorUserId: admin.id,
        to,
        reason: dto.reason,
        scope: {},
      });
      await this.audit.record(tx, admin, {
        action: `ORDER_${dto.action}` as const,
        subjectType: 'SELLER_ORDER',
        subjectId: sellerOrderId,
        reason: dto.reason,
        details: { from: previous, to },
      });
      return tx.sellerOrder.findUniqueOrThrow({
        where: { id: sellerOrderId },
        select: adminSellerOrderSelect,
      });
    }, orderWriteOptions);
  }

  /** Seller orders that are stuck in delivery or about to be auto-cancelled. */
  async attention(query: AttentionQueryDto) {
    const now = new Date();
    const limit = query.limit ?? 20;
    const rows = await this.prisma.sellerOrder.findMany({
      where: {
        OR: [
          {
            status: {
              in: [
                SellerOrderStatus.SHIPPED,
                SellerOrderStatus.DELIVERY_FAILED,
              ],
            },
            statusChangedAt: {
              lt: new Date(now.getTime() - (query.days ?? 7) * 86_400_000),
            },
          },
          {
            status: SellerOrderStatus.PLACED,
            statusChangedAt: {
              lt: attentionPlacedCutoff(now, this.limits.acceptHours),
            },
          },
        ],
      },
      orderBy: [{ statusChangedAt: 'asc' }, { id: 'asc' }],
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: limit + 1,
      select: adminSellerOrderSelect,
    });
    return {
      items: rows.slice(0, limit),
      nextCursor: rows.length > limit ? rows[limit - 1].id : null,
    };
  }

  /** Worker step: cancels PLACED orders the seller did not accept in time. */
  async autoCancelDue(limit = 50, now = new Date()) {
    const due = await this.prisma.sellerOrder.findMany({
      where: {
        status: SellerOrderStatus.PLACED,
        statusChangedAt: {
          lt: autoCancelCutoff(now, this.limits.acceptHours),
        },
      },
      orderBy: [{ statusChangedAt: 'asc' }, { id: 'asc' }],
      take: limit,
      select: { id: true },
    });
    let cancelled = 0;
    for (const { id } of due) {
      try {
        await this.prisma.$transaction(
          (tx) =>
            this.transition(tx, {
              sellerOrderId: id,
              actor: 'SYSTEM',
              actorUserId: null,
              to: SellerOrderStatus.CANCELLED,
              reason: autoCancelReason,
              scope: {},
            }),
          orderWriteOptions,
        );
        cancelled++;
      } catch (error) {
        // The seller may have accepted it a moment ago; anything else is logged.
        if (error instanceof HttpException && error.getStatus() === 409)
          continue;
        this.logger.error(
          `Automatic cancellation of seller order ${id} failed: ${describeError(error)}`,
        );
      }
    }
    return { processed: due.length, cancelled };
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
      { allowSuspended: true },
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

  /**
   * The only place a seller-order status changes. Locks the row, enforces the
   * state machine for the actor, restores stock, accrues commission, records
   * the event/shipment and queues notifications in the caller's transaction.
   */
  private async transition(
    tx: Prisma.TransactionClient,
    input: TransitionInput,
  ) {
    const { sellerOrderId, actor, actorUserId, to } = input;
    const reason = input.reason?.trim() || null;
    const locked = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM "SellerOrder" WHERE id=${sellerOrderId}::uuid FOR UPDATE`;
    if (!locked.length) throw new NotFoundException('Seller order not found');
    const order = await tx.sellerOrder.findFirst({
      where: {
        id: sellerOrderId,
        ...(input.scope.sellerId ? { sellerId: input.scope.sellerId } : {}),
        ...(input.scope.buyerId
          ? {
              orderId: input.scope.orderId,
              order: { buyerId: input.scope.buyerId },
            }
          : {}),
      },
      include: {
        items: true,
        shipment: true,
        order: { select: { buyerId: true } },
      },
    });
    if (!order) throw new NotFoundException('Seller order not found');
    const previous = order.status;
    if (!canTransition(previous, to, actor))
      throw apiError(
        409,
        'ORDER_TRANSITION_NOT_ALLOWED',
        `This order cannot move from ${previous.toLowerCase().replaceAll('_', ' ')} to ${to.toLowerCase().replaceAll('_', ' ')}`,
      );
    const now = new Date();
    const changed = await tx.sellerOrder.updateMany({
      where: { id: sellerOrderId, status: previous },
      data: {
        status: to,
        statusReason: reason,
        statusChangedAt: now,
        ...(to === SellerOrderStatus.DELIVERED
          ? { paymentCollectedAt: now }
          : {}),
      },
    });
    if (!changed.count)
      throw new ConflictException('Order status changed; reload and retry');
    // Commission accrues only on the transition into DELIVERED.
    if (to === SellerOrderStatus.DELIVERED)
      await accrueCommission(tx, sellerOrderId);
    if (restoresStock(to))
      for (const item of order.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { onHand: { increment: item.quantity } },
        });
        await tx.inventoryMovement.create({
          data: {
            variantId: item.variantId,
            actorUserId,
            delta: item.quantity,
            reason: `COD seller order ${sellerOrderId} ${to === SellerOrderStatus.CANCELLED ? 'cancelled' : 'returned to seller'}`,
          },
        });
      }
    const courierName = input.shipment?.courierName;
    if (to === SellerOrderStatus.SHIPPED && courierName && actorUserId) {
      const after = {
        courierName,
        trackingNumber: input.shipment?.trackingNumber || null,
      };
      if (order.shipment) {
        // Re-attempt after a failed delivery: dispatch date stays immutable.
        const shipment = await tx.sellerShipment.update({
          where: { id: order.shipment.id },
          data: { ...after, version: { increment: 1 } },
        });
        await tx.shipmentChange.create({
          data: {
            shipmentId: shipment.id,
            actorId: actorUserId,
            version: shipment.version,
            before: {
              courierName: order.shipment.courierName,
              trackingNumber: order.shipment.trackingNumber,
            },
            after,
            reason: 'Shipment details updated for a delivery re-attempt',
          },
        });
      } else {
        const shipment = await tx.sellerShipment.create({
          data: { sellerOrderId, ...after, shippedAt: now },
        });
        await tx.shipmentChange.create({
          data: {
            shipmentId: shipment.id,
            actorId: actorUserId,
            version: 1,
            before: {},
            after,
            reason: 'Shipment details recorded at dispatch',
          },
        });
      }
    }
    await tx.sellerOrderEvent.create({
      data: {
        sellerOrderId,
        actorUserId,
        fromStatus: previous,
        toStatus: to,
        reason,
      },
    });
    const shortId = sellerOrderId.slice(0, 8).toUpperCase();
    // A buyer confirming receipt does not need a notice about their own action.
    if (!(actor === 'BUYER' && to === SellerOrderStatus.DELIVERED))
      await this.notifications.forUser(
        tx,
        order.order.buyerId,
        NotificationType.ORDER_UPDATED,
        sellerOrderId,
        statusMessage(to, 'BUYER', shortId, reason),
        `/orders?order=${order.orderId}`,
        { audience: 'BUYER', orderStatus: to },
      );
    await this.notifications.forSeller(
      tx,
      order.sellerId,
      NotificationType.ORDER_UPDATED,
      sellerOrderId,
      actor === 'BUYER' && to === SellerOrderStatus.DELIVERED
        ? `Buyer confirmed receipt of order ${shortId}`
        : statusMessage(to, 'SELLER', shortId, reason),
      `/seller/orders?order=${sellerOrderId}`,
    );
    return {
      previous,
      orderId: order.orderId,
      sellerId: order.sellerId,
      buyerId: order.order.buyerId,
    };
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
              promotion: row.variant.promotionId,
              promotionBps: row.variant.promotionDiscountBps,
              originalPrice: row.variant.originalPriceLkrMinor,
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

  private async cartRows(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<CartRow[]> {
    const rows = await tx.cartItem.findMany({
      where: { userId },
      orderBy: { variantId: 'asc' },
      take: 51,
      include: {
        variant: {
          include: { product: { include: { seller: true, category: true } } },
        },
      },
    });
    const offers = await activeOffers(
      tx,
      rows.map((r) => r.variant.productId),
    );
    return rows.map((row) => {
      const offer = offers.get(row.variant.productId);
      return offer
        ? {
            ...row,
            variant: {
              ...row.variant,
              originalPriceLkrMinor: row.variant.priceLkrMinor,
              priceLkrMinor: discountedMinor(
                row.variant.priceLkrMinor,
                offer.discountBps,
              ),
              promotionId: offer.id,
              promotionDiscountBps: offer.discountBps,
            },
          }
        : row;
    });
  }
}
