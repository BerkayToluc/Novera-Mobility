import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { isAdmin } from '../auth/admin-rules.js';
import { unauthenticated } from '../auth/auth.errors.js';
import { AuthService } from '../auth/auth.service.js';
import { userOfRequest, type AuthedRequest } from '../auth/session.guard.js';
import { isAdminRoute } from './admin-route.js';
import { forbidden } from './admin.errors.js';

// In front of everything under `/admin` (ADR-24), as a global guard: a controller added there later cannot forget it.
// No session is 401, a session without the role is 403. The role is read from the database at every request (the
// session lookup does that), so taking the role away works at once, not when the session runs out.
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    if (!isAdminRoute(context, request)) return true;
    const user = await userOfRequest(this.auth, request);
    if (!user) throw unauthenticated();
    if (!isAdmin(user)) throw forbidden();
    return true;
  }
}
