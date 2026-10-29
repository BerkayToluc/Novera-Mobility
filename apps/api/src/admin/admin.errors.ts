import { HttpException, HttpStatus } from '@nestjs/common';

// Signed in, but not an administrator (ADR-24). No session at all is the usual 401 UNAUTHENTICATED.
export function forbidden(): HttpException {
  return new HttpException({ code: 'FORBIDDEN', message: 'This is not allowed' }, HttpStatus.FORBIDDEN);
}

// The record is used by something that depends on it, so it cannot be removed (ADMIN.md §3.1). The caller is told what
// to do instead in `message`; the screen words it itself.
export function inUse(message: string): HttpException {
  return new HttpException({ code: 'IN_USE', message }, HttpStatus.CONFLICT);
}

// The edit was made against an older copy of the record: someone else changed it in between (ADR-24). Nothing was written.
export function staleWrite(): HttpException {
  return new HttpException(
    { code: 'STALE_WRITE', message: 'The record was changed by someone else; load it again' },
    HttpStatus.CONFLICT,
  );
}
