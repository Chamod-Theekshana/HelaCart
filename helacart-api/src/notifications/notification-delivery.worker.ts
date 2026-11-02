import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { IntervalWorker, workerLocks } from '../common/advisory-lock.js';
import { NotificationDeliveryService } from './notification-delivery.service.js';

/** Drains the email/SMS/push outbox every 15 seconds on one replica. */
@Injectable()
export class NotificationDeliveryWorker
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationDeliveryWorker.name);
  readonly worker: IntervalWorker;

  constructor(
    prisma: PrismaService,
    private readonly deliveries: NotificationDeliveryService,
    private readonly config: ConfigService,
  ) {
    this.worker = new IntervalWorker(
      prisma,
      this.logger,
      workerLocks.notificationDelivery,
      15_000,
      async (stopped) => {
        for (let i = 0; i < 10; i++)
          if (
            stopped() ||
            (await this.deliveries.processDue(50, stopped)).processed < 50
          )
            break;
      },
    );
  }

  onApplicationBootstrap() {
    if (this.config.get<string>('NODE_ENV') !== 'test')
      this.worker.start(5_000);
  }

  onModuleDestroy() {
    this.worker.stop();
  }
}
