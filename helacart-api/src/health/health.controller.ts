import {
  Controller,
  Get,
  Header,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly database: PrismaService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  live() {
    return { status: 'ok', service: 'helacart-api' };
  }

  @Get('ready')
  @Header('Cache-Control', 'no-store')
  async ready() {
    try {
      await this.database.checkConnection();
      return { status: 'ok', service: 'helacart-api', database: 'connected' };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'unavailable',
      });
    }
  }
}
