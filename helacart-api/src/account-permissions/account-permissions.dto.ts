import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { AccountAccessStatus } from '../generated/prisma/client.js';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class AccountsQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20;
  @IsOptional() @Transform(trim) @IsString() @Length(2, 100) q?: string;
  @IsOptional() @IsEnum(AccountAccessStatus) status?: AccountAccessStatus;
}
export class AccessDecisionDto {
  @IsInt() @Min(0) @Max(2147483646) version!: number;
  // DELETED is reserved for owner-initiated account deletion.
  @IsIn([AccountAccessStatus.ACTIVE, AccountAccessStatus.SUSPENDED])
  status!: 'ACTIVE' | 'SUSPENDED';
  @Transform(trim) @IsString() @Length(10, 500) reason!: string;
}
export class TeamReasonDto {
  @Transform(trim) @IsString() @Length(10, 500) reason!: string;
}
export class AddManagerDto extends TeamReasonDto {
  @Transform(trim) @IsEmail() @Length(3, 254) email!: string;
}
