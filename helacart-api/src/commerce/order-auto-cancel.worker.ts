import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { IntervalWorker, workerLocks } from '../common/advisory-lock.js';
import { CommerceService } from './commerce.service.js';

/** Cancels PLACED seller orders not accepted within SELLER_ACCEPT_HOURS. */
@Injectable()
export class OrderAutoCancelWorker
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(OrderAutoCancelWorker.name);
  readonly worker: IntervalWorker;

  constructor(
    prisma: PrismaService,
    private readonly commerce: CommerceService,
    private readonly config: ConfigService,
  ) {
    this.worker = new IntervalWorker(
      prisma,
      this.logger,
      workerLocks.orderAutoCancel,
      5 * 60_000,
      async (stopped) => {
        for (let i = 0; i < 10; i++) {
          if (stopped()) break;
          const result = await this.commerce.autoCancelDue(50);
          if (result.cancelled)
            this.logger.log(
              `Automatically cancelled ${result.cancelled} unaccepted seller orders`,
            );
          if (result.processed < 50) break;
        }
      },
    );
  }

  onApplicationBootstrap() {
    if (this.config.get<string>('NODE_ENV') !== 'test')
      this.worker.start(30_000);
  }

  onModuleDestroy() {
    this.worker.stop();
  }
}
