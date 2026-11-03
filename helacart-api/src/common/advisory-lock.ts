import type { Logger } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import { describeError } from './describe-error.js';

/** One fixed key per background worker so only one replica runs each tick. */
export const workerLocks = {
  favoriteAlerts: 731_001,
  stockAlerts: 731_002,
  reservationExpiry: 731_003,
  notificationDelivery: 731_004,
  orderAutoCancel: 731_005,
} as const;

/**
 * Runs `work` only if this process wins the Postgres advisory lock for `key`.
 *
 * The lock is a transaction-scoped `pg_try_advisory_xact_lock` taken inside a
 * holder transaction that stays open while the tick runs. Session-level
 * `pg_try_advisory_lock` would be unsafe here: Prisma's pool (and Neon's
 * PgBouncer pooler) may run lock and unlock on different connections, leaking
 * the lock. The xact lock is released automatically when the holder commits,
 * rolls back or its connection dies, so a crashed replica never blocks others.
 */
export async function runExclusive(
  prisma: Pick<PrismaService, '$transaction'>,
  key: number,
  work: () => Promise<void>,
  options: { maxMs?: number } = {},
): Promise<boolean> {
  let ran = false;
  await prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<{ locked: boolean }[]>`
        SELECT pg_try_advisory_xact_lock(${key}::bigint) AS locked`;
      if (!rows[0]?.locked) return;
      ran = true;
      await work();
    },
    { timeout: options.maxMs ?? 240_000, maxWait: 10_000 },
  );
  return ran;
}

/** Holder-transaction timeout used by IntervalWorker ticks. */
export const workerLockMaxMs = 240_000;
/**
 * A tick reports "stopped" after this long so it finishes well before the
 * holder transaction times out. Once it times out the lock is released while
 * work may still be running, and another replica could process the same rows.
 */
export const workerTickBudgetMs = 150_000;

/**
 * Interval worker scaffolding: schedules ticks, takes the advisory lock and
 * logs (never swallows) failures.
 */
export class IntervalWorker {
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;

  constructor(
    private readonly prisma: Pick<PrismaService, '$transaction'>,
    private readonly logger: Logger,
    private readonly lockKey: number,
    private readonly intervalMs: number,
    private readonly tick: (isStopped: () => boolean) => Promise<void>,
  ) {}

  start(initialDelayMs: number) {
    this.stopped = false;
    this.schedule(initialDelayMs);
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  /** Runs one locked tick now; returns false when another replica holds the lock. */
  async runOnce(): Promise<boolean> {
    const deadline = Date.now() + workerTickBudgetMs;
    try {
      return await runExclusive(
        this.prisma,
        this.lockKey,
        () => this.tick(() => this.stopped || Date.now() > deadline),
        { maxMs: workerLockMaxMs },
      );
    } catch (error) {
      this.logger.error(
        `Worker tick failed; retrying on next tick. ${describeError(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }

  private schedule(delay: number) {
    this.timer = setTimeout(() => {
      void this.runOnce().finally(() => {
        if (!this.stopped) this.schedule(this.intervalMs);
      });
    }, delay);
    this.timer.unref();
  }
}
