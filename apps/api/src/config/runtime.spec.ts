import { assertRuntimeEnv, docsEnabled, trustProxyHops } from './runtime.js';

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

describe('docsEnabled', () => {
  it('is on outside production and off in production unless asked for', () => {
    expect(docsEnabled(env({}))).toBe(true);
    expect(docsEnabled(env({ NODE_ENV: 'development' }))).toBe(true);
    expect(docsEnabled(env({ NODE_ENV: 'production' }))).toBe(false);
    expect(docsEnabled(env({ NODE_ENV: 'production', ENABLE_DOCS: '1' }))).toBe(true);
    expect(docsEnabled(env({ NODE_ENV: 'production', ENABLE_DOCS: 'yes' }))).toBe(false);
  });
});

describe('assertRuntimeEnv', () => {
  const production = { NODE_ENV: 'production', DATABASE_URL: 'postgresql://x', WEB_URL: 'https://novera.example' };

  it('lets development start with nothing set', () => {
    expect(() => assertRuntimeEnv(env({}))).not.toThrow();
  });

  it('lets a complete production setup start', () => {
    expect(() => assertRuntimeEnv(env(production))).not.toThrow();
  });

  it('names what is missing in production', () => {
    expect(() => assertRuntimeEnv(env({ NODE_ENV: 'production' }))).toThrow(/DATABASE_URL.*WEB_URL/);
    expect(() => assertRuntimeEnv(env({ ...production, WEB_URL: '' }))).toThrow('WEB_URL is not set');
    expect(() => assertRuntimeEnv(env({ ...production, DATABASE_URL: ' ' }))).toThrow('DATABASE_URL');
  });

  it('wants WEB_URL on https in production', () => {
    expect(() => assertRuntimeEnv(env({ ...production, WEB_URL: 'http://novera.example' }))).toThrow('https://');
  });

  it('rejects a bad TRUST_PROXY_HOPS in any environment', () => {
    expect(() => assertRuntimeEnv(env({ TRUST_PROXY_HOPS: 'x' }))).toThrow('TRUST_PROXY_HOPS');
  });
});
