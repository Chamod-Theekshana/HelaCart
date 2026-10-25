import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsString, Length, Max, Min } from 'class-validator';

export class UpdateShopVerificationDto {
  @IsBoolean()
  isVerified!: boolean;

  @IsInt()
  @Min(0)
  @Max(2147483646)
  expectedVersion!: number;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(10, 500)
  reason!: string;
}
