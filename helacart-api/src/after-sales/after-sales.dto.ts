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
import { ListQuery } from '../workspace/workspace.dto.js';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class AfterSalesQuery extends ListQuery {
  @IsOptional()
  @IsIn([
    'ALL',
    'OPEN',
    'UNDER_REVIEW',
    'WAITING_BUYER',
    'WAITING_SELLER',
    'RESOLVED',
    'CLOSED',
    'PENDING',
    'APPROVED',
    'REJECTED',
  ])
  status = 'ALL';
}
export class CreateCaseDto {
  @IsUUID('4') requestKey!: string;
  @IsOptional() @IsUUID('4') sellerOrderId?: string;
  @Transform(trim) @IsString() @Length(5, 150) title!: string;
  @IsIn(['ORDER_ISSUE', 'DELIVERY', 'RETURN', 'REFUND', 'ACCOUNT', 'OTHER'])
  category!: string;
  @Transform(trim) @IsString() @Length(10, 4000) body!: string;
}
export class CaseMessageDto {
  @IsUUID('4') requestKey!: string;
  @Transform(trim) @IsString() @Length(1, 4000) body!: string;
}
export class CaseDecisionDto {
  @IsInt() @Min(0) version!: number;
  @IsIn([
    'OPEN',
    'UNDER_REVIEW',
    'WAITING_BUYER',
    'WAITING_SELLER',
    'RESOLVED',
    'CLOSED',
  ])
  status!: string;
  @IsBoolean() financeHold!: boolean;
  @Transform(trim) @IsString() @Length(10, 1000) reason!: string;
}
export class RefundRecordDto {
  @IsUUID('4') requestKey!: string;
  @IsUUID('4') returnItemId!: string;
  @IsInt() @Min(0) @Max(1000000000) merchandiseMinor!: number;
  @IsInt() @Min(0) @Max(1000000000) shippingMinor!: number;
  @IsIn(['CASH', 'BANK_TRANSFER']) method!: string;
  @Transform(trim) @IsString() @Length(3, 100) reference!: string;
  @Matches(/^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/) paidOn!: string;
  @IsOptional() @Transform(trim) @IsString() @Length(0, 500) note?: string;
}
export class RefundReviewDto {
  @IsIn(['APPROVED', 'REJECTED']) decision!: 'APPROVED' | 'REJECTED';
  @Transform(trim) @IsString() @Length(10, 500) reason!: string;
}
export class RefundReversalDto {
  @IsUUID('4') requestKey!: string;
  @Transform(trim) @IsString() @Length(3, 100) reference!: string;
  @Transform(trim) @IsString() @Length(10, 500) reason!: string;
}
