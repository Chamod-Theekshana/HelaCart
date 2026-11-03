import { ConflictException, type Logger } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import {
  AllExceptionsFilter,
  databaseErrorResponse,
} from './all-exceptions.filter.js';
import { IntervalWorker, runExclusive } from './advisory-lock.js';
import { resolveRequestId } from './request-id.js';
import { JsonLogger } from './json-logger.js';
import { describeError } from './describe-error.js';

const known = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError('database failure', {
    code,
    clientVersion: 'test',
    meta,
  });

function respond(exception: unknown) {
  const response = {
    headersSent: false,
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
  const host = {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'POST',
        path: '/api/v1/x',
        requestId: 'req-1',
      }),
      getResponse: () => response,
    }),
  };
  new AllExceptionsFilter().catch(exception, host as never);
  return {
    status: response.status.mock.calls[0][0] as number,
    body: response.json.mock.calls[0][0] as Record<string, unknown>,
  };
}

describe('Global exception filter', () => {
  it('keeps the Nest error shape and machine-readable codes', () => {
    expect(respond(new ConflictException('Busy'))).toEqual({
      status: 409,
      body: { statusCode: 409, message: 'Busy', error: 'Conflict' },
    });
  });

  it.each([
    [known('P2002'), 409],
    [known('P2025'), 404],
    [known('P2003'), 409],
    [known('P2034'), 409],
    [known('P2010', { code: 'P0001' }), 409],
    [known('P2010', { code: '23514' }), 400],
    [known('P2024'), 503],
  ])('maps database error %# to %i', (error, status) => {
    expect(databaseErrorResponse(error)?.status).toBe(status);
    const { body } = respond(error);
    expect(body.statusCode).toBe(status);
    expect(JSON.stringify(body)).not.toContain('database failure');
  });

  it('maps driver adapter trigger errors without leaking their text', () => {
    const error = Object.assign(
      new Error('Commission history is append only'),
      {
        cause: { originalCode: 'P0001', kind: 'postgres' },
      },
    );
    const { status, body } = respond(error);
    expect(status).toBe(409);
    expect(JSON.stringify(body)).not.toContain('append only');
  });

  it('hides unexpected errors behind a generic 500', () => {
    const { status, body } = respond(
      new Error('postgresql://admin:secret@db/x exploded'),
    );
    expect(status).toBe(500);
    expect(body).toEqual({ statusCode: 500, message: 'Internal server error' });
  });
});

describe('Request ids and logging', () => {
  it('echoes safe client ids and replaces unsafe ones', () => {
    expect(resolveRequestId('abc-DEF_123')).toBe('abc-DEF_123');
    expect(resolveRequestId('a'.repeat(65))).toMatch(/^[0-9a-f-]{36}$/);
    expect(resolveRequestId('bad id\n')).toMatch(/^[0-9a-f-]{36}$/);
    expect(resolveRequestId(undefined)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('formats structured JSON records and redacts credentials', () => {
    const logger = new JsonLogger();
    const record = logger.format(
      'error',
      { msg: 'Request failed', requestId: 'req-1' },
      ['Error: x\n    at fn (file.ts:1:1)', 'Exceptions'],
    );
    expect(record).toMatchObject({
      level: 'error',
      context: 'Exceptions',
      msg: 'Request failed',
      requestId: 'req-1',
    });
    expect(record.stack).toContain('at fn');
    expect(
      describeError(new Error('postgresql://user:pw@host/db failed')),
    ).not.toContain('pw');
  });
});

describe('Single-replica worker ticks', () => {
  const prisma = (locked: boolean) => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([{ locked }]) };
    return {
      tx,
      $transaction: vi.fn((fn: (db: typeof tx) => unknown) => fn(tx)),
    };
  };

  it('runs the tick only when the advisory lock is won', async () => {
    const work = vi.fn();
    const winner = prisma(true);
    expect(await runExclusive(winner as never, 731_001, work)).toBe(true);
    expect(work).toHaveBeenCalledOnce();
    expect(String(winner.tx.$queryRaw.mock.calls[0][0])).toContain(
      'pg_try_advisory_xact_lock',
    );
    const loser = prisma(false);
    expect(await runExclusive(loser as never, 731_001, work)).toBe(false);
    expect(work).toHaveBeenCalledOnce();
  });

  it('logs tick failures instead of swallowing them', async () => {
    const logger = { error: vi.fn() } as unknown as Logger;
    const worker = new IntervalWorker(
      prisma(true) as never,
      logger,
      731_002,
      60_000,
      () => Promise.reject(new Error('boom')),
    );
    expect(await worker.runOnce()).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('boom'),
      expect.any(String),
    );
  });
});
