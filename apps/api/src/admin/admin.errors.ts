import { HttpException, HttpStatus } from '@nestjs/common';

// Signed in, but not an administrator (ADR-24). No session at all is the usual 401 UNAUTHENTICATED.
export function forbidden(): HttpException {
  return new HttpException({ code: 'FORBIDDEN', message: 'This is not allowed' }, HttpStatus.FORBIDDEN);
}

// The record is used by something that depends on it, so it cannot be removed or closed (ADMIN.md §3.1). `details` says how
// much (for a branch: its bookings, holds and cars), so the screen can list the reasons; `message` is for the developer.
export function inUse(message: string, details?: Record<string, number>): HttpException {
  return new HttpException({ code: 'IN_USE', message, ...(details ? { details } : {}) }, HttpStatus.CONFLICT);
}

// The edit was made against an older copy of the record: someone else changed it in between (ADR-24). Nothing was written.
export function staleWrite(): HttpException {
  return new HttpException(
    { code: 'STALE_WRITE', message: 'The record was changed by someone else; load it again' },
    HttpStatus.CONFLICT,
  );
}

// The thing asked for cannot happen from where the record is now: a booking that has started or is already cancelled cannot be
// cancelled (ADMIN.md §3.2). Nothing was written. `message` is for the developer.
export function invalidTransition(message: string): HttpException {
  return new HttpException({ code: 'INVALID_TRANSITION', message }, HttpStatus.CONFLICT);
}
