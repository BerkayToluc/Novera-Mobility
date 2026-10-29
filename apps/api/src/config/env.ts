// The only file that reads `process.env` (V2-13, QUALITY M-02). Everything else asks for a named, typed value here, so
// a variable has one name, one way of being trimmed and one default. Each call reads the environment again (it is
// cheap and tests change variables between runs); `source` lets a test hand in its own set.
export type Env = NodeJS.ProcessEnv;

export const currentEnv = (): Env => process.env;

const text = (value: string | undefined): string | undefined => value?.trim() || undefined;

export const DEFAULT_PORT = 3000;
export const DEFAULT_WEB_URL = 'http://localhost:3000';

// Jest sets NODE_ENV=test; background tasks (rates, cleanups) never start in a test run.
export function isTestRun(source: Env = currentEnv()): boolean {
  return source.NODE_ENV === 'test';
}

// Tests lower the password cost unless NOVERA_REAL_SCRYPT=1 asks for the real one (auth/password.ts).
export function useRealScrypt(source: Env = currentEnv()): boolean {
  return source.NOVERA_REAL_SCRYPT === '1';
}

export function databaseUrl(source: Env = currentEnv()): string | undefined {
  return source.DATABASE_URL || undefined;
}

// Where the web app lives: password reset links point there. Without it, the local address.
export function webBaseUrl(source: Env = currentEnv()): string {
  return (source.WEB_URL ?? DEFAULT_WEB_URL).replace(/\/+$/, '');
}

export function resendApiKey(source: Env = currentEnv()): string | undefined {
  return text(source.RESEND_API_KEY);
}

export function mailFrom(source: Env = currentEnv()): string | undefined {
  return text(source.MAIL_FROM);
}

export function googleClientId(source: Env = currentEnv()): string | undefined {
  return text(source.GOOGLE_CLIENT_ID);
}

// An empty value means the default rate service (catalog/rates-updater.service.ts).
export function ratesApiUrl(source: Env = currentEnv()): string | undefined {
  return source.RATES_API_URL || undefined;
}

export function listenPort(source: Env = currentEnv()): number | string {
  return source.PORT ?? DEFAULT_PORT;
}

// Optional: 127.0.0.1 (or a private address) so only the web server can reach the API.
export function listenHost(source: Env = currentEnv()): string | undefined {
  return text(source.HOST);
}

// The host of the public photo store (Vercel Blob, ADR-28), as given in the store's address: `<id>.public.blob.vercel-storage.com`.
// Set in production, an image address has to be on exactly this host; left empty (local work, tests) any host of the store
// family is accepted (common/image-url.ts).
export function blobPublicHost(source: Env = currentEnv()): string | undefined {
  return text(source.BLOB_PUBLIC_HOST)?.toLowerCase();
}
