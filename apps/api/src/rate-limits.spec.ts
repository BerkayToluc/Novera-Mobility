import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { RequestMethod } from '@nestjs/common';
import { AuthController } from './auth/auth.controller.js';
import { MeController } from './auth/me.controller.js';
import { PasswordResetController } from './auth/password-reset.controller.js';
import { CatalogController } from './catalog/catalog.controller.js';
import { NO_RATE_LIMIT_METADATA, RATE_LIMIT_METADATA, type RateLimitSpec } from './common/rate-limit.js';
import { LIMITS } from './common/rate-limits.js';
import { ContentController } from './content/content.controller.js';
import { FormsController } from './forms/forms.controller.js';
import { HealthController } from './health/health.controller.js';
import { HoldsController } from './holds/holds.controller.js';
import { ReservationsController } from './reservations/reservations.controller.js';

// ADR-27: every endpoint has a limit and every limit is a row of the table in docs/SECURITY.md. This fails
// when an endpoint with its own limit (or none) is missing from that table, or when a bucket is not in it.
const security = readFileSync(resolve(process.cwd(), '../../docs/SECURITY.md'), 'utf8');

const controllers = [
  AuthController,
  PasswordResetController,
  MeController,
  FormsController,
  HoldsController,
  CatalogController,
  ContentController,
  ReservationsController,
  HealthController,
];

interface Route {
  label: string;
  specs: RateLimitSpec[] | undefined;
  exempt: boolean;
}

function routesOf(controller: new (...args: never[]) => object): Route[] {
  const base = Reflect.getMetadata(PATH_METADATA, controller) as string;
  const classExempt = Reflect.getMetadata(NO_RATE_LIMIT_METADATA, controller) === true;
  return Object.getOwnPropertyNames(controller.prototype)
    .map((name) => controller.prototype[name as keyof typeof controller.prototype] as unknown as (...a: never[]) => unknown)
    .filter((handler) => typeof handler === 'function' && Reflect.getMetadata(METHOD_METADATA, handler) !== undefined)
    .map((handler) => {
      const method = RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as number]!;
      const path = [base, Reflect.getMetadata(PATH_METADATA, handler) as string]
        .filter((part) => part && part !== '/')
        .join('/')
        .replace(/:(\w+)/g, '{$1}');
      return {
        label: `${method} /${path}`,
        specs: Reflect.getMetadata(RATE_LIMIT_METADATA, handler) as RateLimitSpec[] | undefined,
        exempt: classExempt || Reflect.getMetadata(NO_RATE_LIMIT_METADATA, handler) === true,
      };
    });
}

const routes = controllers.flatMap((controller) => routesOf(controller as never));

describe('rate limits and docs/SECURITY.md', () => {
  it('finds the routes of the API', () => {
    expect(routes.length).toBeGreaterThan(25);
    expect(routes.map((route) => route.label)).toContain('POST /auth/login');
    expect(routes.map((route) => route.label)).toContain('DELETE /me/sessions/{id}');
  });

  it.each(routes.filter((route) => route.specs || route.exempt).map((route) => [route.label, route] as const))(
    '%s has its own row in the table',
    (label) => {
      expect(security).toContain(`\`${label}\``);
    },
  );

  it.each(Object.values(LIMITS).map((spec) => [spec.bucket, spec] as const))('the bucket %s is in the table with its limit', (bucket) => {
    const row = security.split('\n').find((line) => line.includes(`\`${bucket}\``));
    expect(row).toBeDefined();
  });

  it('every limit of an endpoint belongs to a known bucket', () => {
    const known = new Set(Object.values(LIMITS).map((spec) => spec.bucket));
    for (const route of routes) for (const spec of route.specs ?? []) expect(known.has(spec.bucket)).toBe(true);
  });

  it('the table says the default limit', () => {
    expect(security).toContain('300 istek/5 dk');
  });
});
