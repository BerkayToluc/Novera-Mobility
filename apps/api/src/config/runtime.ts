// Settings that decide how the API behaves behind a proxy and in production. They are read from the
// environment in one place, so a wrong value stops the server at start-up instead of failing later.

// The web server (Next.js) always sits in front of the API (ADR-14), so by default one proxy is trusted.
export const DEFAULT_TRUST_PROXY_HOPS = 1;
const MAX_TRUST_PROXY_HOPS = 5;

// How many proxies in front of the API add their own entry to `X-Forwarded-For`, counted from the API.
// Only those entries are believed; entries further left were written by the visitor and are ignored.
// 0 means the API is reached directly and the header is never trusted. Empty means the default (1).
export function trustProxyHops(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.TRUST_PROXY_HOPS?.trim();
  if (!raw) return DEFAULT_TRUST_PROXY_HOPS;
  const hops = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isInteger(hops) || hops > MAX_TRUST_PROXY_HOPS) {
    throw new Error(`TRUST_PROXY_HOPS must be a whole number from 0 to ${MAX_TRUST_PROXY_HOPS}`);
  }
  return hops;
}

// The Swagger page (/docs) lists every endpoint; in production it is off unless ENABLE_DOCS=1.
export function docsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== 'production' || env.ENABLE_DOCS === '1';
}

// Refuses to start in production with a setting that would only fail later or fail unsafely.
export function assertRuntimeEnv(env: NodeJS.ProcessEnv = process.env): void {
  trustProxyHops(env);
  if (env.NODE_ENV !== 'production') return;

  const problems: string[] = [];
  if (!env.DATABASE_URL?.trim()) problems.push('DATABASE_URL is not set');
  const webUrl = env.WEB_URL?.trim();
  if (!webUrl) problems.push('WEB_URL is not set (password reset links are built from it)');
  else if (!/^https:\/\//i.test(webUrl)) problems.push('WEB_URL must start with https://');
  if (problems.length > 0) {
    throw new Error(`The API cannot start in production: ${problems.join('; ')}`);
  }
}
