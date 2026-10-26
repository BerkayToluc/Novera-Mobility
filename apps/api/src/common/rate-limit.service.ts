import { Inject, Injectable } from '@nestjs/common';
import { RateLimitedException, type RateLimitSpec } from './rate-limit.js';
import { RateLimitStore } from './rate-limit.store.js';

@Injectable()
export class RateLimitService {
  constructor(@Inject(RateLimitStore) private readonly store: RateLimitStore) {}

  // Counts one request against `spec` for `key` and throws 429 when it is over the limit. `now` is a parameter
  // so tests can fix the clock.
  async consume(spec: RateLimitSpec, key: string, now: Date = new Date()): Promise<void> {
    const windowMs = spec.windowSec * 1000;
    const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
    const count = await this.store.hit(key, spec.bucket, windowStart);
    if (count > spec.limit) {
      const retryAfter = Math.max(1, Math.ceil((windowStart.getTime() + windowMs - now.getTime()) / 1000));
      throw new RateLimitedException(retryAfter);
    }
  }
}
