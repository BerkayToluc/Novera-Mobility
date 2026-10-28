import { createParamDecorator, Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { unauthenticated } from './auth.errors.js';
import { AuthService } from './auth.service.js';
import { SESSION_COOKIE, readCookie } from './session-token.js';
import type { UserRow } from './user-view.js';

export type AuthedRequest = Request & { user?: UserRow };

// Korumalı uçlarda `@UseGuards(SessionGuard)` ile kullanılır. Oturum yoksa 401 UNAUTHENTICATED.
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const user = await userOfRequest(this.auth, request);
    if (!user) throw unauthenticated();
    return true;
  }
}

// Uç fonksiyonunda oturumdaki kullanıcıyı verir: `me(@CurrentUser() user: UserRow)`.
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): UserRow => {
  const request = context.switchToHttp().getRequest<AuthedRequest>();
  if (!request.user) throw unauthenticated();
  return request.user;
});
// Who is signed in, if anyone: the session cookie is looked up once per request and the answer is kept on it, so the
// rate limit guard, the session guard and an endpoint open to visitors all share one lookup (V2-13, QUALITY M-01).
export async function userOfRequest(auth: AuthService, request: AuthedRequest): Promise<UserRow | null> {
  if (request.user === undefined) {
    const token = readCookie(request.headers.cookie, SESSION_COOKIE);
    const user = token ? await auth.authenticate(token) : null;
    if (user) request.user = user;
  }
  return request.user ?? null;
}
