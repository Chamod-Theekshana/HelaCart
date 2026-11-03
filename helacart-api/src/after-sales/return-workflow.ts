import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { ConfigService } from '@nestjs/config';
import type { AuthService } from '../auth/auth.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { RequestReturnDto } from '../operations/operations.dto.js';
import { Prisma } from '../generated/prisma/client.js';
const txOptions = { timeout: 30000, maxWait: 10000 } as const;
const orderInclude = {
  items: true,
  events: {
    where: { toStatus: 'DELIVERED' as const },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
  },
  returnRequests: { include: { items: true } },
} as const;
type ReturnOrder = Prisma.SellerOrderGetPayload<{
  include: typeof orderInclude;
}>;
export function remainingReturns(order: ReturnOrder) {
  return order.items.map((item) => {
    const reserved = order.returnRequests
      .filter((r) => r.status !== 'REJECTED')
      .reduce(
        (sum, r) =>
          sum +
          (r.items.length
            ? r.items
                .filter((i) => i.orderItemId === item.id)
                .reduce((s, i) => s + i.quantity, 0)
            : item.quantity),
        0,
      );
    return {
      orderItemId: item.id,
      productTitle: item.productTitle,
      sku: item.sku,
      quantity: item.quantity,
      unitMinor: item.unitLkrMinor,
      remainingQuantity: Math.max(0, item.quantity - reserved),
    };
  });
}
export async function returnOptions(
  prisma: PrismaService,
  auth: AuthService,
  config: ConfigService,
  identity: DecodedIdToken,
  sellerOrderId: string,
) {
  if (!identity.email_verified)
    throw new ForbiddenException(
      'Verify your email before requesting a return',
    );
  const user = await auth.getOrCreateProfile(identity),
    order = await prisma.sellerOrder.findFirst({
      where: { id: sellerOrderId, order: { buyerId: user.id } },
      include: orderInclude,
    });
  if (!order) throw new NotFoundException('Order not found');
  const deliveredAt = order.events[0]?.createdAt ?? order.paymentCollectedAt;
  const closesAt = deliveredAt
    ? new Date(
        deliveredAt.getTime() +
          config.getOrThrow<number>('RETURN_WINDOW_DAYS') * 86400000,
      )
    : null;
  const eligible =
    order.status === 'DELIVERED' &&
    closesAt != null &&
    closesAt.getTime() >= Date.now();
  return { sellerOrderId, eligible, closesAt, items: remainingReturns(order) };
}
export async function requestItemReturn(
  prisma: PrismaService,
  auth: AuthService,
  notifications: NotificationsService,
  config: ConfigService,
  identity: DecodedIdToken,
  dto: RequestReturnDto,
) {
  if (!identity.email_verified)
    throw new ForbiddenException(
      'Verify your email before requesting a return',
    );
  const buyer = await auth.getOrCreateProfile(identity);
  const verifyRetry = (
    row: Prisma.ReturnRequestGetPayload<{ include: { items: true } }>,
  ) => {
    const wanted = dto.items
      ?.map((i) => `${i.orderItemId}:${i.quantity}`)
      .sort();
    if (
      row.sellerOrderId !== dto.sellerOrderId ||
      row.reason !== dto.reason ||
      (wanted &&
        JSON.stringify(wanted) !==
          JSON.stringify(
            row.items.map((i) => `${i.orderItemId}:${i.quantity}`).sort(),
          ))
    )
      throw new ConflictException(
        'Return request key was used for different details',
      );
    return row;
  };
  return prisma.$transaction(async (tx) => {
    if (dto.requestKey) {
      const previous = await tx.returnRequest.findUnique({
        where: {
          buyerId_requestKey: { buyerId: buyer.id, requestKey: dto.requestKey },
        },
        include: { items: true },
      });
      if (previous) return verifyRetry(previous);
    }
    const locked = await tx.$queryRaw<
      { id: string }[]
    >`SELECT so.id FROM "SellerOrder" so JOIN "Order" o ON o.id=so."orderId" WHERE so.id=${dto.sellerOrderId}::uuid AND o."buyerId"=${buyer.id}::uuid FOR UPDATE OF so`;
    if (!locked.length)
      throw new NotFoundException(
        'Eligible delivered seller order not found within return window',
      );
    if (dto.requestKey) {
      const previous = await tx.returnRequest.findUnique({
        where: {
          buyerId_requestKey: { buyerId: buyer.id, requestKey: dto.requestKey },
        },
        include: { items: true },
      });
      if (previous) return verifyRetry(previous);
    }
    const order = await tx.sellerOrder.findUniqueOrThrow({
      where: { id: dto.sellerOrderId },
      include: orderInclude,
    });
    const deliveredAt = order.events[0]?.createdAt ?? order.paymentCollectedAt;
    if (
      order.status !== 'DELIVERED' ||
      !deliveredAt ||
      deliveredAt.getTime() +
        config.getOrThrow<number>('RETURN_WINDOW_DAYS') * 86400000 <
        Date.now()
    )
      throw new NotFoundException(
        'Eligible delivered seller order not found within return window',
      );
    const remaining = remainingReturns(order),
      items =
        dto.items ??
        remaining
          .filter((i) => i.remainingQuantity > 0)
          .map((i) => ({
            orderItemId: i.orderItemId,
            quantity: i.remainingQuantity,
          }));
    if (!items.length)
      throw new ConflictException(
        'No items remain eligible for another return request',
      );
    for (const item of items) {
      const original = remaining.find(
        (i) => i.orderItemId === item.orderItemId,
      );
      if (
        !original ||
        item.quantity < 1 ||
        item.quantity > original.remainingQuantity
      )
        throw new ConflictException(
          'Requested quantity exceeds this order item’s remaining return quantity',
        );
    }
    const created = await tx.returnRequest.create({
      data: {
        sellerOrderId: order.id,
        buyerId: buyer.id,
        requestKey: dto.requestKey,
        reason: dto.reason,
        items: {
          create: items.map((i) => ({
            orderItemId: i.orderItemId,
            quantity: i.quantity,
            baseMinor:
              order.items.find((o) => o.id === i.orderItemId)!.unitLkrMinor *
              i.quantity,
          })),
        },
      },
      include: { items: true },
    });
    await notifications.forSeller(
      tx,
      order.sellerId,
      'RETURN_REQUESTED',
      created.id,
      'A buyer requested an item return',
      `/seller/returns?return=${created.id}`,
    );
    await notifications.forAdmins(
      tx,
      'RETURN_REQUESTED',
      created.id,
      'An item return requires review',
      `/admin/returns?return=${created.id}`,
    );
    await notifications.forUser(
      tx,
      buyer.id,
      'RETURN_REQUESTED',
      created.id,
      'Your item return request was submitted',
      '/account/returns',
    );
    return created;
  }, txOptions);
}
