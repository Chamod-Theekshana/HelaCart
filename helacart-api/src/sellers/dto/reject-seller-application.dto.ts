import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class RejectSellerApplicationDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(10, 500)
  reason!: string;
}
