import type { LoggerService, LogLevel } from '@nestjs/common';
import { redact } from './describe-error.js';

const stackLike = /\n\s+at .+/;

/**
 * Nest LoggerService that writes one JSON object per line (production). Plain
 * object messages are merged into the record, so `logger.log({ msg, requestId })`
 * produces structured fields.
 */
export class JsonLogger implements LoggerService {
  private levels: Set<LogLevel>;

  constructor(levels: LogLevel[] = ['log', 'error', 'warn', 'fatal']) {
    this.levels = new Set(levels);
  }

  setLogLevels(levels: LogLevel[]) {
    this.levels = new Set(levels);
  }

  log(message: unknown, ...optional: unknown[]) {
    this.write('log', message, optional);
  }
  error(message: unknown, ...optional: unknown[]) {
    this.write('error', message, optional);
  }
  warn(message: unknown, ...optional: unknown[]) {
    this.write('warn', message, optional);
  }
  debug(message: unknown, ...optional: unknown[]) {
    this.write('debug', message, optional);
  }
  verbose(message: unknown, ...optional: unknown[]) {
    this.write('verbose', message, optional);
  }
  fatal(message: unknown, ...optional: unknown[]) {
    this.write('fatal', message, optional);
  }

  /** Exposed for tests: builds the record without writing it. */
  format(level: LogLevel, message: unknown, optional: unknown[]) {
    const params = [...optional];
    let context: string | undefined;
    if (
      params.length &&
      typeof params[params.length - 1] === 'string' &&
      !stackLike.test(params[params.length - 1] as string)
    )
      context = params.pop() as string;
    const stack = params.find(
      (value): value is string =>
        typeof value === 'string' && stackLike.test(value),
    );
    const record: Record<string, unknown> = {
      level,
      time: new Date().toISOString(),
      ...(context ? { context } : {}),
    };
    if (message instanceof Error) {
      record.msg = redact(message.message);
      record.error = message.name;
      if (level === 'error' || level === 'fatal')
        record.stack = redact(message.stack ?? '');
    } else if (message && typeof message === 'object') {
      Object.assign(record, message as Record<string, unknown>);
    } else {
      record.msg = redact(String(message));
    }
    if (stack) record.stack = redact(stack);
    return record;
  }

  private write(level: LogLevel, message: unknown, optional: unknown[]) {
    if (!this.levels.has(level)) return;
    let line: string;
    try {
      line = JSON.stringify(this.format(level, message, optional));
    } catch {
      line = JSON.stringify({ level, msg: 'Unserializable log message' });
    }
    (level === 'error' || level === 'fatal'
      ? process.stderr
      : process.stdout
    ).write(line + '\n');
  }
}
