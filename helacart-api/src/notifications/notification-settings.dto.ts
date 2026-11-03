import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RegisterDeviceDto {
  // Printable ASCII and <= 2048 chars: the unique B-tree index on the token
  // rejects entries above ~2.7 kB (FCM tokens are ~150-300 ASCII chars).
  @Transform(trim)
  @IsString()
  @Length(20, 2048)
  @Matches(/^[\x21-\x7e]+$/)
  token!: string;
  @IsIn(['android', 'ios', 'web']) platform!: 'android' | 'ios' | 'web';
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 30)
  @Matches(/^[0-9A-Za-z.+_-]+$/)
  appVersion?: string;
}

export class UnregisterDeviceDto {
  @Transform(trim) @IsString() @Length(20, 4096) token!: string;
}

export class NotificationPreferencesDto {
  @IsBoolean() push!: boolean;
  @IsBoolean() email!: boolean;
  @IsBoolean() sms!: boolean;
}
