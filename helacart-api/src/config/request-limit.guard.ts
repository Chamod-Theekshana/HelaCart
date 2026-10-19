import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

type Window = { started: number; count: number };

/** Per-process safeguard; deploy an ingress limiter when running multiple replicas. */
@Injectable()
export class RequestLimitGuard implements CanActivate {
  private readonly windows = new Map<string, Window>();
  private readonly interval = 60_000;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.path === '/api/v1/health') return true;
    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    const now = Date.now();
    this.consume(`all:${ip}`, 180, now);
    if (
      request.method !== 'GET' &&
      request.method !== 'HEAD' &&
      request.method !== 'OPTIONS'
    ) {
      if (
        /^\/api\/v1\/(?:me\/orders\/checkout|me\/returns|sellers\/[^/]+\/products\/[^/]+\/images)$/.test(
          request.path,
        )
      ) {
        this.consume(`sensitive:${ip}`, 20, now);
      }
    }
    return true;
  }

  private consume(key: string, limit: number, now: number) {
    const window = this.windows.get(key);
    if (!window || now - window.started >= this.interval) {
      if (this.windows.size >= 10_000) {
        for (const [oldKey, value] of this.windows) {
          if (now - value.started >= this.interval) this.windows.delete(oldKey);
        }
        if (this.windows.size >= 10_000)
          this.windows.delete(this.windows.keys().next().value!);
      }
      this.windows.set(key, { started: now, count: 1 });
      return;
    }
    if (++window.count > limit)
      throw new HttpException('Too many requests; try again shortly', 429);
  }
}
