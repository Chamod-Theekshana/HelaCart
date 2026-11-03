import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { IntervalWorker, workerLocks } from '../common/advisory-lock.js';
import { ReservationService } from './reservation.service.js';

/**
 * Expires InventoryReservation rows. Checkout deducts stock directly and no
 * route creates reservations today, so the loop only runs when
 * RESERVATIONS_ENABLED=true.
 */
@Injectable()
export class ReservationExpiryService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(ReservationExpiryService.name);
  readonly worker: IntervalWorker;

  constructor(
    prisma: PrismaService,
    private readonly reservations: ReservationService,
    private readonly config: ConfigService,
  ) {
    this.worker = new IntervalWorker(
      prisma,
      this.logger,
      workerLocks.reservationExpiry,
      60_000,
      async (stopped) => {
        // Each item is finalised idempotently in its own transaction.
        for (let i = 0; i < 10; i++)
          if (stopped() || (await this.reservations.expireDue(100)) < 100)
            break;
      },
    );
  }

  onApplicationBootstrap() {
    if (this.config.get<string>('NODE_ENV') === 'test') return;
    if (this.config.get<boolean>('RESERVATIONS_ENABLED') !== true) return;
    this.worker.start(0);
  }

  onModuleDestroy() {
    this.worker.stop();
  }
}
