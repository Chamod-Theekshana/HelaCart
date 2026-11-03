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
  ValidateIf,
} from 'class-validator';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CommissionQueryDto {
  @IsOptional() @IsUUID('4') sellerId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20;
  @IsOptional() @Transform(trim) @IsString() @Length(0, 100) q?: string;
  @IsOptional() @IsIn(['ALL', 'OVERDUE', 'OUTSTANDING', 'PENDING']) filter =
    'ALL';
  @IsOptional() @IsIn(['ALL', 'PENDING', 'APPROVED', 'REJECTED']) status =
    'ALL';
  @IsOptional() @Matches(/^20\d{2}-(0[1-9]|1[0-2])$/) month?: string;
}
export class CommissionPolicyDto {
  @IsInt() @Min(0) version!: number;
  @IsInt() @Min(1) @Max(90) paymentDays!: number;
  @Transform(trim) @IsString() @Length(0, 100) bankName!: string;
  @Transform(trim) @IsString() @Length(0, 150) accountName!: string;
  @Transform(trim) @IsString() @Length(0, 50) accountNumber!: string;
  @Transform(trim) @IsString() @Length(0, 1000) instructions!: string;
  @Transform(trim) @IsString() @Length(10, 500) reason!: string;
}
export class ProductCommissionDto {
  @IsInt() @Min(0) version!: number;
  // null explicitly removes the assignment; zero is an assigned zero fee.
  @ValidateIf((_object, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(10000)
  rateBps!: number | null;
  @Transform(trim) @IsString() @Length(10, 500) reason!: string;
}
export class CommissionHoldDto {
  @IsInt() @Min(0) version!: number;
  @IsBoolean() held!: boolean;
  @Transform(trim) @IsString() @Length(10, 500) reason!: string;
}
export class CommissionPaymentDto {
  @IsUUID('4') requestKey!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(1000000000) amountMinor!: number;
  @Transform(trim) @IsString() @Length(3, 100) reference!: string;
  @Matches(/^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/) paidOn!: string;
  @IsOptional() @Transform(trim) @IsString() @Length(0, 500) note?: string;
}
export class CommissionReviewDto {
  @IsIn(['APPROVED', 'REJECTED']) decision!: 'APPROVED' | 'REJECTED';
  @Transform(trim) @IsString() @Length(10, 500) reason!: string;
}
export class CommissionRefundDto {
  @IsUUID('4') requestKey!: string;
  @IsUUID('4') chargeId!: string;
  @IsInt() @Min(1) @Max(1000000000) baseMinor!: number;
  @Transform(trim) @IsString() @Length(3, 100) reference!: string;
  @Transform(trim) @IsString() @Length(10, 500) reason!: string;
}

export class CommissionCorrectionDto {
  @IsUUID('4') requestKey!: string;
  @IsIn(['PAYMENT', 'REFUND']) kind!: 'PAYMENT' | 'REFUND';
  @IsUUID('4') targetId!: string;
  @Transform(trim) @IsString() @Length(3, 100) reference!: string;
  @Transform(trim) @IsString() @Length(10, 500) reason!: string;
}
