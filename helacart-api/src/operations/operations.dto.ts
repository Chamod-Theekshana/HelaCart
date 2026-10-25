import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { ReturnStatus } from '../generated/prisma/client.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RequestReturnDto {
  @IsUUID('4') sellerOrderId!: string;
  @Transform(trim) @IsString() @Length(10, 1000) reason!: string;
}

export class ReviewReturnDto {
  @Transform(trim) @IsOptional() @IsString() @Length(10, 1000) reason?: string;
}

export class ResolveReturnDto {
  @Transform(trim) @IsString() @Length(10, 1000) note!: string;
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
