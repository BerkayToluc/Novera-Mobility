import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import type { NextFunction, Request, Response } from 'express';

// In production the API has a public address (the host gives it one), but only the web server may use it.
// The web server proves who it is with a shared secret, API_ACCESS_KEY, sent in a header on every call.
// A request without the right key is answered as if the route did not exist, and the visitor's real
// address, which the web server passes along in a second header, is believed only after the key has matched.
// That closes the hole of a visitor calling the API directly with a made-up X-Forwarded-For.
//
// Without API_ACCESS_KEY (development, tests) the API is open and nothing here does anything.
export const ACCESS_KEY_HEADER = 'x-novera-key';
export const CLIENT_IP_HEADER = 'x-novera-client-ip';
// The host's health check has no key. It answers a fixed `{ status: 'ok' }` and nothing else.
const OPEN_PATHS = new Set(['/health']);

const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

// Compares secrets without leaking, through timing, how many leading characters were right.
export function keyMatches(given: unknown, expected: string): boolean {
  return typeof given === 'string' && timingSafeEqual(digest(given), digest(expected));
}

export function apiAccess(env: NodeJS.ProcessEnv = process.env) {
  const expected = env.API_ACCESS_KEY?.trim();
  return (request: Request, response: Response, next: NextFunction): void => {
    if (!expected || OPEN_PATHS.has(request.path)) {
      next();
      return;
    }
    if (!keyMatches(request.headers[ACCESS_KEY_HEADER], expected)) {
      response.status(404).json({ code: 'NOT_FOUND', message: 'Not found' });
      return;
    }
    // The web server vouches for the visitor's address, so `request.ip` (and with it every rate limit) uses it.
    const visitor = request.headers[CLIENT_IP_HEADER];
    if (typeof visitor === 'string' && isIP(visitor.trim()) !== 0) {
      Object.defineProperty(request, 'ip', { value: visitor.trim(), configurable: true });
    }
    next();
  };
}
