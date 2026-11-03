import { createHash, timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

type Window = { started: number; count: number };

export const internalApiHeader = 'x-helacart-internal';

/**
 * Unverified `sub` claim of a bearer JWT, hashed. Used only to spread the
 * write buckets of many buyers behind one carrier NAT; a forged subject still
 * hits the per-IP ceiling (multiplier x limit), and auth guards verify tokens.
 */
export function bearerSubjectKey(authorization?: string): string | undefined {
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return undefined;
  let subject = token;
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'),
    ) as { sub?: unknown; user_id?: unknown };
    const claim = payload.sub ?? payload.user_id;
    if (typeof claim === 'string' && claim.length <= 128) subject = claim;
  } catch {
    // Opaque or malformed token: fall back to hashing the token itself.
  }
  return createHash('sha256').update(subject).digest('hex').slice(0, 24);
}

function sameSecret(expected: string, actual: unknown) {
  if (!expected || typeof actual !== 'string' || !actual) return false;
  const a = createHash('sha256').update(expected).digest();
  const b = createHash('sha256').update(actual).digest();
  return timingSafeEqual(a, b);
}

/** Per-process safeguard; deploy an ingress limiter when running multiple replicas. */
@Injectable()
export class RequestLimitGuard implements CanActivate {
  private readonly windows = new Map<string, Window>();
  private readonly interval = 60_000;
  private readonly general: number;
  private readonly write: number;
  private readonly content: number;
  private readonly multiplier: number;
  private readonly internalToken: string;

  constructor(@Optional() config?: ConfigService) {
    this.general = config?.get<number>('RATE_LIMIT_GENERAL_PER_MINUTE') ?? 180;
    this.write = config?.get<number>('RATE_LIMIT_WRITE_PER_MINUTE') ?? 20;
    this.content = config?.get<number>('RATE_LIMIT_CONTENT_PER_MINUTE') ?? 30;
    this.multiplier =
      config?.get<number>('RATE_LIMIT_AUTHENTICATED_IP_MULTIPLIER') ?? 5;
    this.internalToken = config?.get<string>('INTERNAL_API_TOKEN') ?? '';
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.path === '/api/v1/health') return true;
    const ip = request.ip || request.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const subject = bearerSubjectKey(request.headers?.authorization);
    // Authenticated callers are bucketed by ip + subject with a higher per-IP
    // ceiling; anonymous callers by IP alone.
    const limit = (bucket: string, perMinute: number) => {
      if (subject) {
        // Per-IP ceiling first: requests it rejects never create per-subject
        // windows, so forged subjects cannot flood the map and evict it.
        this.consume(`${bucket}:${ip}:auth`, perMinute * this.multiplier, now);
        this.consume(`${bucket}:${ip}:${subject}`, perMinute, now);
      } else this.consume(`${bucket}:${ip}`, perMinute, now);
    };
    // Server-to-server storefront calls skip only the general per-IP bucket.
    if (!sameSecret(this.internalToken, request.headers?.[internalApiHeader]))
      limit('all', this.general);
    if (
      request.method !== 'GET' &&
      request.method !== 'HEAD' &&
      request.method !== 'OPTIONS'
    ) {
      const path = request.path;
      if (
        /^\/api\/v1\/(?:sellers\/[^/]+\/promotions|admin\/promotions|me\/favorites\/[^/]+\/alerts)(?:\/|$)/.test(
          path,
        )
      )
        limit('discovery', this.write);
      if (
        /^\/api\/v1\/(?:sellers\/[^/]+|admin)\/(?:bulk-tools|stock-alerts)(?:\/|$)/.test(
          path,
        )
      )
        limit('business-tools', this.write);
      if (
        /^\/api\/v1\/(?:products\/[^/]+\/customer-reviews|sellers\/[^/]+\/(?:product-reviews|team)|admin\/(?:product-review-reports|accounts))(?:\/|$)/.test(
          path,
        )
      )
        limit('product-permissions', this.write);
      if (
        /^\/api\/v1\/(?:me|admin|sellers\/[^/]+)\/after-sales(?:\/|$)/.test(
          path,
        )
      )
        limit('after-sales', this.write);
      if (
        /^\/api\/v1\/(?:admin\/commission|sellers\/[^/]+\/commission)(?:\/|$)/.test(
          path,
        )
      )
        limit('commission', this.write);
      if (
        path === '/api/v1/auth/me' ||
        path === '/api/v1/auth/me/photo' ||
        /^\/api\/v1\/(?:me\/orders\/checkout|me\/returns|me\/account|me\/phone-verifications(?:\/[^/]+\/confirm)?|seller-applications|sellers\/[^/]+\/products\/[^/]+\/images|sellers\/[^/]+\/shop\/images\/(?:logo|cover))$/.test(
          path,
        )
      ) {
        limit('sensitive', this.write);
      }
      if (
        /^\/api\/v1\/admin\/(?:categories(?:\/[^/]+(?:\/image)?)?|storefront\/hero(?:\/publish|\/images\/[^/]+)?)$/.test(
          path,
        )
      )
        limit('storefront-content', this.content);
      if (
        /^\/api\/v1\/admin\/(?:seller-applications\/[^/]+\/verification|sellers\/[^/]+\/status|orders\/[^/]+\/actions)$/.test(
          path,
        )
      )
        limit('verification', this.write);
      if (
        /^\/api\/v1\/shops\/[^/]+\/reviews\//.test(path) ||
        /^\/api\/v1\/sellers\/[^/]+\/reviews\//.test(path)
      )
        limit('reviews', this.write);
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
