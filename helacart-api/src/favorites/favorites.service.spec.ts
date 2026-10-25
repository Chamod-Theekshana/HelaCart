import type { DecodedIdToken } from 'firebase-admin/auth';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuthService } from '../auth/auth.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { FavoritesService } from './favorites.service.js';

describe('Product favorites', () => {
  const identity = { uid: 'buyer', email_verified: false } as DecodedIdToken;
  const db = {
    productFavorite: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    product: { findFirst: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  };
  const auth = { getOrCreateProfile: vi.fn() },
    catalog = new CatalogService(
      db as unknown as PrismaService,
      auth as unknown as AuthService,
    ),
    service = new FavoritesService(
      db as unknown as PrismaService,
      auth as unknown as AuthService,
      catalog,
    );
  const row = () => ({
    id: 'favorite',
    productId: 'product',
    titleSnapshot: 'Original public title',
    sellerNameSnapshot: 'Public shop',
    imageUrlSnapshot: null,
    createdAt: new Date(),
    product: {
      id: 'product',
      title: 'Current public title',
      imageUrls: ['/current.jpg'],
      status: 'APPROVED',
      seller: {
        id: 'seller',
        name: 'Current shop',
        slug: 'shop',
        status: 'APPROVED',
      },
      category: {
        id: 'category',
        name: 'Category',
        slug: 'category',
        isActive: true,
      },
      variants: [
        {
          id: 'variant',
          position: 0,
          sku: 'SKU',
          optionValues: {},
          priceLkrMinor: 20000,
          onHand: 9,
          reserved: 2,
        },
      ],
    },
  });
  beforeEach(() => {
    vi.resetAllMocks();
    auth.getOrCreateProfile.mockResolvedValue({ id: 'user' });
    db.productFavorite.findMany.mockResolvedValue([row()]);
    db.productFavorite.count.mockResolvedValue(1);
    db.productFavorite.findUnique.mockResolvedValue(null);
    db.product.findFirst.mockResolvedValue({
      title: 'Product',
      imageUrls: ['/public.jpg'],
      seller: { name: 'Shop' },
    });
    db.productFavorite.create.mockResolvedValue({
      id: 'favorite',
      productId: 'product',
    });
    db.$transaction.mockImplementation((operation: unknown) =>
      Array.isArray(operation)
        ? Promise.all(operation)
        : (operation as (tx: typeof db) => unknown)(db),
    );
  });
  it('scopes summaries and pages to the authenticated account', async () => {
    const summary = await service.summary(identity);
    expect(summary.total).toBe(1);
    expect(db.productFavorite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user' },
        select: { id: true, productId: true },
      }),
    );
    await service.list(identity, { page: 2, limit: 12 });
    expect(db.productFavorite.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { userId: 'user' },
        skip: 12,
        take: 12,
      }),
    );
  });
  it('returns current prices and available stock without private inventory/status fields', async () => {
    const result = await service.list(identity, { page: 1, limit: 12 });
    expect(result.items[0].title).toBe('Current public title');
    expect(result.items[0].product?.variants[0]).toMatchObject({
      priceLkrMinor: 20000,
      availableQuantity: 7,
    });
    expect(JSON.stringify(result)).not.toContain('onHand');
    expect(JSON.stringify(result)).not.toContain('reserved');
    expect(JSON.stringify(result)).not.toContain('APPROVED');
  });
  it.each(['product', 'seller', 'category', 'deleted'])(
    'keeps a %s unavailable favorite without exposing new private content',
    async (reason) => {
      const entry = row();
      if (reason === 'product') entry.product.status = 'HIDDEN';
      if (reason === 'seller') entry.product.seller.status = 'SUSPENDED';
      if (reason === 'category') entry.product.category.isActive = false;
      db.productFavorite.findMany.mockResolvedValue([
        { ...entry, product: reason === 'deleted' ? null : entry.product },
      ]);
      const result = await service.list(identity, { page: 1, limit: 12 });
      expect(result.items[0]).toMatchObject({
        title: 'Original public title',
        sellerName: 'Public shop',
        product: null,
      });
      expect(JSON.stringify(result)).not.toContain('Current public title');
    },
  );
  it('retains sold-out approved products', async () => {
    const entry = row();
    entry.product.variants[0].onHand = 0;
    entry.product.variants[0].reserved = 0;
    db.productFavorite.findMany.mockResolvedValue([entry]);
    expect(
      (await service.list(identity, { page: 1, limit: 12 })).items[0].product
        ?.variants[0].availableQuantity,
    ).toBe(0);
  });
  it('saves an approved product with a snapshot and an account lock', async () => {
    await service.save(identity, 'product');
    expect(db.$queryRaw).toHaveBeenCalledOnce();
    expect(db.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'product',
          status: 'APPROVED',
          seller: { status: 'APPROVED' },
          category: { isActive: true },
        },
      }),
    );
    expect(db.productFavorite.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          userId: 'user',
          productId: 'product',
          titleSnapshot: 'Product',
          sellerNameSnapshot: 'Shop',
          imageUrlSnapshot: '/public.jpg',
        },
      }),
    );
  });
  it('repeated saves return the existing item without adding another', async () => {
    db.productFavorite.findUnique.mockResolvedValue({
      id: 'favorite',
      productId: 'product',
    });
    expect(await service.save(identity, 'product')).toEqual({
      id: 'favorite',
      productId: 'product',
    });
    expect(db.productFavorite.create).not.toHaveBeenCalled();
  });
  it('rejects products that are not public', async () => {
    db.product.findFirst.mockResolvedValue(null);
    await expect(
      service.save(identity, 'private-product'),
    ).rejects.toMatchObject({ status: 404 });
    expect(db.productFavorite.create).not.toHaveBeenCalled();
  });
  it('enforces the saved item limit inside the transaction', async () => {
    db.productFavorite.count.mockResolvedValue(500);
    await expect(service.save(identity, 'product')).rejects.toMatchObject({
      status: 409,
    });
    expect(db.productFavorite.create).not.toHaveBeenCalled();
  });
  it('removes only an owned favorite and tolerates retries', async () => {
    await service.remove(identity, 'foreign-or-missing');
    expect(db.productFavorite.deleteMany).toHaveBeenCalledWith({
      where: { id: 'foreign-or-missing', userId: 'user' },
    });
    expect(await service.remove(identity, 'foreign-or-missing')).toEqual({
      removed: true,
    });
  });
});
