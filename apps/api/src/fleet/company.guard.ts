import { createParamDecorator, Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { forbidden } from '../admin/admin.errors.js';
import { unauthenticated } from '../auth/auth.errors.js';
import { AuthService } from '../auth/auth.service.js';
import { userOfRequest, type AuthedRequest } from '../auth/session.guard.js';
import { isFleetRoute } from './fleet-route.js';

// In front of everything under `/fleet` (ADR-25), as a global guard: a controller added there later cannot forget it. No session is
// 401. A session that is not a corporate account of a company is 403: an individual account, an administrator's account and a corporate
// account that has no company all get the same answer. The account is read from the database at every request (the session lookup does
// that), so a closed account or one moved to another company is held to it at once.
@Injectable()
export class CompanyGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    if (!isFleetRoute(context, request)) return true;
    const user = await userOfRequest(this.auth, request);
    if (!user) throw unauthenticated();
    if (user.accountType !== 'CORPORATE' || user.role !== 'CUSTOMER' || !user.companyId) throw forbidden();
    return true;
  }
}

// The company of the signed-in account, for an endpoint under `/fleet`: `summary(@CurrentCompany() companyId: string)`. Every query of
// the fleet takes it and filters by it, so a record of another company is never found (it is a 404, like one that is not there).
export const CurrentCompany = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  const request = context.switchToHttp().getRequest<AuthedRequest>();
  const companyId = request.user?.companyId;
  if (!companyId) throw unauthenticated();
  return companyId;
});
