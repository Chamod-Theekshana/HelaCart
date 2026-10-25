import { ratingSummary } from './shops.service.js';
describe('Published shop rating summary', () => {
  it('handles shops with no reviews', () => {
    expect(ratingSummary([])).toEqual({
      total: 0,
      average: 0,
      breakdown: [5, 4, 3, 2, 1].map((rating) => ({ rating, count: 0 })),
    });
  });
  it('weights each star count and rounds to one decimal', () => {
    expect(
      ratingSummary([
        { rating: 5, _count: { _all: 2 } },
        { rating: 4, _count: { _all: 1 } },
      ]),
    ).toMatchObject({
      total: 3,
      average: 4.7,
      breakdown: [
        { rating: 5, count: 2 },
        { rating: 4, count: 1 },
        { rating: 3, count: 0 },
        { rating: 2, count: 0 },
        { rating: 1, count: 0 },
      ],
    });
  });
});
