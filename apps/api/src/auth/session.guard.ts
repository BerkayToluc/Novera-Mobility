import {
  createParamDecorator,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
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
    const token = readCookie(request.headers.cookie, SESSION_COOKIE);
    const user = token ? await this.auth.authenticate(token) : null;
    if (!user) throw unauthenticated();
    request.user = user;
    return true;
  }
}

// Uç fonksiyonunda oturumdaki kullanıcıyı verir: `me(@CurrentUser() user: UserRow)`.
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): UserRow => {
  const request = context.switchToHttp().getRequest<AuthedRequest>();
  if (!request.user) throw unauthenticated();
  return request.user;
});