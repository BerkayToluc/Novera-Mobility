import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Request } from 'express';

// Limits repeated requests from the same client on the form, sign-in and hold endpoints (ADR-20).
//
// It lives in memory: counters reset when the server restarts, and with more than one server each one
// keeps its own. That is enough to slow spam down in v1. The table is bounded (see MAX_TRACKED_KEYS) so a
// flood of made-up keys cannot use up the server's memory.
export const MAX_TRACKED_KEYS = 10_000;
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class RateLimiter {
  // Least recently used key first, most recently used last (see `touch`).
  private readonly hits = new Map<string, number[]>();

  // True when the request is allowed (and it is recorded). A refused request is not counted,
  // so the client can try again once the window has passed.
  allow(
    key: string,
    limit: number,
    windowMs: number,
    now: number = Date.now(),
  ): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => t > now - windowMs);
    if (recent.length >= limit) {
      this.touch(key, recent);
      return false;
    }
    recent.push(now);
    this.touch(key, recent);
    if (this.hits.size > MAX_TRACKED_KEYS) this.shrink(now);
    return true;
  }

  // Moves the key to the end of the table, so the keys at the front are always the least recently used.
  private touch(key: string, times: number[]): void {
    this.hits.delete(key);
    this.hits.set(key, times);
  }

  // Drops stale keys first; if the table is still too big, drops the least recently used ones.
  private shrink(now: number): void {
    for (const [key, times] of this.hits) {
      const newest = times[times.length - 1];
      if (newest === undefined || newest <= now - STALE_AFTER_MS) {
        this.hits.delete(key);
      }
    }
    for (const key of this.hits.keys()) {
      if (this.hits.size <= MAX_TRACKED_KEYS) break;
      this.hits.delete(key);
    }
  }
}

// Recognises the client by a hash of its address; the address itself is not stored.
//
// The address is `request.ip`. Express works it out from the connection and from the `X-Forwarded-For`
// header, and trusts that header only as far as TRUST_PROXY_HOPS says (see app.setup.ts): the entries
// added by our own proxies count, anything a visitor typed further left does not. Reading the first
// entry of the header by hand, as this function used to, let anyone choose their own key.
export function clientKeyOf(request: Request): string {
  const address = request.ip || request.socket.remoteAddress || 'unknown';
  return createHash('sha256').update(address).digest('hex').slice(0, 32);
}