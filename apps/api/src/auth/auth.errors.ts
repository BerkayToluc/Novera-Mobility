import { HttpException, HttpStatus } from '@nestjs/common';

export function unauthenticated(): HttpException {
  return new HttpException(
    { code: 'UNAUTHENTICATED', message: 'Sign in to continue' },
    HttpStatus.UNAUTHORIZED,
  );
}

export function invalidCredentials(): HttpException {
  return new HttpException(
    { code: 'INVALID_CREDENTIALS', message: 'Email or password is wrong' },
    HttpStatus.UNAUTHORIZED,
  );
}

export function emailTaken(): HttpException {
  return new HttpException(
    {
      code: 'EMAIL_TAKEN',
      message: 'An account with this email already exists',
      fieldErrors: { email: 'EMAIL_TAKEN' },
    },
    HttpStatus.CONFLICT,
  );
}
