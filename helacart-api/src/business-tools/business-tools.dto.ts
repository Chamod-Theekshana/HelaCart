import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
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
export class ToolSearchDto {
  @IsOptional() @Transform(trim) @IsString() @Length(2, 100) q?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
export class StockAlertQueryDto extends ToolSearchDto {
  @IsIn(['ALL', 'LOW', 'OUT', 'DISABLED']) level = 'ALL';
}
export class StockAlertSettingsDto {
  @IsInt() @Min(0) @Max(2147483646) version!: number;
  @IsInt() @Min(0) @Max(1000000) threshold!: number;
  @IsBoolean() enabled!: boolean;
}
export class BulkPreviewDto {
  @IsUUID('4') requestKey!: string;
  @IsIn([
    'STOCK_SET',
    'PRODUCT_SUBMIT',
    'PRODUCT_HIDE',
    'PRODUCT_APPROVE',
    'PRODUCT_REJECT',
  ])
  kind!: string;
  @Transform(trim) @IsString() @Length(10, 500) reason!: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 100000)
  csv?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  productIds?: string[];
}
export class BusinessReportQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) from!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) to!: string;
}
export class BusinessExportQueryDto extends BusinessReportQueryDto {
  @IsIn(['DAILY', 'PRODUCTS', 'SHOPS', 'SUMMARY']) section = 'DAILY';
}
