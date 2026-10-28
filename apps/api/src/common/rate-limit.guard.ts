import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service.js';
import { userOfRequest, type AuthedRequest } from '../auth/session.guard.js';
import { clientKeyOf } from './client-key.js';
import { DEFAULT_RATE_LIMIT, NO_RATE_LIMIT_METADATA, RATE_LIMIT_METADATA, type RateLimitSpec } from './rate-limit.js';
import { RateLimitService } from './rate-limit.service.js';

// The limit of every endpoint (ADR-27), applied as a global guard. It runs before the handler, before the
// session guard and before the body is validated, so a request that is refused costs one counter write and
// nothing else, and an invalid one still counts.
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(RateLimitService) private readonly limits: RateLimitService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean | undefined>(NO_RATE_LIMIT_METADATA, targets)) return true;
    const own = this.reflector.getAllAndOverride<RateLimitSpec[] | undefined>(RATE_LIMIT_METADATA, targets);
    const specs = own && own.length > 0 ? own : [DEFAULT_RATE_LIMIT];

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    // Who is asking: read once here and kept on the request, so the session guard does not look it up again.
    const user = await userOfRequest(this.auth, request);

    const now = new Date();
    for (const spec of specs) {
      const key = this.keyFor(spec, request, user);
      if (key !== null) await this.limits.consume(spec, key, now);
    }
    return true;
  }

  private keyFor(spec: RateLimitSpec, request: Request, user: AuthedRequest['user'] | null): string | null {
    if (typeof spec.key === 'function') return spec.key(request, user ?? null);
    if (spec.key === 'client' || !user) return `ip:${clientKeyOf(request)}`;
    return `user:${user.id}`;
  }
}
