import type { DecodedIdToken } from 'firebase-admin/auth';
import type { ConfigService } from '@nestjs/config';
import type { AuthService } from '../auth/auth.service.js';
import type { CatalogService } from '../catalog/catalog.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import { ConflictException } from '@nestjs/common';
import { CommerceService } from './commerce.service.js';

describe('Seller order lifecycle', () => {
  const sellerOrderId = '3f0f8f7e-9c1d-4c55-9a43-5d5f2a3b8e11';
  const identity = { uid: 'uid', email_verified: true } as DecodedIdToken;
  let current: Record<string, unknown>;
  const tx = {
    $queryRaw: vi.fn(),
    sellerOrder: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
    },
    productVariant: { update: vi.fn() },
    inventoryMovement: { create: vi.fn() },
    sellerShipment: { create: vi.fn(), update: vi.fn() },
    shipmentChange: { create: vi.fn() },
    sellerOrderEvent: { create: vi.fn() },
    commissionCharge: { createMany: vi.fn(), create: vi.fn() },
    order: { findFirst: vi.fn() },
  };
  const prisma = { ...tx, $transaction: vi.fn() };
  const notifications = { forUser: vi.fn(), forSeller: vi.fn() };
  const catalog = { requireSellerMember: vi.fn() };
  const audit = { actor: vi.fn(), record: vi.fn() };
  const config = {
    get: (key: string) => (key === 'SELLER_ACCEPT_HOURS' ? 48 : undefined),
  };
  const service = new CommerceService(
    prisma as unknown as PrismaService,
    {
      getOrCreateProfile: async () => ({ id: 'buyer-id' }),
    } as unknown as AuthService,
    catalog as unknown as CatalogService,
    notifications as unknown as NotificationsService,
    config as unknown as ConfigService,
    audit as unknown as AuditService,
  );
  const order = (status: string, extra: Record<string, unknown> = {}) => ({
    id: sellerOrderId,
    orderId: 'order-1',
    sellerId: 'seller-1',
    status,
    items: [
      { id: 'item-1', variantId: 'variant-1', quantity: 2 },
      { id: 'item-2', variantId: 'variant-2', quantity: 1 },
    ],
    shipment: null,
    order: { buyerId: 'buyer-id' },
    ...extra,
  });

  beforeEach(() => {
    vi.resetAllMocks();
    prisma.$transaction.mockImplementation((fn: (db: typeof tx) => unknown) =>
      fn(tx),
    );
    tx.$queryRaw.mockResolvedValue([{ id: sellerOrderId }]);
    current = order('PLACED');
    tx.sellerOrder.findFirst.mockImplementation(() => Promise.resolve(current));
    tx.sellerOrder.updateMany.mockResolvedValue({ count: 1 });
    tx.sellerOrder.findUniqueOrThrow.mockImplementation(() =>
      Promise.resolve({
        ...current,
        status: 'DELIVERED',
        paymentCollectedAt: new Date('2026-11-01T00:00:00Z'),
        commissionRateBps: null,
        items: [
          {
            id: 'item-1',
            lineLkrMinor: 10_000,
            commissionRateBps: 1_000,
            commissionAmountMinor: 1_000,
            commissionPaymentDays: 14,
          },
        ],
      }),
    );
    tx.sellerShipment.update.mockResolvedValue({
      id: 'shipment-1',
      version: 2,
    });
    tx.sellerShipment.create.mockResolvedValue({
      id: 'shipment-1',
      version: 1,
    });
    catalog.requireSellerMember.mockResolvedValue({ id: 'seller-user' });
    audit.actor.mockResolvedValue({ id: 'admin-id', email: 'admin@x.lk' });
    tx.order.findFirst.mockResolvedValue({ id: 'order-1', sellerOrders: [] });
  });

  it('delivers a shipped order with payment collection and accrues commission once', async () => {
    current = order('SHIPPED');
    await service.sellerStatus('seller-1', sellerOrderId, identity, {
      status: 'DELIVERED',
      paymentCollected: true,
    });
    expect(catalog.requireSellerMember).toHaveBeenCalledWith(
      'seller-1',
      identity,
      true,
      { allowSuspended: true },
    );
    expect(tx.sellerOrder.updateMany).toHaveBeenCalledWith({
      where: { id: sellerOrderId, status: 'SHIPPED' },
      data: expect.objectContaining({
        status: 'DELIVERED',
        statusReason: null,
        statusChangedAt: expect.any(Date),
        paymentCollectedAt: expect.any(Date),
      }),
    });
    expect(tx.commissionCharge.createMany).toHaveBeenCalledOnce();
    expect(tx.productVariant.update).not.toHaveBeenCalled();
    expect(tx.sellerOrderEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromStatus: 'SHIPPED',
        toStatus: 'DELIVERED',
        actorUserId: 'seller-user',
      }),
    });
  });

  it('restores every item when a seller cancels with a reason', async () => {
    current = order('ACCEPTED');
    await service.sellerStatus('seller-1', sellerOrderId, identity, {
      status: 'CANCELLED',
      reason: 'Item damaged in storage',
    });
    expect(tx.productVariant.update).toHaveBeenCalledWith({
      where: { id: 'variant-1' },
      data: { onHand: { increment: 2 } },
    });
    expect(tx.productVariant.update).toHaveBeenCalledWith({
      where: { id: 'variant-2' },
      data: { onHand: { increment: 1 } },
    });
    expect(tx.inventoryMovement.create).toHaveBeenCalledTimes(2);
    expect(tx.sellerOrderEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ reason: 'Item damaged in storage' }),
    });
    expect(tx.commissionCharge.createMany).not.toHaveBeenCalled();
    expect(notifications.forUser).toHaveBeenCalledWith(
      tx,
      'buyer-id',
      'ORDER_UPDATED',
      sellerOrderId,
      expect.stringContaining('cancelled'),
      '/orders?order=order-1',
      { audience: 'BUYER', orderStatus: 'CANCELLED' },
    );
  });

  it.each(['CANCELLED', 'DELIVERY_FAILED', 'RETURNED_TO_SELLER'] as const)(
    'requires a reason for %s before any write',
    async (status) => {
      await expect(
        service.sellerStatus('seller-1', sellerOrderId, identity, { status }),
      ).rejects.toMatchObject({ status: 400 });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it('records a failed delivery and restores stock when the parcel returns', async () => {
    current = order('SHIPPED');
    await service.sellerStatus('seller-1', sellerOrderId, identity, {
      status: 'DELIVERY_FAILED',
      reason: 'Customer refused parcel',
    });
    expect(tx.productVariant.update).not.toHaveBeenCalled();
    current = order('DELIVERY_FAILED');
    await service.sellerStatus('seller-1', sellerOrderId, identity, {
      status: 'RETURNED_TO_SELLER',
      reason: 'Parcel back at the shop',
    });
    expect(tx.productVariant.update).toHaveBeenCalledTimes(2);
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        delta: 2,
        reason: `COD seller order ${sellerOrderId} returned to seller`,
      }),
    });
    expect(tx.commissionCharge.createMany).not.toHaveBeenCalled();
  });

  it('re-ships a failed delivery and versions the existing shipment', async () => {
    current = order('DELIVERY_FAILED', {
      shipment: {
        id: 'shipment-1',
        courierName: 'Domex',
        trackingNumber: 'A1',
        version: 1,
      },
    });
    await service.sellerStatus('seller-1', sellerOrderId, identity, {
      status: 'SHIPPED',
      courierName: 'Pronto',
      trackingNumber: 'B2',
    });
    expect(tx.sellerShipment.create).not.toHaveBeenCalled();
    expect(tx.sellerShipment.update).toHaveBeenCalledWith({
      where: { id: 'shipment-1' },
      data: {
        courierName: 'Pronto',
        trackingNumber: 'B2',
        version: { increment: 1 },
      },
    });
    expect(tx.shipmentChange.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        version: 2,
        before: { courierName: 'Domex', trackingNumber: 'A1' },
      }),
    });
  });

  it('refuses a transition the actor may not make without writing anything', async () => {
    current = order('SHIPPED');
    const error = await service
      .sellerStatus('seller-1', sellerOrderId, identity, {
        status: 'CANCELLED',
        reason: 'Changed my mind',
      })
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({
      status: 409,
      response: expect.objectContaining({
        code: 'ORDER_TRANSITION_NOT_ALLOWED',
      }),
    });
    expect(tx.sellerOrder.updateMany).not.toHaveBeenCalled();
    expect(tx.sellerOrderEvent.create).not.toHaveBeenCalled();
  });

  it('lets the buyer confirm receipt of a shipped order and notifies only the seller', async () => {
    current = order('SHIPPED');
    const result = await service.confirmReceipt(
      identity,
      'order-1',
      sellerOrderId,
    );
    expect(tx.sellerOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: sellerOrderId,
          orderId: 'order-1',
          order: { buyerId: 'buyer-id' },
        },
      }),
    );
    expect(tx.sellerOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'DELIVERED',
          paymentCollectedAt: expect.any(Date),
        }),
      }),
    );
    expect(tx.commissionCharge.createMany).toHaveBeenCalledOnce();
    expect(notifications.forUser).not.toHaveBeenCalled();
    expect(notifications.forSeller).toHaveBeenCalledWith(
      tx,
      'seller-1',
      'ORDER_UPDATED',
      sellerOrderId,
      expect.stringContaining('Buyer confirmed receipt'),
      `/seller/orders?order=${sellerOrderId}`,
    );
    expect(result).toEqual({ id: 'order-1', sellerOrders: [] });
  });

  it('allows buyer receipt confirmation only from SHIPPED', async () => {
    current = order('PLACED');
    await expect(
      service.confirmReceipt(identity, 'order-1', sellerOrderId),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('lets a buyer cancel before acceptance with a default reason', async () => {
    current = order('PLACED');
    await service.buyerCancel(identity, 'order-1', sellerOrderId);
    expect(tx.sellerOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'CANCELLED',
          statusReason: 'Cancelled by the buyer',
        }),
      }),
    );
  });

  it('applies admin actions with an audit entry', async () => {
    current = order('SHIPPED');
    tx.sellerOrder.findUniqueOrThrow.mockResolvedValue({
      id: sellerOrderId,
      status: 'RETURNED_TO_SELLER',
    });
    const row = await service.adminAction(identity, sellerOrderId, {
      action: 'MARK_RETURNED',
      reason: 'Courier returned the parcel',
    });
    expect(row).toMatchObject({ status: 'RETURNED_TO_SELLER' });
    expect(tx.productVariant.update).toHaveBeenCalledTimes(2);
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      { id: 'admin-id', email: 'admin@x.lk' },
      expect.objectContaining({
        action: 'ORDER_MARK_RETURNED',
        subjectId: sellerOrderId,
        details: { from: 'SHIPPED', to: 'RETURNED_TO_SELLER' },
      }),
    );
  });

  it('refuses admin actions outside the allowed table', async () => {
    current = order('DELIVERY_FAILED');
    await expect(
      service.adminAction(identity, sellerOrderId, {
        action: 'MARK_DELIVERY_FAILED',
        reason: 'Second failure',
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('auto-cancels only PLACED orders older than the accept window', async () => {
    const now = new Date('2026-11-10T12:00:00.000Z');
    prisma.sellerOrder.findMany.mockResolvedValue([
      { id: sellerOrderId },
      { id: 'raced-order' },
    ]);
    let calls = 0;
    tx.sellerOrder.findFirst.mockImplementation(() => {
      calls++;
      // The second order was accepted by its seller a moment ago.
      return Promise.resolve(calls === 1 ? order('PLACED') : order('ACCEPTED'));
    });
    const result = await service.autoCancelDue(50, now);
    expect(prisma.sellerOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'PLACED',
          statusChangedAt: { lt: new Date('2026-11-08T12:00:00.000Z') },
        },
        take: 50,
      }),
    );
    expect(result).toEqual({ processed: 2, cancelled: 1 });
    expect(tx.sellerOrderEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: null,
        toStatus: 'CANCELLED',
        reason: 'Seller did not accept the order in time',
      }),
    });
    expect(tx.productVariant.update).toHaveBeenCalledTimes(2);
  });

  it('reports a concurrent status change as a conflict', async () => {
    current = order('PLACED');
    tx.sellerOrder.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.sellerStatus('seller-1', sellerOrderId, identity, {
        status: 'ACCEPTED',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
