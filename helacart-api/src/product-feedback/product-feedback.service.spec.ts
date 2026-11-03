import { ProductFeedbackService } from './product-feedback.service.js';
describe('Buyer product review history', () => {
  it('scopes history to the buyer and keeps unavailable listings removable without exposing shop status', async () => {
    const db = {
      customerProductReview: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'visible',
            version: 1,
            isHidden: false,
            product: {
              id: 'p1',
              title: 'Visible product',
              status: 'APPROVED',
              seller: { status: 'APPROVED' },
              category: { isActive: true },
            },
          },
          {
            id: 'unavailable',
            version: 3,
            isHidden: true,
            product: {
              id: 'p2',
              title: 'Unavailable product',
              status: 'HIDDEN',
              seller: { status: 'SUSPENDED' },
              category: { isActive: false },
            },
          },
        ]),
        count: vi.fn().mockResolvedValue(2),
      },
    };
    const service = new ProductFeedbackService(
      db as never,
      { getOrCreateProfile: async () => ({ id: 'buyer-id' }) } as never,
      {} as never,
    );
    const result = await service.mine({ email_verified: true } as never, {
      page: 1,
      limit: 10,
      sort: 'newest',
    });
    expect(db.customerProductReview.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { buyerId: 'buyer-id', deletedAt: null },
      }),
    );
    expect(result.items).toEqual([
      {
        id: 'visible',
        version: 1,
        isHidden: false,
        canViewProduct: true,
        product: { id: 'p1', title: 'Visible product' },
      },
      {
        id: 'unavailable',
        version: 3,
        isHidden: true,
        canViewProduct: false,
        product: { id: 'p2', title: 'Unavailable product' },
      },
    ]);
  });
});
