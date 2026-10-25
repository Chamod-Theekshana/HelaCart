import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
export class FavoritePageDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) @IsOptional() page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(50) @IsOptional() limit = 12;
}
