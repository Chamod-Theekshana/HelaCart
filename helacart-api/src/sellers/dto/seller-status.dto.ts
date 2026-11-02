import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { SellerStatus } from '../../generated/prisma/client.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ListSellersDto {
  @IsOptional() @IsEnum(SellerStatus) status?: SellerStatus;
  @IsOptional() @Transform(trim) @IsString() @Length(1, 100) q?: string;
  @IsOptional() @IsUUID('4') cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}

export class UpdateSellerStatusDto {
  @IsIn([SellerStatus.SUSPENDED, SellerStatus.APPROVED])
  status!: 'SUSPENDED' | 'APPROVED';
  @Transform(trim) @IsString() @Length(5, 500) reason!: string;
}
