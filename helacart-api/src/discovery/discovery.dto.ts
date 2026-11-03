import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class SuggestQueryDto {
  @Transform(trim) @IsString() @Length(2, 80) q!: string;
}
export class RecommendationQueryDto {
  @IsOptional() @IsUUID('4') productId?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(12) limit = 8;
}
export class PromotionListDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20;
  @IsIn(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']) status = 'ALL';
}
export class CreatePromotionDto {
  @IsUUID('4') requestKey!: string;
  @IsUUID('4') productId!: string;
  @Transform(trim) @IsString() @Length(3, 100) name!: string;
  @IsInt() @Min(100) @Max(9000) discountBps!: number;
  @IsDateString({ strict: true }) startsAt!: string;
  @IsDateString({ strict: true }) endsAt!: string;
}
export class PromotionDecisionDto {
  @IsInt() @Min(0) @Max(2147483646) version!: number;
  @IsIn(['APPROVED', 'REJECTED', 'CANCELLED']) status!: string;
  @Transform(trim) @IsString() @Length(10, 500) reason!: string;
}
export class FavoriteAlertDto {
  @IsInt() @Min(0) @Max(2147483646) version!: number;
  @IsBoolean() priceAlerts!: boolean;
  @IsBoolean() restockAlerts!: boolean;
}
