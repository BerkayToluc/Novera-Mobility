import { HttpException, HttpStatus } from '@nestjs/common';

// Signed in, but not an administrator (ADR-24). No session at all is the usual 401 UNAUTHENTICATED.
export function forbidden(): HttpException {
  return new HttpException({ code: 'FORBIDDEN', message: 'This is not allowed' }, HttpStatus.FORBIDDEN);
}
