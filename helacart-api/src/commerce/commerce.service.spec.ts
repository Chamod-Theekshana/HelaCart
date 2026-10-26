import type { DecodedIdToken } from 'firebase-admin/auth';
import type { AuthService } from '../auth/auth.service.js';
import type { CatalogService } from '../catalog/catalog.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { CommerceService } from './commerce.service.js';
import { Prisma } from '../generated/prisma/client.js';
describe('Reviewed COD checkout', () => {
  const identity = { uid: 'buyer', email_verified: true } as DecodedIdToken;
  const db = {
    cartItem: { findMany: vi.fn(), deleteMany: vi.fn() },
    buyerAddress: { findFirst: vi.fn() },
    order: { findUnique: vi.fn(), create: vi.fn() },
    inventoryMovement: { createMany: vi.fn() },
    commissionPolicy: { findUnique: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  };
  const notices = {
    forUser: vi.fn(),
    forSeller: vi.fn(),
    forAdmins: vi.fn(),
    forSellerOrders: vi.fn(),
  };
  const service = new CommerceService(
    db as unknown as PrismaService,
    {
      getOrCreateProfile: async () => ({ id: 'buyer-id' }),
    } as unknown as AuthService,
    {} as CatalogService,
    notices as unknown as NotificationsService,
  );
  const row = () => ({
    variantId: 'variant-a',
    quantity: 2,
    variant: {
      id: 'variant-a',
      productId: 'product-a',
      sellerId: 'seller-a',
      sku: 'SKU-A',
      priceLkrMinor: 10000,
      onHand: 5,
      reserved: 0,
      optionValues: { size: 'M' },
      product: {
        title: 'Cotton shirt',
        imageUrls: ['https://images.example/shirt.png'],
        status: 'APPROVED',
        category: { isActive: true },
        seller: {
          id: 'seller-a',
          name: 'Island shop',
          slug: 'island-shop',
          status: 'APPROVED',
          shippingFeeLkrMinor: 5000,
          deliveryRules: [] as {
            district: string;
            available: boolean;
            feeMinor: number;
          }[],
          freeShippingThresholdMinor: null as number | null,
          deliveryMinDays: null as number | null,
          deliveryMaxDays: null as number | null,
          deliveryRevision: 0,
        },
      },
    },
  });
  let rows: ReturnType<typeof row>[];
  beforeEach(() => {
    vi.resetAllMocks();
    db.commissionPolicy.findUnique.mockResolvedValue(null);
    rows = [row()];
    db.cartItem.findMany.mockImplementation(() => Promise.resolve(rows));
    db.order.findUnique.mockResolvedValue(null);
    db.buyerAddress.findFirst.mockResolvedValue({
      id: 'address-a',
      recipient: 'Buyer',
      line1: 'Address',
      city: 'Kandy',
      district: 'Kandy',
    });
    db.$queryRaw.mockResolvedValue([{ id: 'variant-a' }]);
    db.$transaction.mockImplementation((callback: (tx: typeof db) => unknown) =>
      callback(db),
    );
    db.order.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          ...data,
          id: 'order-a',
          sellerOrders: [{ id: 'seller-order-a', sellerId: 'seller-a' }],
        }),
    );
  });
  it('quotes server prices and includes real shop branding and delivery', async () => {
    const cart = await service.cart(identity);
    expect(cart.checkoutQuote).toMatch(/^[a-f0-9]{64}$/);
    expect(cart).toMatchObject({
      subtotalLkrMinor: 20000,
      shippingLkrMinor: 5000,
      totalLkrMinor: 25000,
      canCheckout: true,
    });
    expect(cart.items[0]).toMatchObject({
      sellerName: 'Island shop',
      sellerSlug: 'island-shop',
      imageUrl: 'https://images.example/shirt.png',
      shippingFeeLkrMinor: 5000,
    });
  });
  it('charges delivery once for each shop', async () => {
    rows.push({ ...row(), variantId: 'variant-b' });
    expect((await service.cart(identity)).shippingLkrMinor).toBe(5000);
  });
  it('quotes district delivery for an owned address and binds the quote to it', async () => {
    rows[0].variant.product.seller.deliveryRules = [
      { district: 'Kandy', available: true, feeMinor: 7000 },
    ];
    const generic = await service.cart(identity),
      quoted = await service.cart(identity, 'address-a');
    expect(quoted).toMatchObject({
      addressId: 'address-a',
      shippingLkrMinor: 7000,
      deliveryQuoted: true,
    });
    expect(quoted.checkoutQuote).not.toBe(generic.checkoutQuote);
    await expect(
      service.checkout(identity, {
        addressId: 'address-a',
        checkoutKey: 'key-a',
        quote: generic.checkoutQuote,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(db.order.create).not.toHaveBeenCalled();
    await service.checkout(identity, {
      addressId: 'address-a',
      checkoutKey: 'key-a',
      quote: quoted.checkoutQuote,
    });
    expect(db.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shippingLkrMinor: 7000,
          sellerOrders: expect.objectContaining({
            create: [
              expect.objectContaining({
                shippingLkrMinor: 7000,
                deliveryDistrict: 'Kandy',
              }),
            ],
          }),
        }),
      }),
    );
  });
  it('blocks unavailable districts even when free delivery qualifies', async () => {
    rows[0].variant.product.seller.deliveryRules = [
      { district: 'Kandy', available: false, feeMinor: 5000 },
    ];
    rows[0].variant.product.seller.freeShippingThresholdMinor = 1;
    const quote = await service.cart(identity, 'address-a');
    expect(quote.canCheckout).toBe(false);
    await expect(
      service.checkout(identity, {
        addressId: 'address-a',
        checkoutKey: 'key-a',
        quote: quote.checkoutQuote,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
  it('rejects an address outside the buyer account', async () => {
    db.buyerAddress.findFirst.mockResolvedValue(null);
    await expect(service.cart(identity, 'other-address')).rejects.toMatchObject(
      { status: 404 },
    );
  });
  it.each(['price', 'delivery', 'quantity'])(
    'refuses a changed %s before stock or order writes',
    async (change) => {
      const quote = (await service.cart(identity)).checkoutQuote;
      if (change === 'price') rows[0].variant.priceLkrMinor++;
      if (change === 'delivery')
        rows[0].variant.product.seller.shippingFeeLkrMinor++;
      if (change === 'quantity') rows[0].quantity++;
      await expect(
        service.checkout(identity, {
          addressId: 'address-a',
          checkoutKey: 'key-a',
          quote,
        }),
      ).rejects.toMatchObject({ status: 409 });
      expect(db.$queryRaw).not.toHaveBeenCalled();
      expect(db.order.create).not.toHaveBeenCalled();
    },
  );
  it('deducts stock and records an order, movement, cart cleanup and notifications together', async () => {
    const quote = (await service.cart(identity)).checkoutQuote;
    await service.checkout(identity, {
      addressId: 'address-a',
      checkoutKey: 'key-a',
      quote,
    });
    expect(db.$transaction).toHaveBeenCalledOnce();
    expect(db.inventoryMovement.createMany).toHaveBeenCalledWith({
      data: [
        {
          variantId: 'variant-a',
          actorUserId: 'buyer-id',
          delta: -2,
          reason: 'COD order order-a placed',
        },
      ],
    });
    expect(db.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'buyer-id' },
    });
    expect(notices.forUser).toHaveBeenCalledOnce();
    expect(notices.forSellerOrders).toHaveBeenCalledOnce();
  });
  it('retries the same checkout without charging stock twice, even after the cart is cleared', async () => {
    const quote = (await service.cart(identity)).checkoutQuote;
    const first = await service.checkout(identity, {
      addressId: 'address-a',
      checkoutKey: 'key-a',
      quote,
    });
    db.order.findUnique.mockResolvedValue(first);
    rows = [];
    const repeated = await service.checkout(identity, {
      addressId: 'address-a',
      checkoutKey: 'key-a',
      quote,
    });
    expect(repeated.id).toBe(first.id);
    expect(db.order.create).toHaveBeenCalledOnce();
    expect(db.$queryRaw).toHaveBeenCalledOnce();
    await expect(
      service.checkout(identity, {
        addressId: 'other-address',
        checkoutKey: 'key-a',
        quote,
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      service.checkout(identity, {
        addressId: 'address-a',
        checkoutKey: 'key-a',
        quote: '0'.repeat(64),
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('leaves the cart and order untouched when available stock is lost', async () => {
    const quote = (await service.cart(identity)).checkoutQuote;
    db.$queryRaw.mockResolvedValue([]);
    await expect(
      service.checkout(identity, {
        addressId: 'address-a',
        checkoutKey: 'key-a',
        quote,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(db.order.create).not.toHaveBeenCalled();
    expect(db.cartItem.deleteMany).not.toHaveBeenCalled();
  });
  it.each(['40001', '40P01'])(
    'retries a raw SQL concurrency failure %s',
    async (code) => {
      const quote = (await service.cart(identity)).checkoutQuote;
      db.$queryRaw.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('concurrent checkout', {
          code: 'P2010',
          clientVersion: 'test',
          meta: {
            driverAdapterError: {
              cause: { originalCode: code, kind: 'TransactionWriteConflict' },
            },
          },
        }),
      );
      await service.checkout(identity, {
        addressId: 'address-a',
        checkoutKey: 'key-a',
        quote,
      });
      expect(db.$transaction).toHaveBeenCalledTimes(2);
      expect(db.order.create).toHaveBeenCalledOnce();
    },
  );
  it('returns a conflict after exhausting serialization retries', async () => {
    const quote = (await service.cart(identity)).checkoutQuote;
    db.$queryRaw.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('busy', {
        code: 'P2010',
        clientVersion: 'test',
        meta: { code: '40001' },
      }),
    );
    await expect(
      service.checkout(identity, {
        addressId: 'address-a',
        checkoutKey: 'key-a',
        quote,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(db.$transaction).toHaveBeenCalledTimes(3);
    expect(db.order.create).not.toHaveBeenCalled();
  });
  it('blocks checkout when stock, shop delivery or the maximum total is invalid', async () => {
    rows[0].variant.onHand = 1;
    expect((await service.cart(identity)).canCheckout).toBe(false);
    rows[0].variant.onHand = 5;
    rows[0].variant.priceLkrMinor = 1_000_000_000;
    expect((await service.cart(identity)).canCheckout).toBe(false);
  });
});
