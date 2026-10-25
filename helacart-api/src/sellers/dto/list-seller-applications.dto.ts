import { IsEnum, IsOptional } from 'class-validator';
import { SellerStatus } from '../../generated/prisma/client.js';

export class ListSellerApplicationsDto {
  @IsOptional()
  @IsEnum(SellerStatus)
  status?: SellerStatus;
}
