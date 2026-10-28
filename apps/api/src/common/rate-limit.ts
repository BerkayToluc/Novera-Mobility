import { HttpException, HttpStatus, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { UserRow } from '../auth/user-view.js';

// The rate limit of an endpoint (ARCHITECTURE ADR-27). Every endpoint has one: the default below unless the
// handler names its own with `@RateLimit(...)`, and `/health` is exempt (`@NoRateLimit()`).
//
// A window is fixed: `windowSec` long, starting on a multiple of itself. A request in the window adds one to the
// counter of its key; the one that takes the counter above `limit` is refused with `429 RATE_LIMITED` and a
// `Retry-After` header. A client can send up to twice the limit around a window edge; that is the price of one
// atomic counter per window, and the limits are set with it in mind.
export interface RateLimitSpec {
  // The group of endpoints that share this counter; also the row in SECURITY.md's table.
  bucket: string;
  limit: number;
  windowSec: number;
  // Whose counter it is. `principal` (the default): `user:<id>` when signed in, otherwise `ip:<hash>`.
  // `client`: always the address. A function gives its own key (for example the e-mail address in the body)
  // or null to skip this limit for the request.
  key?: 'principal' | 'client' | ((request: Request, user: UserRow | null) => string | null);
}

export const DEFAULT_RATE_LIMIT: RateLimitSpec = { bucket: 'default', limit: 300, windowSec: 5 * 60 };

const RATE_LIMIT_METADATA = 'novera:rate-limit';
const NO_RATE_LIMIT_METADATA = 'novera:no-rate-limit';

export const RateLimit = (...specs: RateLimitSpec[]) => SetMetadata(RATE_LIMIT_METADATA, specs);
export const NoRateLimit = () => SetMetadata(NO_RATE_LIMIT_METADATA, true);
export { RATE_LIMIT_METADATA, NO_RATE_LIMIT_METADATA };

// 429 RATE_LIMITED. The body is the usual `{ code, message }`; the filter reads `retryAfterSeconds` for the
// `Retry-After` header.
export class RateLimitedException extends HttpException {
  constructor(readonly retryAfterSeconds: number) {
    super({ code: 'RATE_LIMITED', message: 'Too many requests, try again later' }, HttpStatus.TOO_MANY_REQUESTS);
  }
}
