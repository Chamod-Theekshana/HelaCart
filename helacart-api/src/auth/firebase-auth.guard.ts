import { createHash } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseAdminService } from './firebase-admin.service.js';
import { AccountAccessService } from './account-access.service.js';

export type AuthenticatedRequest = Request & {
  user: DecodedIdToken;
};

type CachedIdentity = { identity: DecodedIdToken; expiresAt: number };

const maxCachedTokens = 10_000;

/**
 * Successful `verifyIdToken(token, checkRevoked=true)` results, keyed by the
 * SHA-256 of the token (the raw token is never stored). Shared by every guard
 * instance so each module's guard copy benefits. Account suspension/deletion is
 * still checked on every request by AccountAccessService.
 */
export class VerifiedTokenCache {
  private readonly entries = new Map<string, CachedIdentity>();

  constructor(private readonly maxEntries = maxCachedTokens) {}

  static key(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  get(token: string, now = Date.now()): DecodedIdToken | undefined {
    const key = VerifiedTokenCache.key(token);
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.identity;
  }

  set(
    token: string,
    identity: DecodedIdToken,
    ttlMs: number,
    now = Date.now(),
  ) {
    const tokenExpiry =
      typeof identity.exp === 'number' ? identity.exp * 1000 : now;
    const expiresAt = Math.min(now + ttlMs, tokenExpiry);
    if (expiresAt <= now) return;
    if (this.entries.size >= this.maxEntries) {
      for (const [key, value] of this.entries)
        if (value.expiresAt <= now) this.entries.delete(key);
      while (this.entries.size >= this.maxEntries)
        this.entries.delete(this.entries.keys().next().value!);
    }
    this.entries.set(VerifiedTokenCache.key(token), { identity, expiresAt });
  }

  get size() {
    return this.entries.size;
  }

  clear() {
    this.entries.clear();
  }
}

export const verifiedTokenCache = new VerifiedTokenCache();

/** Admin API paths (with or without the global /api/v1 prefix). */
export function isAdminPath(path: string | undefined): boolean {
  return /^(?:\/api\/v1)?\/(?:admin|workspace\/admin)(?:\/|$)/.test(path ?? '');
}

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly ttlMs: number;
  private readonly cache = verifiedTokenCache;

  constructor(
    private readonly firebase: FirebaseAdminService,
    private readonly access: AccountAccessService,
    @Optional() config?: ConfigService,
  ) {
    // 0 (the default without configuration, and in tests) disables caching.
    this.ttlMs =
      Math.min(
        60,
        Math.max(0, config?.get<number>('AUTH_TOKEN_CACHE_SECONDS') ?? 0),
      ) * 1000;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const match = request.headers.authorization?.match(/^Bearer\s+(\S+)$/i);
    if (!match) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = match[1];
    // Admin routes always re-check revocation with Firebase: a revoked admin
    // session must stop working immediately, not after the cache window.
    const useCache = this.ttlMs > 0 && !isAdminPath(request.path);
    const cached = useCache ? this.cache.get(token) : undefined;
    if (cached) request.user = cached;
    else {
      try {
        request.user = await this.firebase.verifyIdToken(token, true);
      } catch {
        throw new UnauthorizedException('Invalid or expired Firebase token');
      }
      if (useCache) this.cache.set(token, request.user, this.ttlMs);
    }
    await this.access.assertActive(request.user.uid);
    return true;
  }
}
