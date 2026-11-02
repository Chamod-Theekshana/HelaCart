import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';

export class AuditLogQueryDto {
  @IsOptional() @IsUUID('4') cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @Matches(/^[A-Z_]{3,40}$/) action?: string;
}
