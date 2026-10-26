import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { ProductStatus } from '../../generated/prisma/client.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ProductSpecificationDto {
  @Transform(trim) @IsString() @Length(1, 60) name!: string;
  @Transform(trim) @IsString() @Length(1, 300) value!: string;
}
export class ProductDetailsDto {
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(0, 100)
  brand?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(0, 500)
  warranty?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique((row: ProductSpecificationDto) =>
    typeof row?.name === 'string' ? row.name.toLowerCase() : row,
  )
  @ValidateNested({ each: true })
  @Type(() => ProductSpecificationDto)
  specifications?: ProductSpecificationDto[];
}

export class CreateProductDto extends ProductDetailsDto {
  @Transform(trim)
  @IsString()
  @Length(3, 120)
  title!: string;

  @Transform(trim)
  @IsString()
  @Length(3, 80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @Transform(trim)
  @IsString()
  @Length(10, 3000)
  description!: string;

  @Transform(trim)
  @IsString()
  @Length(2, 64)
  @Matches(/^[A-Z0-9]+(?:[-_][A-Z0-9]+)*$/)
  sku!: string;

  @IsUUID('4')
  categoryId!: string;

  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  priceLkrMinor!: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsUrl({ protocols: ['https'], require_protocol: true }, { each: true })
  imageUrls?: string[];
}

export class UpdateProductDto extends ProductDetailsDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(3, 120)
  title?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(3, 80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(10, 3000)
  description?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(2, 64)
  @Matches(/^[A-Z0-9]+(?:[-_][A-Z0-9]+)*$/)
  sku?: string;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  priceLkrMinor?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsUrl({ protocols: ['https'], require_protocol: true }, { each: true })
  imageUrls?: string[];
}

export class ListPublicProductsDto {
  @IsOptional()
  @IsUUID('4')
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(2, 80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  category?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(2, 80)
  q?: string;
}

export class ListSellerProductsDto {
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}

export class RejectProductDto {
  @Transform(trim)
  @IsString()
  @Length(10, 500)
  reason!: string;
}
