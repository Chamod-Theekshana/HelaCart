import { Transform } from 'class-transformer';
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
} from 'class-validator';
import { SellerOrderStatus } from '../generated/prisma/client.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class AddressDto {
  @Transform(trim) @IsString() @Length(2, 100) recipient!: string;
  @Transform(trim) @IsString() @Matches(/^\+?[0-9 ()-]{9,20}$/) phone!: string;
  @Transform(trim) @IsString() @Length(5, 200) line1!: string;
  @Transform(trim) @IsOptional() @IsString() @Length(1, 200) line2?: string;
  @Transform(trim) @IsString() @Length(2, 80) city!: string;
  @Transform(trim) @IsString() @Length(2, 80) district!: string;
  @Transform(trim) @IsString() @Length(3, 20) postalCode!: string;
}

export class CartQuantityDto {
  @IsInt() @Min(1) @Max(100) quantity!: number;
}

export class CheckoutDto {
  @IsUUID('4') addressId!: string;
  @IsUUID('4') checkoutKey!: string;
}

export class DeliveryFeeDto {
  @IsInt() @Min(0) @Max(100000000) shippingFeeLkrMinor!: number;
}

export class SellerOrderStatusDto {
  @IsIn([
    SellerOrderStatus.ACCEPTED,
    SellerOrderStatus.PACKED,
    SellerOrderStatus.SHIPPED,
    SellerOrderStatus.DELIVERED,
    SellerOrderStatus.CANCELLED,
  ])
  status!: SellerOrderStatus;
  @IsOptional() @IsBoolean() paymentCollected?: boolean;
}
