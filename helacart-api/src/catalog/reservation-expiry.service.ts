import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReservationService } from './reservation.service.js';

@Injectable()
export class ReservationExpiryService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(ReservationExpiryService.name);
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;

  constructor(
    private readonly reservations: ReservationService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get<string>('NODE_ENV') === 'test') return;
    this.schedule(0);
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
      // Drain a bounded backlog; each item is finalized idempotently in its own
      // transaction, so several API instances may run this loop safely.
      for (let i = 0; i < 10; i++) {
        if (this.stopped || (await this.reservations.expireDue(100)) < 100)
          break;
      }
    } catch {
      this.logger.warn('Reservation expiry failed; retrying on next tick');
    } finally {
      if (!this.stopped) this.schedule(60_000);
    }
  }
}
