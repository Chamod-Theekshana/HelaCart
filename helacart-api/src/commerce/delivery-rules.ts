export const deliveryDistricts = [
  'Ampara',
  'Anuradhapura',
  'Badulla',
  'Batticaloa',
  'Colombo',
  'Galle',
  'Gampaha',
  'Hambantota',
  'Jaffna',
  'Kalutara',
  'Kandy',
  'Kegalle',
  'Kilinochchi',
  'Kurunegala',
  'Mannar',
  'Matale',
  'Matara',
  'Monaragala',
  'Mullaitivu',
  'Nuwara Eliya',
  'Polonnaruwa',
  'Puttalam',
  'Ratnapura',
  'Trincomalee',
  'Vavuniya',
] as const;
export function canonicalDistrict(value: unknown): string {
  if (typeof value !== 'string') return '';
  const normalized = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (normalized.toLowerCase() === 'moneragala') return 'Monaragala';
  return (
    deliveryDistricts.find(
      (d) => d.toLowerCase() === normalized.toLowerCase(),
    ) ?? normalized
  );
}
export type DistrictRate = {
  district: string;
  available: boolean;
  feeMinor: number;
};
export type DeliveryTerms = {
  shippingFeeLkrMinor: number | null;
  deliveryRules?: unknown;
  freeShippingThresholdMinor?: number | null;
  deliveryMinDays?: number | null;
  deliveryMaxDays?: number | null;
  deliveryRevision?: number;
};
export function deliveryFor(
  seller: DeliveryTerms,
  subtotalMinor: number,
  district?: string,
) {
  const rules = (
      Array.isArray(seller.deliveryRules) ? seller.deliveryRules : []
    ) as DistrictRate[],
    normalized = district ? canonicalDistrict(district) : null;
  const known = !normalized || deliveryDistricts.some((d) => d === normalized),
    override = rules.find((r) => r.district === normalized),
    configured = seller.shippingFeeLkrMinor != null;
  const available =
    configured &&
    (!normalized || !rules.length || known) &&
    override?.available !== false;
  const free =
    available &&
    seller.freeShippingThresholdMinor != null &&
    subtotalMinor >= seller.freeShippingThresholdMinor;
  return {
    available,
    feeMinor: available
      ? free
        ? 0
        : (override?.feeMinor ?? seller.shippingFeeLkrMinor!)
      : null,
    district: normalized,
    freeDelivery: free,
    minDays: seller.deliveryMinDays ?? null,
    maxDays: seller.deliveryMaxDays ?? null,
    revision: seller.deliveryRevision ?? 0,
    reason: !configured
      ? 'Shop delivery is not configured'
      : !available
        ? 'This shop does not deliver to the selected district'
        : null,
  };
}
