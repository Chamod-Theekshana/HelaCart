import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { IntervalWorker, workerLocks } from '../common/advisory-lock.js';
import { FavoriteAlertsService } from './favorite-alerts.service.js';

/** Favorite price-drop/restock alerts; one replica per tick (advisory lock). */
@Injectable()
export class DiscoveryWorker
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(DiscoveryWorker.name);
  readonly worker: IntervalWorker;
  constructor(
    prisma: PrismaService,
    private readonly alerts: FavoriteAlertsService,
    private readonly config: ConfigService,
  ) {
    this.worker = new IntervalWorker(
      prisma,
      this.logger,
      workerLocks.favoriteAlerts,
      60_000,
      async (stopped) => {
        for (let i = 0; i < 5; i++)
          if (stopped() || (await this.alerts.processDue(100)).processed < 100)
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
