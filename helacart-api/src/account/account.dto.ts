import { IsIn } from 'class-validator';

export class DeleteAccountDto {
  @IsIn(['DELETE']) confirm!: 'DELETE';
}
