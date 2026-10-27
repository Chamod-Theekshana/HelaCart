import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StockAlertsService } from './stock-alerts.service.js';
@Injectable()
export class StockAlertsWorker
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(StockAlertsWorker.name);
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  constructor(
    private readonly stock: StockAlertsService,
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
      for (let i = 0; i < 10; i++) {
        if (
          this.stopped ||
          (await this.stock.processDirty(100)).processed < 100
        )
          break;
      }
    } catch {
      this.logger.warn(
        'Stock alerts could not be checked; retrying on next tick',
      );
    } finally {
      if (!this.stopped) this.schedule(60000);
    }
  }
}
