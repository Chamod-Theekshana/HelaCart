import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { ShopReviewReportStatus } from '../generated/prisma/client.js';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class FeedbackPageDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 10;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) rating?: number;
  @IsIn(['newest', 'highest', 'lowest']) sort = 'newest';
}
export class FeedbackVersionDto {
  @IsInt() @Min(0) @Max(2147483646) version!: number;
}
export class WriteProductFeedbackDto extends FeedbackVersionDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
  @Transform(trim) @IsString() @Length(10, 1500) comment!: string;
}
export class ProductReplyDto extends FeedbackVersionDto {
  @Transform(trim) @IsString() @Length(0, 1500) reply!: string;
}
export class ReportProductFeedbackDto {
  @Transform(trim) @IsString() @Length(10, 500) reason!: string;
}
export class ProductReportsDto extends FeedbackPageDto {
  @IsEnum(ShopReviewReportStatus) status: ShopReviewReportStatus = 'OPEN';
}
export class ModerateProductFeedbackDto {
  @IsIn(['HIDE', 'DISMISS']) action!: 'HIDE' | 'DISMISS';
  @Transform(trim) @IsString() @Length(10, 500) note!: string;
}
