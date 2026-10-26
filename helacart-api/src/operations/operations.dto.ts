import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ArrayUnique,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { ReturnStatus } from '../generated/prisma/client.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ReturnLineDto {
  @IsUUID('4') orderItemId!: string;
  @IsInt() @Min(1) @Max(100) quantity!: number;
}
export class RequestReturnDto {
  @IsUUID('4') sellerOrderId!: string;
  @Transform(trim) @IsString() @Length(10, 1000) reason!: string;
  @IsOptional() @IsUUID('4') requestKey?: string;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique((i: ReturnLineDto) => i.orderItemId)
  @ValidateNested({ each: true })
  @Type(() => ReturnLineDto)
  items?: ReturnLineDto[];
}

export class ReviewReturnDto {
  @Transform(trim) @IsOptional() @IsString() @Length(10, 1000) reason?: string;
}

export class ResolveReturnDto {
  @Transform(trim) @IsString() @Length(10, 1000) note!: string;
  @IsOptional()
  @IsIn(['REFUNDED', 'PARTIAL_REFUND', 'REPLACED', 'OTHER'])
  outcome = 'OTHER';
}

export class PageDto {
  @IsOptional() @IsUUID('4') cursor?: string;
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class ListReturnsDto extends PageDto {
  @IsOptional() @IsEnum(ReturnStatus) status?: ReturnStatus;
}

export class ReconcileCodDto {
  @IsInt() @Min(0) @Max(1_000_000_000) amountReceivedMinor!: number;
  @Transform(trim) @IsString() @Length(4, 120) reference!: string;
  @Transform(trim) @IsOptional() @IsString() @Length(10, 1000) note?: string;
}
