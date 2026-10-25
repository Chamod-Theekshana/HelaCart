import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ListQuery } from '../workspace/workspace.dto.js';

export class ContentRevisionDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2147483646)
  expectedRevision!: number;
}
export class CategoryListDto extends ListQuery {
  @IsIn(['all', 'active', 'archived']) @IsOptional() availability:
    'all' | 'active' | 'archived' = 'all';
}
export class UpdateCategoryDto extends ContentRevisionDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 80)
  name!: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(0, 500)
  description!: string;
  @IsInt() @Min(0) @Max(10000) sortOrder!: number;
  @IsBoolean() isActive!: boolean;
}
export class UpdateHeroDto extends ContentRevisionDto {
  @IsString() @Length(1, 80) eyebrow!: string;
  @IsString() @Length(1, 60) title!: string;
  @IsString() @Length(0, 60) accent!: string;
  @IsString() @Length(1, 240) description!: string;
  @IsString() @Length(1, 36) buttonLabel!: string;
  @IsString()
  @Length(1, 200)
  @Matches(
    /^\/(?:products|shops)(?:\/[a-zA-Z0-9-]+)?(?:\?[a-zA-Z0-9%_=&+.,~-]*)?$/,
  )
  buttonHref!: string;
  @IsString() @Length(1, 160) imageAlt!: string;
}
