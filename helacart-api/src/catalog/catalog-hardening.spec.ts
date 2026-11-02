import type { DecodedIdToken } from 'firebase-admin/auth';
import type { ConfigService } from '@nestjs/config';
import type { AuthService } from '../auth/auth.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import { CatalogService } from './catalog.service.js';

const errorCode = (fn: () => void) => {
  try {
    fn();
  } catch (error) {
    return (error as { response?: { code?: string } }).response?.code;
  }
  return undefined;
};

describe('Catalog hardening', () => {
  const identity = {
    uid: 'admin',
    email: 'admin@helacart.lk',
    email_verified: true,
  } as DecodedIdToken;
  const productId = '0a4b8c2d-6e1f-4a3b-9c5d-7e8f9a0b1c2d';
  const tx = {
    product: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    commissionPolicy: { findUnique: vi.fn() },
    productCommissionChange: { create: vi.fn() },
    productReview: { create: vi.fn() },
  };
  const prisma = {
    ...tx,
    sellerMember: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  };
  const audit = { record: vi.fn(), actor: vi.fn() };
  const settings: Record<string, unknown> = {};
  const service = new CatalogService(
    prisma as unknown as PrismaService,
    {
      getOrCreateProfile: async () => ({
        id: 'admin-id',
        email: 'admin@helacart.lk',
      }),
    } as unknown as AuthService,
    { get: (key: string) => settings[key] } as unknown as ConfigService,
    audit as unknown as AuditService,
  );

  beforeEach(() => {
    vi.resetAllMocks();
    for (const key of Object.keys(settings)) delete settings[key];
    prisma.$transaction.mockImplementation((fn: (db: typeof tx) => unknown) =>
      fn(tx),
    );
    tx.product.findUnique.mockResolvedValue({
      status: 'PENDING',
      imageUrls: ['https://images.helacart.lk/p.jpg'],
      commissionRateBps: null,
      commissionVersion: 0,
    });
    tx.product.updateMany.mockResolvedValue({ count: 1 });
    tx.product.findUniqueOrThrow.mockResolvedValue({ id: productId });
  });

  it('requires a commission rate to approve while the policy is enabled', async () => {
    tx.commissionPolicy.findUnique.mockResolvedValue({ enabled: true });
    await expect(
      service.reviewProduct(productId, identity, 'APPROVED'),
    ).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({ code: 'COMMISSION_RATE_REQUIRED' }),
    });
    expect(tx.product.updateMany).not.toHaveBeenCalled();
    expect(tx.productReview.create).not.toHaveBeenCalled();
  });

  it('saves a supplied rate with history and audit in the approval transaction', async () => {
    tx.commissionPolicy.findUnique.mockResolvedValue({ enabled: true });
    await service.reviewProduct(
      productId,
      identity,
      'APPROVED',
      undefined,
      750,
    );
    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: productId, commissionVersion: 0 },
      data: { commissionRateBps: 750, commissionVersion: 1 },
    });
    expect(tx.productCommissionChange.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId,
        version: 1,
        beforeRateBps: null,
        rateBps: 750,
        actorId: 'admin-id',
      }),
    });
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      { id: 'admin-id', email: 'admin@helacart.lk' },
      expect.objectContaining({ action: 'COMMISSION_RATE_CHANGE' }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.anything(),
      expect.objectContaining({
        action: 'PRODUCT_APPROVE',
        subjectId: productId,
      }),
    );
  });

  it('approves without a rate when the policy is disabled or a rate exists', async () => {
    tx.commissionPolicy.findUnique.mockResolvedValue({ enabled: false });
    await service.reviewProduct(productId, identity, 'APPROVED');
    tx.commissionPolicy.findUnique.mockResolvedValue({ enabled: true });
    tx.product.findUnique.mockResolvedValue({
      status: 'PENDING',
      imageUrls: ['https://images.helacart.lk/p.jpg'],
      commissionRateBps: 500,
      commissionVersion: 2,
    });
    await service.reviewProduct(productId, identity, 'APPROVED');
    expect(tx.productCommissionChange.create).not.toHaveBeenCalled();
    expect(tx.productReview.create).toHaveBeenCalledTimes(2);
  });

  describe('seller access', () => {
    const seller = { ...identity, uid: 'seller' } as DecodedIdToken;
    it.each([
      ['SUSPENDED', 'MANAGER', {}, 'SELLER_SUSPENDED'],
      ['APPROVED', 'MANAGER', { ownerOnly: true }, 'OWNER_ONLY'],
      ['SUSPENDED', 'OWNER', { ownerOnly: true }, 'SELLER_SUSPENDED'],
    ] as const)(
      'rejects a %s shop %s with %j as %s',
      async (status, role, options, code) => {
        prisma.sellerMember.findUnique.mockResolvedValue({
          role,
          seller: { status },
        });
        await expect(
          service.requireSellerMember('shop', seller, true, options),
        ).rejects.toMatchObject({
          status: 403,
          response: expect.objectContaining({ code }),
        });
      },
    );

    it('keeps read routes and order fulfilment open for a suspended shop', async () => {
      prisma.sellerMember.findUnique.mockResolvedValue({
        role: 'MANAGER',
        seller: { status: 'SUSPENDED' },
      });
      await expect(
        service.requireSellerMember('shop', seller, false),
      ).resolves.toMatchObject({ id: 'admin-id' });
      await expect(
        service.requireSellerMember('shop', seller, true, {
          allowSuspended: true,
        }),
      ).resolves.toMatchObject({ id: 'admin-id' });
    });
  });

  it('accepts only product images hosted on R2_PUBLIC_BASE_URL', () => {
    settings.R2_PUBLIC_BASE_URL = 'https://images.helacart.lk';
    expect(() =>
      service.assertImageUrlsAllowed([
        'https://images.helacart.lk/products/a.jpg',
      ]),
    ).not.toThrow();
    for (const url of [
      'https://evil.example/products/a.jpg',
      'https://images.helacart.lk.evil.example/a.jpg',
      'http://images.helacart.lk/a.jpg',
      'https://user@images.helacart.lk/a.jpg',
    ])
      expect(errorCode(() => service.assertImageUrlsAllowed([url]))).toBe(
        'IMAGE_URL_NOT_ALLOWED',
      );
    delete settings.R2_PUBLIC_BASE_URL;
    settings.NODE_ENV = 'production';
    expect(() =>
      service.assertImageUrlsAllowed(['https://images.helacart.lk/a.jpg']),
    ).toThrow();
    settings.NODE_ENV = 'development';
    expect(() =>
      service.assertImageUrlsAllowed(['https://anywhere.example/a.jpg']),
    ).not.toThrow();
  });
});
