import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FavoriteAlertsService } from './favorite-alerts.service.js';
@Injectable()
export class DiscoveryWorker
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private readonly logger = new Logger(DiscoveryWorker.name);
  constructor(
    private readonly alerts: FavoriteAlertsService,
    private readonly config: ConfigService,
  ) {}
  onApplicationBootstrap() {
    if (this.config.get<string>('NODE_ENV') !== 'test') this.schedule(1000);
  }
  onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }
  private schedule(delay: number) {
    this.timer = setTimeout(() => void this.run(), delay);
    this.timer.unref();
  }
  private async run() {
    try {
      for (let i = 0; i < 5; i++) {
        if (this.stopped || (await this.alerts.processDue(100)).processed < 100)
          break;
      }
    } catch {
      this.logger.warn(
        'Favorite alerts could not be checked; retrying on next tick',
      );
    } finally {
      if (!this.stopped) this.schedule(60000);
    }
  }
}
