import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  ValidateIf,
} from 'class-validator';

export class ApproveSellerApplicationDto {
  @IsOptional()
  @IsBoolean()
  verifyShop?: boolean;

  @ValidateIf((dto: ApproveSellerApplicationDto) => dto.verifyShop === true)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(10, 500)
  verificationReason?: string;
}
