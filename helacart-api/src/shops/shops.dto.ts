import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsArray,
  ArrayMaxSize,
  ArrayUnique,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { ShopReviewReportStatus } from '../generated/prisma/client.js';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ShopPageDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) @IsOptional() page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(24) @IsOptional() limit = 12;
  @Transform(trim) @IsString() @Length(0, 80) @IsOptional() q?: string;
}
export class ShopProductsDto extends ShopPageDto {
  @Transform(trim) @IsString() @Length(1, 80) @IsOptional() category?: string;
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
  @IsIn(['newest', 'price-asc', 'price-desc', 'name'])
  @IsOptional()
  sort: string = 'newest';
}
export class ShopReviewsDto extends ShopPageDto {
  @IsIn(['newest', 'highest', 'lowest']) @IsOptional() sort: string = 'newest';
  @Type(() => Number) @IsInt() @Min(1) @Max(5) @IsOptional() rating?: number;
}
export class WriteShopReviewDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;
  @Transform(trim) @IsString() @Length(10, 1500) comment!: string;
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  keepPhotoIds?: string[];
}
export class ShopReplyDto {
  @Transform(trim) @IsString() @Length(2, 1500) reply!: string;
}
export class ReportShopReviewDto {
  @Transform(trim) @IsString() @Length(10, 500) reason!: string;
}
export class ModerateShopReviewDto {
  @IsIn(['HIDE', 'DISMISS']) action!: 'HIDE' | 'DISMISS';
  @Transform(trim) @IsString() @Length(10, 500) note!: string;
}
export class ShopReportsDto extends ShopPageDto {
  @IsEnum(ShopReviewReportStatus) @IsOptional() status: ShopReviewReportStatus =
    ShopReviewReportStatus.OPEN;
}
export class UpdateShopDto {
  @Transform(trim) @IsString() @Length(2, 100) name!: string;
  @Transform(trim) @IsString() @Length(0, 1000) description!: string;
  @Transform(trim) @IsString() @Length(0, 80) publicLocation!: string;
}
