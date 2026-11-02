import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  IsArray,
  ArrayMaxSize,
  ArrayUnique,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { SellerOrderStatus } from '../generated/prisma/client.js';
import { canonicalDistrict, deliveryDistricts } from './delivery-rules.js';
import type { AdminOrderAction } from './order-state.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const district = ({ value }: { value: unknown }) => canonicalDistrict(value);

export class AddressDto {
  @Transform(trim) @IsString() @Length(2, 100) recipient!: string;
  @Transform(trim) @IsString() @Matches(/^\+?[0-9 ()-]{9,20}$/) phone!: string;
  @Transform(trim) @IsString() @Length(5, 200) line1!: string;
  @Transform(trim) @IsOptional() @IsString() @Length(1, 200) line2?: string;
  @Transform(trim) @IsString() @Length(2, 80) city!: string;
  @Transform(district)
  @IsIn(deliveryDistricts)
  district!: string;
  @Transform(trim) @IsString() @Length(3, 20) postalCode!: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

/** PATCH /me/addresses/:id: any subset of AddressDto plus isDefault. */
// Omitted fields stay unchanged; null is rejected except for line2 (clears it).
const present = (_object: object, value: unknown) => value !== undefined;
export class UpdateAddressDto {
  @ValidateIf(present)
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  recipient?: string;
  @ValidateIf(present)
  @Transform(trim)
  @IsString()
  @Matches(/^\+?[0-9 ()-]{9,20}$/)
  phone?: string;
  @ValidateIf(present)
  @Transform(trim)
  @IsString()
  @Length(5, 200)
  line1?: string;
  @IsOptional() @Transform(trim) @IsString() @Length(1, 200) line2?:
    | string
    | null;
  @ValidateIf(present)
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  city?: string;
  @ValidateIf(present)
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? value : canonicalDistrict(value),
  )
  @IsIn(deliveryDistricts)
  district?: string;
  @ValidateIf(present)
  @Transform(trim)
  @IsString()
  @Length(3, 20)
  postalCode?: string;
  @ValidateIf(present) @IsBoolean() isDefault?: boolean;
}

export class CartQuantityDto {
  @IsInt() @Min(1) @Max(100) quantity!: number;
}

export class CheckoutDto {
  @IsUUID('4') addressId!: string;
  @IsUUID('4') checkoutKey!: string;
  @IsString() @Matches(/^[a-f0-9]{64}$/) quote!: string;
}

export class DeliveryFeeDto {
  @IsInt() @Min(0) @Max(100000000) shippingFeeLkrMinor!: number;
}

export class CartQuoteDto {
  @IsOptional() @IsUUID('4') addressId?: string;
}
export class DistrictDeliveryDto {
  @IsIn(deliveryDistricts) district!: string;
  @IsBoolean() available!: boolean;
  @IsInt() @Min(0) @Max(100000000) feeMinor!: number;
}
export class DeliverySettingsDto extends DeliveryFeeDto {
  @IsInt() @Min(0) version!: number;
  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  @Min(1)
  @Max(1000000000)
  freeShippingThresholdMinor!: number | null;
  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  @Min(1)
  @Max(60)
  deliveryMinDays!: number | null;
  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  @Min(1)
  @Max(60)
  deliveryMaxDays!: number | null;
  @IsArray()
  @ArrayMaxSize(25)
  @ArrayUnique((r: DistrictDeliveryDto) => r.district)
  @ValidateNested({ each: true })
  @Type(() => DistrictDeliveryDto)
  districtRates!: DistrictDeliveryDto[];
}
export class ShipmentDto {
  @IsInt() @Min(0) version!: number;
  @Transform(trim) @IsString() @Length(2, 100) courierName!: string;
  @Transform(trim) @IsString() @Length(0, 100) trackingNumber!: string;
  @Transform(trim) @IsString() @Length(10, 500) reason!: string;
}
export class SellerOrderStatusDto {
  @IsIn([
    SellerOrderStatus.ACCEPTED,
    SellerOrderStatus.PACKED,
    SellerOrderStatus.SHIPPED,
    SellerOrderStatus.DELIVERED,
    SellerOrderStatus.CANCELLED,
    SellerOrderStatus.DELIVERY_FAILED,
    SellerOrderStatus.RETURNED_TO_SELLER,
  ])
  status!: SellerOrderStatus;
  /** Required for CANCELLED, DELIVERY_FAILED and RETURNED_TO_SELLER. */
  @IsOptional() @Transform(trim) @IsString() @Length(5, 500) reason?: string;
  @IsOptional() @IsBoolean() paymentCollected?: boolean;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  courierName?: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 100)
  trackingNumber?: string;
}

export class BuyerCancelDto {
  @IsOptional() @Transform(trim) @IsString() @Length(5, 500) reason?: string;
}

export class AdminOrderActionDto {
  @IsIn(['CANCEL', 'MARK_DELIVERY_FAILED', 'MARK_RETURNED', 'MARK_DELIVERED'])
  action!: AdminOrderAction;
  @Transform(trim) @IsString() @Length(5, 500) reason!: string;
}

export class AttentionQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60) days?: number;
  @IsOptional() @IsUUID('4') cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}
