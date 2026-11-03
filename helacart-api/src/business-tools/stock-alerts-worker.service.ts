import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { IntervalWorker, workerLocks } from '../common/advisory-lock.js';
import { StockAlertsService } from './stock-alerts.service.js';

/** Low-stock notifications; one replica per tick (advisory lock). */
@Injectable()
export class StockAlertsWorker
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(StockAlertsWorker.name);
  readonly worker: IntervalWorker;
  constructor(
    prisma: PrismaService,
    private readonly stock: StockAlertsService,
    private readonly config: ConfigService,
  ) {
    this.worker = new IntervalWorker(
      prisma,
      this.logger,
      workerLocks.stockAlerts,
      60_000,
      async (stopped) => {
        for (let i = 0; i < 10; i++)
          if (stopped() || (await this.stock.processDirty(100)).processed < 100)
            break;
      },
    );
  }
  onApplicationBootstrap() {
    if (this.config.get<string>('NODE_ENV') !== 'test') this.worker.start(1000);
  }
  onModuleDestroy() {
    this.worker.stop();
  }
}
