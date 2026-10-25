import { assertRuntimeEnv, docsEnabled, isProduction, trustProxyHops } from './runtime.js';

const env = (values: Record<string, string>): NodeJS.ProcessEnv => values as NodeJS.ProcessEnv;

describe('trustProxyHops', () => {
  it('defaults to one proxy (the web server) when empty or unset', () => {
    expect(trustProxyHops(env({}))).toBe(1);
    expect(trustProxyHops(env({ TRUST_PROXY_HOPS: '' }))).toBe(1);
    expect(trustProxyHops(env({ TRUST_PROXY_HOPS: '  ' }))).toBe(1);
  });

  it('accepts 0 to 5', () => {
    expect(trustProxyHops(env({ TRUST_PROXY_HOPS: '0' }))).toBe(0);
    expect(trustProxyHops(env({ TRUST_PROXY_HOPS: '2' }))).toBe(2);
    expect(trustProxyHops(env({ TRUST_PROXY_HOPS: '5' }))).toBe(5);
  });

  it.each(['6', '-1', '1.5', 'two', 'true', '1e1'])('rejects %s', (value) => {
    expect(() => trustProxyHops(env({ TRUST_PROXY_HOPS: value }))).toThrow('TRUST_PROXY_HOPS');
  });
});

// QUALITY G-07: only an explicit NODE_ENV=development (or test) is "not production"; anything else fails closed.
describe('isProduction', () => {
  it.each([[{}], [{ NODE_ENV: '' }], [{ NODE_ENV: 'production' }], [{ NODE_ENV: 'prod' }], [{ NODE_ENV: 'staging' }]])(
    'is true for %j',
    (values) => {
      expect(isProduction(env(values))).toBe(true);
    },
  );

  it.each([[{ NODE_ENV: 'development' }], [{ NODE_ENV: ' Development ' }], [{ NODE_ENV: 'test' }]])(
    'is false only when development or test is said outright: %j',
    (values) => {
      expect(isProduction(env(values))).toBe(false);
    },
  );

  it('a host variable (Render, Cloud Run) makes it production even if NODE_ENV says development', () => {
    expect(isProduction(env({ NODE_ENV: 'development', RENDER: 'true' }))).toBe(true);
    expect(isProduction(env({ NODE_ENV: 'development', K_SERVICE: 'novera-api' }))).toBe(true);
    expect(isProduction(env({ NODE_ENV: 'development', RENDER: ' ' }))).toBe(false);
  });
});

describe('docsEnabled', () => {
  it('is on in development and off in production unless asked for', () => {
    expect(docsEnabled(env({ NODE_ENV: 'development' }))).toBe(true);
    expect(docsEnabled(env({}))).toBe(false);
    expect(docsEnabled(env({ NODE_ENV: 'production' }))).toBe(false);
    expect(docsEnabled(env({ NODE_ENV: 'production', ENABLE_DOCS: '1' }))).toBe(true);
    expect(docsEnabled(env({ NODE_ENV: 'production', ENABLE_DOCS: 'yes' }))).toBe(false);
  });
});

describe('assertRuntimeEnv', () => {
  const KEY = 'k'.repeat(32);
  const production = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://x',
    WEB_URL: 'https://novera.example',
    API_ACCESS_KEY: KEY,
  };

  it('lets development start with nothing set', () => {
    expect(() => assertRuntimeEnv(env({ NODE_ENV: 'development' }))).not.toThrow();
  });

  it('does not treat a missing NODE_ENV as development', () => {
    expect(() => assertRuntimeEnv(env({}))).toThrow('cannot start in production');
  });

  it('lets a complete production setup start', () => {
    expect(() => assertRuntimeEnv(env(production))).not.toThrow();
  });

  it('names what is missing in production', () => {
    expect(() => assertRuntimeEnv(env({ NODE_ENV: 'production' }))).toThrow(/DATABASE_URL.*WEB_URL.*API_ACCESS_KEY/);
    expect(() => assertRuntimeEnv(env({ ...production, WEB_URL: '' }))).toThrow('WEB_URL is not set');
    expect(() => assertRuntimeEnv(env({ ...production, DATABASE_URL: ' ' }))).toThrow('DATABASE_URL');
  });

  it('refuses to start in production without a long enough API_ACCESS_KEY', () => {
    expect(() => assertRuntimeEnv(env({ ...production, API_ACCESS_KEY: '' }))).toThrow('API_ACCESS_KEY is not set');
    expect(() => assertRuntimeEnv(env({ ...production, API_ACCESS_KEY: ' '.repeat(40) }))).toThrow('API_ACCESS_KEY is not set');
    expect(() => assertRuntimeEnv(env({ ...production, API_ACCESS_KEY: 'k'.repeat(31) }))).toThrow('at least 32 characters');
    expect(() => assertRuntimeEnv(env({ ...production, API_ACCESS_KEY: 'k'.repeat(32) }))).not.toThrow();
  });

  it('never prints the key itself in the error', () => {
    const secret = 'short-secret-value';
    try {
      assertRuntimeEnv(env({ ...production, API_ACCESS_KEY: secret }));
      throw new Error('expected a throw');
    } catch (error) {
      expect((error as Error).message).not.toContain(secret);
    }
  });

  it('a host variable alone makes the checks apply', () => {
    expect(() => assertRuntimeEnv(env({ NODE_ENV: 'development', RENDER: 'true' }))).toThrow('DATABASE_URL');
  });

  it('wants WEB_URL on https in production', () => {
    expect(() => assertRuntimeEnv(env({ ...production, WEB_URL: 'http://novera.example' }))).toThrow('https://');
  });

  it('rejects a bad TRUST_PROXY_HOPS in any environment', () => {
    expect(() => assertRuntimeEnv(env({ NODE_ENV: 'development', TRUST_PROXY_HOPS: 'x' }))).toThrow('TRUST_PROXY_HOPS');
  });
});
