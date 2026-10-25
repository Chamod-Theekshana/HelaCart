import {
  commissionMinor,
  commissionSnapshot,
  itemCommissionSnapshot,
  accrueCommission,
} from './commission-ledger.js';
import type { Prisma } from '../generated/prisma/client.js';
import { CommissionReceiptsService } from './commission-receipts.service.js';
import type { ConfigService } from '@nestjs/config';
describe('Commission money and eligibility rules', () => {
  it.each([
    [1000000, 500, 50000],
    [101, 500, 5],
    [1, 500, 0],
    [10, 500, 1],
    [1000000000, 10000, 1000000000],
    [999999999, 3333, 333300000],
    [0, 10000, 0],
  ])('rounds %i minor units at %i bps to %i', (base, rate, expected) => {
    expect(commissionMinor(base, rate)).toBe(expected);
  });
  it.each([
    [-1, 500],
    [1.2, 500],
    [100, 10001],
    [100, -1],
    [Number.MAX_SAFE_INTEGER + 1, 100],
  ])('rejects invalid financial input %s/%s', (base, rate) => {
    expect(() => commissionMinor(base, rate)).toThrow(RangeError);
  });
  it('uses the default 14 days without a settings record', async () => {
    const tx = {
      commissionPolicy: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    expect(
      await commissionSnapshot(tx as unknown as Prisma.TransactionClient),
    ).toEqual({ commissionPolicyVersion: 0, commissionPaymentDays: 14 });
  });
  it('saves settings without applying the obsolete common rate', async () => {
    const tx = {
      commissionPolicy: {
        findUnique: vi.fn().mockResolvedValue({
          enabled: true,
          rateBps: 725,
          paymentDays: 7,
          version: 3,
        }),
      },
    };
    expect(
      await commissionSnapshot(tx as unknown as Prisma.TransactionClient),
    ).toEqual({
      commissionPaymentDays: 7,
      commissionPolicyVersion: 3,
    });
  });
  it('keeps unassigned products inactive and snapshots assigned zero rates', () => {
    const terms = { commissionPaymentDays: 14, commissionPolicyVersion: 2 };
    expect(
      itemCommissionSnapshot({ commissionRateBps: null }, 100000, terms),
    ).toEqual({});
    expect(
      itemCommissionSnapshot(
        { commissionRateBps: 0, commissionVersion: 1 },
        100000,
        terms,
      ),
    ).toMatchObject({
      commissionRateBps: 0,
      commissionAmountMinor: 0,
      commissionProductVersion: 1,
      ...terms,
    });
    expect(
      itemCommissionSnapshot(
        { commissionRateBps: 725, commissionVersion: 3 },
        20001,
        terms,
      ),
    ).toMatchObject({
      commissionRateBps: 725,
      commissionAmountMinor: 1450,
      commissionProductVersion: 3,
      ...terms,
    });
  });
  it('charges different item rates with due dates exactly 14 days from delivery', async () => {
    const create = vi.fn(),
      collected = new Date('2026-10-01T10:00:00Z');
    const tx = {
      sellerOrder: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          sellerId: 'shop',
          status: 'DELIVERED',
          paymentCollectedAt: collected,
          items: [
            {
              id: 'item-a',
              lineLkrMinor: 20000,
              commissionRateBps: 500,
              commissionAmountMinor: 1000,
              commissionPaymentDays: 14,
            },
            {
              id: 'item-b',
              lineLkrMinor: 30000,
              commissionRateBps: 1000,
              commissionAmountMinor: 3000,
              commissionPaymentDays: 14,
            },
            { id: 'item-c', lineLkrMinor: 10000, commissionRateBps: null },
            {
              id: 'item-d',
              lineLkrMinor: 10000,
              commissionRateBps: 0,
              commissionAmountMinor: 0,
              commissionPaymentDays: 14,
            },
          ],
        }),
      },
      commissionCharge: { createMany: create },
    };
    await accrueCommission(tx as unknown as Prisma.TransactionClient, 'order');
    expect(create).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          orderItemId: 'item-a',
          amountMinor: 1000,
          rateBps: 500,
          holdUntil: new Date('2026-10-15T10:00:00Z'),
          dueAt: new Date('2026-10-15T10:00:00Z'),
        }),
        expect.objectContaining({
          orderItemId: 'item-b',
          amountMinor: 3000,
          rateBps: 1000,
        }),
      ],
    });
  });
  it.each([
    {
      status: 'CANCELLED',
      paymentCollectedAt: new Date(),
      commissionRateBps: 500,
    },
    { status: 'DELIVERED', paymentCollectedAt: null, commissionRateBps: 500 },
    {
      status: 'DELIVERED',
      paymentCollectedAt: new Date(),
      commissionRateBps: null,
    },
  ])('does not charge an ineligible order', async (order) => {
    const create = vi.fn();
    const tx = {
      sellerOrder: { findUniqueOrThrow: vi.fn().mockResolvedValue(order) },
      commissionCharge: { create },
    };
    await accrueCommission(tx as unknown as Prisma.TransactionClient, 'order');
    expect(create).not.toHaveBeenCalled();
  });
  it('uses merchandise, the saved rate and saved terms after delivery', async () => {
    const collected = new Date('2026-10-01T10:00:00Z'),
      create = vi.fn();
    const tx = {
      sellerOrder: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          sellerId: 'shop',
          status: 'DELIVERED',
          paymentCollectedAt: collected,
          subtotalLkrMinor: 1000000,
          shippingLkrMinor: 35000,
          commissionRateBps: 500,
          commissionReturnDays: 14,
          commissionPaymentDays: 7,
        }),
      },
      commissionCharge: { create },
    };
    await accrueCommission(tx as unknown as Prisma.TransactionClient, 'order');
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amountMinor: 50000,
        baseMinor: 1000000,
        holdUntil: new Date('2026-10-15T10:00:00Z'),
        dueAt: new Date('2026-10-22T10:00:00Z'),
      }),
    });
  });
});
describe('Private commission receipt input', () => {
  const service = new CommissionReceiptsService({} as ConfigService);
  it('requires a receipt', () => {
    expect(() => service.validate()).toThrow();
  });
  it('rejects a claimed image whose bytes are not an image', () => {
    expect(() =>
      service.validate({
        buffer: Buffer.from('not an image'),
        size: 12,
        mimetype: 'image/png',
      }),
    ).toThrow();
  });
  it('rejects non-image documents', () => {
    const buffer = Buffer.from('%PDF-1.7');
    expect(() =>
      service.validate({
        buffer,
        size: buffer.length,
        mimetype: 'application/pdf',
      }),
    ).toThrow();
  });
  it('rejects oversized images', () => {
    const buffer = Buffer.alloc(5 * 1024 * 1024 + 1);
    expect(() =>
      service.validate({ buffer, size: buffer.length, mimetype: 'image/png' }),
    ).toThrow();
  });
  it('accepts matching PNG bytes', () => {
    const buffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5ncAAAAASUVORK5CYII=',
      'base64',
    );
    expect(() =>
      service.validate({ buffer, size: buffer.length, mimetype: 'image/png' }),
    ).not.toThrow();
  });
});
