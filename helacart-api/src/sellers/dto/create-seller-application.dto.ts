import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateSellerApplicationDto {
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  name!: string;

  @Transform(trim)
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must contain lowercase letters, numbers and single hyphens',
  })
  @Length(3, 60)
  slug!: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @Transform(trim)
  @IsString()
  @Matches(/^(?:0\d{9}|\+94\d{9})$/, {
    message:
      'contactPhone must be a Sri Lankan number (0XXXXXXXXX or +94XXXXXXXXX)',
  })
  contactPhone!: string;

  @Transform(trim)
  @IsString()
  @Length(10, 300)
  pickupAddress!: string;
}
