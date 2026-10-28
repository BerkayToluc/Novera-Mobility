import { currentEnv, type Env } from './env.js';

// Settings that decide how the API behaves behind a proxy and in production. They are read from the
// environment in one place, so a wrong value stops the server at start-up instead of failing later.

// The web server (Next.js) always sits in front of the API (ADR-14), so by default one proxy is trusted.
export const DEFAULT_TRUST_PROXY_HOPS = 1;
const MAX_TRUST_PROXY_HOPS = 5;

// How many proxies in front of the API add their own entry to `X-Forwarded-For`, counted from the API.
// Only those entries are believed; entries further left were written by the visitor and are ignored.
// 0 means the API is reached directly and the header is never trusted. Empty means the default (1).
export function trustProxyHops(env: Env = currentEnv()): number {
  const raw = env.TRUST_PROXY_HOPS?.trim();
  if (!raw) return DEFAULT_TRUST_PROXY_HOPS;
  const hops = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isInteger(hops) || hops > MAX_TRUST_PROXY_HOPS) {
    throw new Error(`TRUST_PROXY_HOPS must be a whole number from 0 to ${MAX_TRUST_PROXY_HOPS}`);
  }
  return hops;
}

// Variables a host sets on its own: Render sets RENDER, Google Cloud Run sets K_SERVICE. Seeing one means the API
// runs on a real server whatever NODE_ENV says.
const HOST_VARIABLES = ['RENDER', 'K_SERVICE'] as const;

// The API treats itself as production unless it was told outright that it is not: only NODE_ENV=development
// (or test, which Jest sets) switches the safety settings off. A missing or misspelled NODE_ENV therefore
// fails closed (Secure cookies, no reset links in the log, no /docs) instead of open (QUALITY G-07).
export function isProduction(env: Env = currentEnv()): boolean {
  if (HOST_VARIABLES.some((name) => Boolean(env[name]?.trim()))) return true;
  const mode = env.NODE_ENV?.trim().toLowerCase();
  return mode !== 'development' && mode !== 'test';
}

// The shared secret between the web server and the API must be long enough to resist guessing.
export const MIN_API_ACCESS_KEY_LENGTH = 32;

// The Swagger page (/docs) lists every endpoint; in production it is off unless ENABLE_DOCS=1.
export function docsEnabled(env: Env = currentEnv()): boolean {
  return !isProduction(env) || env.ENABLE_DOCS === '1';
}

// Refuses to start in production with a setting that would only fail later or fail unsafely.
export function assertRuntimeEnv(env: Env = currentEnv()): void {
  trustProxyHops(env);
  if (!isProduction(env)) return;

  const problems: string[] = [];
  if (!env.DATABASE_URL?.trim()) problems.push('DATABASE_URL is not set');
  const webUrl = env.WEB_URL?.trim();
  if (!webUrl) problems.push('WEB_URL is not set (password reset links are built from it)');
  else if (!/^https:\/\//i.test(webUrl)) problems.push('WEB_URL must start with https://');
  // Without the key every request would be let through (apiAccess does nothing when it is empty). Only the
  // problem is named, never the value.
  const accessKey = env.API_ACCESS_KEY?.trim();
  if (!accessKey) problems.push('API_ACCESS_KEY is not set');
  else if (accessKey.length < MIN_API_ACCESS_KEY_LENGTH) {
    problems.push(`API_ACCESS_KEY must be at least ${MIN_API_ACCESS_KEY_LENGTH} characters`);
  }
  if (problems.length > 0) {
    throw new Error(`The API cannot start in production: ${problems.join('; ')}`);
  }
}
