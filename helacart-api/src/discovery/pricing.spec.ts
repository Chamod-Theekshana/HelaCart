import { activeOffers, discountedMinor, priceProducts } from './pricing.js';
describe('Scheduled product pricing', () => {
  it.each([
    [10000, 1000, 9000],
    [999, 1250, 874],
    [1, 9000, 1],
    [1000000000, 9000, 100000000],
  ])('rounds integer cents consistently %s %s', (base, bps, result) =>
    expect(discountedMinor(base, bps)).toBe(result),
  );
  it('selects one strongest offer without stacking and queries inclusive starts / exclusive ends', async () => {
    const at = new Date('2026-10-27T00:00:00Z'),
      findMany = vi.fn().mockResolvedValue([
        { id: 'strong', productId: 'product', discountBps: 2000 },
        { id: 'weak', productId: 'product', discountBps: 1000 },
      ]);
    expect(
      (
        await activeOffers(
          { promotion: { findMany } } as never,
          ['product'],
          at,
        )
      ).get('product')?.id,
    ).toBe('strong');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'APPROVED',
          startsAt: { lte: at },
          endsAt: { gt: at },
        }),
      }),
    );
  });
  it('prices all variants and chooses the cheapest available offer, retaining original prices', async () => {
    const db = {
      promotion: {
        findMany: async () => [
          {
            id: 'offer',
            productId: 'p',
            name: 'Offer',
            discountBps: 1000,
            endsAt: new Date(),
          },
        ],
      },
    };
    const [product] = await priceProducts(db as never, [
      {
        id: 'p',
        priceLkrMinor: 20000,
        variants: [
          { id: 'a', priceLkrMinor: 20000, onHand: 5, reserved: 0 },
          { id: 'b', priceLkrMinor: 10000, onHand: 0, reserved: 0 },
          { id: 'c', priceLkrMinor: 15000, onHand: 1, reserved: 0 },
        ],
      },
    ]);
    expect(product).toMatchObject({
      listingPriceLkrMinor: 13500,
      originalPriceLkrMinor: 20000,
      variants: [
        { priceLkrMinor: 18000, originalPriceLkrMinor: 20000 },
        { priceLkrMinor: 9000 },
        { priceLkrMinor: 13500 },
      ],
    });
  });
});
