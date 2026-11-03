import { DiscoveryService } from './discovery.service.js';
describe('Recommendation transparency', () => {
  it.each([
    [0, 'RECENT_DELIVERED_POPULARITY'],
    [2, 'YOUR_FAVORITE_CATEGORIES'],
  ])(
    'uses the actual account favorite basis for %s saved products',
    async (count, basis) => {
      const db = {
        productFavorite: { count: vi.fn().mockResolvedValue(count) },
        product: { findMany: async () => [] },
        $queryRaw: async () => [],
        $transaction: async (fn: (tx: unknown) => unknown) => fn(db),
      };
      const service = new DiscoveryService(
        db as never,
        { getOrCreateProfile: async () => ({ id: 'buyer' }) } as never,
        {} as never,
      );
      expect(
        (await service.recommendations({ limit: 4 }, { uid: 'buyer' } as never))
          .basis,
      ).toBe(basis);
      expect(db.productFavorite.count).toHaveBeenCalledWith({
        where: { userId: 'buyer', productId: { not: null } },
      });
    },
  );
});
