import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

// Whether a request is for the administration (`/admin/*`, ADR-24). Two independent ways, and either one is enough:
// the controller that will answer it is mounted under `admin`, or the path starts with it. Express matches routes
// without regard to case, so the path test is too (`/ADMIN/ping` is the same route); a rule that only looked at the
// path could be walked around by a capital letter, one that only looked at the controller could miss a handler that
// was mounted somewhere unexpected.
const ADMIN_PATH = /^\/admin(\/|$)/i;

export function isAdminRoute(context: ExecutionContext, request: Pick<Request, 'path'>): boolean {
  if (ADMIN_PATH.test(request.path)) return true;
  const mount = Reflect.getMetadata('path', context.getClass()) as string | string[] | undefined;
  const paths = Array.isArray(mount) ? mount : [mount ?? ''];
  return paths.some((path) => ADMIN_PATH.test(`/${path.replace(/^\/+/, '')}`));
}
