import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../generated/prisma/client.js';
import { describeError } from './describe-error.js';
import { requestIdOf } from './request-id.js';

type ErrorBody = Record<string, unknown> & {
  statusCode: number;
  message: unknown;
};

const driverKinds: Record<string, string> = {
  UniqueConstraintViolation: '23505',
  ForeignKeyConstraintViolation: '23503',
  NullConstraintViolation: '23502',
  TransactionWriteConflict: '40001',
};

/** Extracts a PostgreSQL SQLSTATE from Prisma / driver-adapter errors. */
export function sqlState(error: unknown): string | undefined {
  const candidate = error as {
    code?: unknown;
    meta?: {
      code?: unknown;
      driverAdapterError?: {
        cause?: { originalCode?: unknown; kind?: unknown; code?: unknown };
      };
    };
    cause?: { originalCode?: unknown; kind?: unknown; code?: unknown };
  };
  const cause = candidate?.meta?.driverAdapterError?.cause ?? candidate?.cause;
  for (const value of [candidate?.meta?.code, cause?.originalCode, cause?.code])
    if (typeof value === 'string' && /^[0-9A-Z]{5}$/.test(value)) return value;
  if (typeof cause?.kind === 'string' && driverKinds[cause.kind])
    return driverKinds[cause.kind];
  return undefined;
}

/** Maps database failures to safe client responses; null means "unexpected". */
export function databaseErrorResponse(
  error: unknown,
): { status: number; message: string } | null {
  const known = error instanceof Prisma.PrismaClientKnownRequestError;
  const code = known ? error.code : undefined;
  const state = sqlState(error);
  if (code === 'P2002' || state === '23505')
    return { status: 409, message: 'This record already exists' };
  if (code === 'P2025') return { status: 404, message: 'Record not found' };
  if (code === 'P2034' || state === '40001' || state === '40P01')
    return {
      status: 409,
      message: 'The record changed at the same time. Reload and retry',
    };
  if (code === 'P2003' || state === '23503')
    return {
      status: 409,
      message: 'This change conflicts with related records',
    };
  // RAISE EXCEPTION in an integrity trigger (append-only history, snapshots).
  if (state === 'P0001')
    return {
      status: 409,
      message: 'This change is not allowed for the current record state',
    };
  if (
    code === 'P2004' ||
    code === 'P2011' ||
    state === '23514' ||
    state === '23502' ||
    state === '22001' ||
    state === '22003'
  )
    return { status: 400, message: 'The request violates a data rule' };
  if (
    code === 'P1001' ||
    code === 'P1002' ||
    code === 'P1008' ||
    code === 'P2024' ||
    state === '57014' ||
    state === '53300'
  )
    return {
      status: 503,
      message: 'Service temporarily unavailable. Please retry shortly',
    };
  return null;
}

/**
 * Global filter: keeps Nest's `{ statusCode, message, error }` shape, maps
 * Prisma/PostgreSQL errors to 4xx without leaking SQL or driver details, and
 * logs every 5xx with the request id.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') throw exception;
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const requestId = requestIdOf(request);
    const { status, body } = this.resolve(exception);
    if (status >= 500)
      this.logger.error(
        {
          msg: 'Request failed',
          requestId,
          method: request?.method,
          path: request?.path,
          status,
          error: describeError(exception),
        },
        exception instanceof Error ? exception.stack : undefined,
      );
    else if (!(exception instanceof HttpException))
      this.logger.warn({
        msg: 'Database rule rejected a request',
        requestId,
        method: request?.method,
        path: request?.path,
        status,
        error: describeError(exception),
      });
    if (response.headersSent) return;
    response.status(status).json(body);
  }

  private resolve(exception: unknown): { status: number; body: ErrorBody } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      return {
        status,
        body:
          typeof payload === 'string'
            ? { statusCode: status, message: payload }
            : (payload as ErrorBody),
      };
    }
    const mapped = databaseErrorResponse(exception);
    if (mapped)
      return {
        status: mapped.status,
        body: {
          statusCode: mapped.status,
          message: mapped.message,
          error:
            mapped.status === 409
              ? 'Conflict'
              : mapped.status === 404
                ? 'Not Found'
                : mapped.status === 400
                  ? 'Bad Request'
                  : 'Service Unavailable',
        },
      };
    return {
      status: 500,
      body: { statusCode: 500, message: 'Internal server error' },
    };
  }
}
