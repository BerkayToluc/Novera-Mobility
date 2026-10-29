import type { INestApplication } from '@nestjs/common';
import type { Express, NextFunction, Request, Response } from 'express';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { apiAccess } from './common/api-access.js';
import { jsonOnly } from './common/json-only.js';
import { currentEnv, type Env } from './config/env.js';
import { trustProxyHops } from './config/runtime.js';

// Answers that belong to one person must not be kept by a browser cache or a shared cache.
const PRIVATE_PATHS = /^\/(me|auth|reservations|holds)(\/|$)/;

export function securityHeaders(request: Request, response: Response, next: NextFunction): void {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  if (PRIVATE_PATHS.test(request.path)) response.setHeader('Cache-Control', 'no-store');
  next();
}

// Everything that must be true of the running API, in one place: main.ts uses it for the real server and
// the HTTP tests use it too, so the tests exercise the same behaviour.
export function configureApp(app: INestApplication, env: Env = currentEnv()): void {
  const server = app.getHttpAdapter().getInstance() as Express;
  // Do not announce the framework.
  server.disable('x-powered-by');
  // Decides what `request.ip` is (see clientKeyOf): only the proxies we run are believed.
  server.set('trust proxy', trustProxyHops(env));
  app.use(securityHeaders);
  // Production: only the web server (which holds API_ACCESS_KEY) may call the API. See common/api-access.ts.
  app.use(apiAccess(env));
  // After the key check (a caller without the key learns nothing), before the body parsers.
  app.use(jsonOnly);
  app.useGlobalFilters(new AllExceptionsFilter());
}
