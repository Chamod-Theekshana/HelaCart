import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class StartPhoneVerificationDto {
  // Format is checked by the service so the response carries PHONE_INVALID.
  @Transform(trim) @IsString() @Length(1, 30) phone!: string;
}

export class ConfirmPhoneVerificationDto {
  // Checked by the service so a malformed code also yields OTP_INVALID.
  @Transform(trim) @IsString() @Length(1, 12) code!: string;
}
