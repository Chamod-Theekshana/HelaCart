import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export const requestIdHeader = 'x-request-id';
const acceptable = /^[A-Za-z0-9_-]{1,64}$/;

export type RequestWithId = Request & { requestId?: string };

/** Accepts a well-formed client request id or generates one, and echoes it. */
export function resolveRequestId(value: unknown): string {
  return typeof value === 'string' && acceptable.test(value)
    ? value
    : randomUUID();
}

export function requestIdMiddleware(options: { logRequests: boolean }) {
  const logger = new Logger('HTTP');
  return (request: Request, response: Response, next: NextFunction) => {
    const id = resolveRequestId(request.headers[requestIdHeader]);
    (request as RequestWithId).requestId = id;
    response.setHeader(requestIdHeader, id);
    if (options.logRequests) {
      const started = process.hrtime.bigint();
      response.on('finish', () => {
        // Never log query strings: they can contain search text or tokens.
        logger.log({
          msg: 'request completed',
          requestId: id,
          method: request.method,
          path: request.path,
          status: response.statusCode,
          durationMs: Number((process.hrtime.bigint() - started) / 1_000_000n),
        });
      });
    }
    next();
  };
}

export function requestIdOf(request: unknown): string | undefined {
  return (request as RequestWithId | undefined)?.requestId;
}
