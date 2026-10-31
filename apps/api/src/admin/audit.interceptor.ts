import {
  Inject,
  Injectable,
  SetMetadata,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { mergeMap, type Observable } from 'rxjs';
import type { AuthedRequest } from '../auth/session.guard.js';
import { isFleetRoute } from '../fleet/fleet-route.js';
import { isAdminRoute } from './admin-route.js';
import { AuditService, fieldNamesOf } from './audit.service.js';

// What a changing endpoint calls its action in the audit log. Without it the log still gets a row, named after the
// method and the route (`POST /admin/ping`), so a changing endpoint that forgot the decorator is not unlogged.
export interface AuditedOptions {
  action: string;
  entity: string;
  // The id of what was changed, from the request (`:id`) or the answer; null when there is none.
  entityId?: (request: Request, result: unknown) => string | null;
  // The company the change was for, on an administration route (a company's contract, a company's car). A fleet route has the company
  // of the signed-in account on its line without this.
  companyId?: (request: Request, result: unknown) => string | null;
}
const AUDITED_METADATA = 'novera:audited';
export const Audited = (options: AuditedOptions) => SetMetadata(AUDITED_METADATA, options);

const READ_ONLY = new Set(['GET', 'HEAD', 'OPTIONS']);

// Writes the audit record of every request to `/admin/*` that changes something and succeeded (ADR-24). The record
// is written after the handler, and if writing it fails the request fails with 500: the change is made but the caller
// is told something went wrong, which is better than a change nobody can find in the log.
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    // The fleet panel (V2-35) is written to the same log: the actor is the customer's account, and the line carries its company.
    const fleet = isFleetRoute(context, request);
    if (READ_ONLY.has(request.method) || !(isAdminRoute(context, request) || fleet) || !request.user) return next.handle();

    const options = this.reflector.getAllAndOverride<AuditedOptions | undefined>(AUDITED_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    const actorId = request.user.id;
    return next.handle().pipe(
      mergeMap(async (result: unknown) => {
        const route = (request.route as { path?: string } | undefined)?.path ?? request.path;
        const param = request.params['id'];
        await this.audit.record({
          actorId,
          companyId: fleet ? (request.user?.companyId ?? null) : (options?.companyId ? options.companyId(request, result) : null),
          action: options?.action ?? `${request.method} ${route}`,
          entity: options?.entity ?? route.split('/').filter(Boolean)[1] ?? 'admin',
          entityId: options?.entityId ? options.entityId(request, result) : (typeof param === 'string' ? param : null),
          fields: fieldNamesOf(request.body),
        });
        return result;
      }),
    );
  }
}
