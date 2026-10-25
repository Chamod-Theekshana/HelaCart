import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
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
import {
  ProductStatus,
  ReturnStatus,
  SellerOrderStatus,
  SellerStatus,
} from '../generated/prisma/client.js';
export class ListQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) @IsOptional() page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(50) @IsOptional() limit = 20;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(0, 80)
  @IsOptional()
  q?: string;
}
export class ProductQuery extends ListQuery {
  @IsEnum(ProductStatus) @IsOptional() status?: ProductStatus;
  @IsUUID('4') @IsOptional() categoryId?: string;
  @IsIn(['LOW', 'READY']) @IsOptional() stock?: string;
}
export class OrderQuery extends ListQuery {
  @IsEnum(SellerOrderStatus) @IsOptional() status?: SellerOrderStatus;
}
export class ReturnQuery extends ListQuery {
  @IsEnum(ReturnStatus) @IsOptional() status?: ReturnStatus;
}
export class ApplicationQuery extends ListQuery {
  @IsEnum(SellerStatus) @IsOptional() status: SellerStatus =
    SellerStatus.PENDING;
}
export class PublicCatalogQuery extends ListQuery {
  @IsString() @Length(1, 80) @IsOptional() category?: string;
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000000000)
  @IsOptional()
  minPrice?: number;
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000000000)
  @IsOptional()
  maxPrice?: number;
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  @IsOptional()
  inStock?: boolean;
  @IsIn(['newest', 'price-asc', 'price-desc', 'name']) @IsOptional() sort =
    'newest';
}
