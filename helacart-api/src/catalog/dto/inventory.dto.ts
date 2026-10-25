import { Transform } from 'class-transformer';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateVariantDto {
  @IsInt()
  @Min(1)
  @Max(100)
  position!: number;

  @Transform(trim)
  @IsString()
  @Length(2, 64)
  @Matches(/^[A-Z0-9]+(?:[-_][A-Z0-9]+)*$/)
  sku!: string;

  @IsObject()
  optionValues!: Record<string, unknown>;

  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  priceLkrMinor!: number;
}

export class UpdateVariantDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 64)
  @Matches(/^[A-Z0-9]+(?:[-_][A-Z0-9]+)*$/)
  sku?: string;

  @IsOptional()
  @IsObject()
  optionValues?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  priceLkrMinor?: number;
}

export class AdjustStockDto {
  @IsInt()
  @Min(-1_000_000)
  @Max(1_000_000)
  delta!: number;

  @Transform(trim)
  @IsString()
  @Length(5, 300)
  reason!: string;
}
