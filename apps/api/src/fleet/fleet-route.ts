import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

// Whether a request is for the fleet panel (`/fleet/*`, ADR-25). Two independent ways, as for the administration (admin-route.ts):
// the controller that will answer it is mounted under `fleet`, or the path starts with it. Express matches routes without regard to
// case, so the path test is too.
const FLEET_PATH = /^\/fleet(\/|$)/i;

export function isFleetRoute(context: ExecutionContext, request: Pick<Request, 'path'>): boolean {
  if (FLEET_PATH.test(request.path)) return true;
  const mount = Reflect.getMetadata('path', context.getClass()) as string | string[] | undefined;
  const paths = Array.isArray(mount) ? mount : [mount ?? ''];
  return paths.some((path) => FLEET_PATH.test(`/${path.replace(/^\/+/, '')}`));
}
