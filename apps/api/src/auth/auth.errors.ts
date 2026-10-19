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

export function googleUnavailable(): HttpException {
  return new HttpException(
    { code: 'GOOGLE_SIGNIN_UNAVAILABLE', message: 'Google sign-in is not set up on this server' },
    HttpStatus.SERVICE_UNAVAILABLE,
  );
}

export function googleTokenInvalid(): HttpException {
  return new HttpException(
    { code: 'GOOGLE_TOKEN_INVALID', message: 'The Google sign-in could not be verified' },
    HttpStatus.UNAUTHORIZED,
  );
}

// Corporate accounts are opened by Novera and sign in with a password only.
export function googleNotAllowed(): HttpException {
  return new HttpException(
    { code: 'GOOGLE_NOT_ALLOWED', message: 'This account cannot sign in with Google' },
    HttpStatus.FORBIDDEN,
  );
}

// The account was opened with Google and has no password yet: "change password" has nothing to check.
export function passwordNotSet(): HttpException {
  return new HttpException(
    { code: 'PASSWORD_NOT_SET', message: 'This account has no password yet; use "forgot password" to set one' },
    HttpStatus.CONFLICT,
  );
}
