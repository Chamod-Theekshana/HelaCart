export const deliveryDistricts = [
  "Ampara",
  "Anuradhapura",
  "Badulla",
  "Batticaloa",
  "Colombo",
  "Galle",
  "Gampaha",
  "Hambantota",
  "Jaffna",
  "Kalutara",
  "Kandy",
  "Kegalle",
  "Kilinochchi",
  "Kurunegala",
  "Mannar",
  "Matale",
  "Matara",
  "Monaragala",
  "Mullaitivu",
  "Nuwara Eliya",
  "Polonnaruwa",
  "Puttalam",
  "Ratnapura",
  "Trincomalee",
  "Vavuniya",
];
export type DistrictRate = {
  district: string;
  available: boolean;
  feeMinor: number;
};
export type DeliverySettings = {
  id: string;
  shippingFeeLkrMinor: number | null;
  deliveryRevision: number;
  deliveryRules: DistrictRate[];
  freeShippingThresholdMinor: number | null;
  deliveryMinDays: number | null;
  deliveryMaxDays: number | null;
};
export type Shipment = {
  id: string;
  courierName: string;
  trackingNumber: string | null;
  version: number;
  shippedAt: string;
  updatedAt: string;
};
export type DeliveryTracking = {
  status: string;
  shipment?: Shipment | null;
  deliveryMinDays?: number | null;
  deliveryMaxDays?: number | null;
  events?: {
    id: string;
    fromStatus?: string;
    toStatus: string;
    createdAt: string;
  }[];
};
export type DeliveryQuote = {
  sellerId: string;
  sellerName: string;
  available: boolean;
  feeMinor: number | null;
  district: string | null;
  freeDelivery: boolean;
  minDays: number | null;
  maxDays: number | null;
  reason: string | null;
};
export const deliveryDate = (value: string) =>
  new Intl.DateTimeFormat("en-LK", {
    timeZone: "Asia/Colombo",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
