import {
  canonicalDistrict,
  deliveryDistricts,
  deliveryFor,
} from './delivery-rules.js';
describe('Delivery rates', () => {
  const seller = {
    shippingFeeLkrMinor: 35000,
    deliveryRevision: 2,
    freeShippingThresholdMinor: 100000,
    deliveryMinDays: 2,
    deliveryMaxDays: 5,
    deliveryRules: [
      { district: 'Kandy', available: true, feeMinor: 50000 },
      { district: 'Jaffna', available: false, feeMinor: 60000 },
    ],
  };
  it('has 25 unique districts and normalizes stored address spellings', () => {
    expect(new Set(deliveryDistricts).size).toBe(25);
    expect(canonicalDistrict('  nuwara   eliya ')).toBe('Nuwara Eliya');
    expect(canonicalDistrict('Moneragala')).toBe('Monaragala');
  });
  it('uses a district override before the shop default', () => {
    expect(deliveryFor(seller, 99999, 'kandy')).toMatchObject({
      feeMinor: 50000,
      available: true,
      freeDelivery: false,
      revision: 2,
      minDays: 2,
      maxDays: 5,
    });
    expect(deliveryFor(seller, 99999, 'Colombo').feeMinor).toBe(35000);
  });
  it('grants free delivery at the exact merchandise threshold', () => {
    expect(deliveryFor(seller, 100000, 'Kandy')).toMatchObject({
      feeMinor: 0,
      available: true,
      freeDelivery: true,
    });
  });
  it('never grants delivery to a blocked or unknown district via free shipping', () => {
    for (const district of ['Jaffna', 'Colombo typo'])
      expect(deliveryFor(seller, 100000, district)).toMatchObject({
        available: false,
        feeMinor: null,
        freeDelivery: false,
      });
  });
  it('does not invent estimates or activate unconfigured shipping', () => {
    expect(
      deliveryFor({ shippingFeeLkrMinor: null }, 100000, 'Kandy'),
    ).toMatchObject({
      available: false,
      feeMinor: null,
      minDays: null,
      maxDays: null,
    });
  });
  it('retains legacy flat fees for older unrecognized addresses without district rules', () => {
    expect(
      deliveryFor({ shippingFeeLkrMinor: 35000 }, 200000, 'Old district label')
        .feeMinor,
    ).toBe(35000);
  });
});
