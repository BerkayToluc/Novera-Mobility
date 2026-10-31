import type { Request } from 'express';
import { clientKeyOf } from './client-key.js';
import type { RateLimitSpec } from './rate-limit.js';

// Every limit that is tighter than the default, in one place (ADR-27). Each bucket is a row of the table in
// docs/SECURITY.md, and a test (rate-limits.spec.ts) fails when one is missing there.
const MINUTE = 60;
const HOUR = 60 * MINUTE;

// The e-mail address in the body as a counter key, so one account cannot be asked about from many addresses.
// Skipped (null) when the body has none; an invalid body is refused by validation, and still counted by address.
const emailKey = (request: Request): string | null => {
  const email = (request.body as { email?: unknown } | undefined)?.email;
  return typeof email === 'string' && email.trim() !== '' ? `email:${email.trim().toLowerCase().slice(0, 254)}` : null;
};

// A campaign code in the body is how codes are guessed (QUALITY G-04): those requests also count here.
const promoKey = (request: Request, user: { id: string } | null): string | null => {
  const code = (request.body as { promoCode?: unknown } | undefined)?.promoCode;
  if (typeof code !== 'string' || code.trim() === '') return null;
  return user ? `user:${user.id}` : `ip:${clientKeyOf(request)}`;
};

// Everything under /admin (ADR-24): one counter for the administrator, 120 a minute. Before sign-in it counts by address,
// so probing the door is limited too.
const adminKey = (request: Request, user: { id: string } | null): string =>
  user ? `admin:${user.id}` : `ip:${clientKeyOf(request)}`;

// Everything under /fleet (ADR-25): one counter for the signed-in account, 120 a minute. Before sign-in it counts by address.
const fleetKey = (request: Request, user: { id: string } | null): string => (user ? `fleet:${user.id}` : `ip:${clientKeyOf(request)}`);

// Making a service request (V2-41): at most 20 an hour for a company, whoever of its accounts makes them (ADR-25). It stacks with `fleet`.
const companyKey = (_request: Request, user: { id: string; companyId?: string | null } | null): string | null => (user?.companyId ? `company:${user.companyId}` : null);

export const LIMITS = {
  register: { bucket: 'register', limit: 10, windowSec: HOUR, key: 'client' },
  login: { bucket: 'login', limit: 10, windowSec: 15 * MINUTE, key: 'client' },
  google: { bucket: 'google', limit: 10, windowSec: 15 * MINUTE, key: 'client' },
  forgot: { bucket: 'forgot', limit: 5, windowSec: HOUR, key: 'client' },
  forgotEmail: { bucket: 'forgot-email', limit: 3, windowSec: HOUR, key: emailKey },
  reset: { bucket: 'reset', limit: 10, windowSec: 15 * MINUTE, key: 'client' },
  changePassword: { bucket: 'change-password', limit: 5, windowSec: 15 * MINUTE },
  contact: { bucket: 'contact', limit: 10, windowSec: HOUR, key: 'client' },
  quotes: { bucket: 'quotes', limit: 10, windowSec: HOUR, key: 'client' },
  holds: { bucket: 'holds', limit: 30, windowSec: HOUR },
  price: { bucket: 'price', limit: 60, windowSec: 10 * MINUTE },
  promo: { bucket: 'promo', limit: 10, windowSec: 10 * MINUTE, key: promoKey },
  reserve: { bucket: 'reserve', limit: 10, windowSec: HOUR },
  accountWrite: { bucket: 'account-write', limit: 20, windowSec: 15 * MINUTE },
  admin: { bucket: 'admin', limit: 120, windowSec: MINUTE, key: adminKey },
  fleet: { bucket: 'fleet', limit: 120, windowSec: MINUTE, key: fleetKey },
  // The hourly reminder trigger (V2-44): Cloud Scheduler calls it once an hour; a few more is room for a retry and a manual run.
  jobs: { bucket: 'jobs', limit: 10, windowSec: HOUR, key: 'client' },
  fleetRequests: { bucket: 'fleet-requests', limit: 20, windowSec: HOUR, key: companyKey },
} satisfies Record<string, RateLimitSpec>;
