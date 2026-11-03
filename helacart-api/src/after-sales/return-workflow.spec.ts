import { remainingReturns } from './return-workflow.js';
describe('Item return quantity reservations', () => {
  const calculate = (requests: unknown[]) =>
    remainingReturns({
      items: [
        {
          id: 'item',
          quantity: 3,
          unitLkrMinor: 1000,
          productTitle: 'Shirt',
          sku: 'SKU',
        },
      ],
      returnRequests: requests,
    } as unknown as Parameters<typeof remainingReturns>[0])[0]
      .remainingQuantity;
  it('subtracts pending, approved and resolved item quantities', () => {
    expect(
      calculate([
        { status: 'PENDING', items: [{ orderItemId: 'item', quantity: 1 }] },
        { status: 'RESOLVED', items: [{ orderItemId: 'item', quantity: 1 }] },
      ]),
    ).toBe(1);
  });
  it('releases rejected quantities and ignores unrelated items', () => {
    expect(
      calculate([
        { status: 'REJECTED', items: [{ orderItemId: 'item', quantity: 3 }] },
        {
          status: 'APPROVED',
          items: [{ orderItemId: 'different', quantity: 1 }],
        },
      ]),
    ).toBe(3);
  });
  it('preserves the meaning of a legacy whole-order return', () => {
    expect(calculate([{ status: 'APPROVED', items: [] }])).toBe(0);
  });
});
