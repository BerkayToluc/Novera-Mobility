import 'reflect-metadata';
import { Global, Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { configureApp } from './app.setup.js';
import { AuthModule } from './auth/auth.module.js';
import { FakePrisma } from './auth/auth.testing.js';
import { DEFAULT_RATE_LIMIT } from './common/rate-limit.js';
import { RateLimitModule } from './common/rate-limit.module.js';
import { RateLimitStore } from './common/rate-limit.store.js';
import { MemoryRateLimitStore } from './common/rate-limit.testing.js';
import { LIMITS } from './common/rate-limits.js';
import { HealthModule } from './health/health.module.js';
import { PrismaService } from './prisma/prisma.service.js';

// The limits over real HTTP (ADR-27): the global guard, the key (address, account, e-mail), the 429 answer
// with Retry-After, and the exempt health check. The counters are in memory here; the SQL has its own test.
const fake = new FakePrisma();

@Global()
@Module({ providers: [{ provide: PrismaService, useValue: fake }], exports: [PrismaService] })
class FakePrismaModule {}

describe('rate limits over HTTP', () => {
  let app: INestApplication;
  let base = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [FakePrismaModule, AuthModule, HealthModule, RateLimitModule] })
      .overrideProvider(RateLimitStore)
      .useValue(new MemoryRateLimitStore())
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0);
    base = await app.getUrl();
  });
  afterAll(async () => app.close());
  beforeEach(() => {
    fake.users = [];
    fake.sessions = [];
  });

  let counter = 0;
  const freshAddress = () => `10.7.${Math.floor(counter / 250)}.${(counter += 1) % 250}`;

  const call = (method: string, path: string, options: { body?: unknown; address?: string; cookie?: string } = {}) =>
    fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': options.address ?? freshAddress(),
        ...(options.cookie ? { Cookie: options.cookie } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

  const registration = (n: number) => ({
    email: `kisi${n}-${counter}@example.com`,
    password: 'long-enough-1',
    firstName: 'Ece',
    lastName: 'Aydın',
    consent: true,
  });

  it('refuses the request after the limit with 429 RATE_LIMITED and a Retry-After in seconds', async () => {
    const address = freshAddress();
    for (let i = 0; i < LIMITS.register.limit; i += 1) {
      expect((await call('POST', '/auth/register', { body: registration(i), address })).status).toBe(201);
    }
    const refused = await call('POST', '/auth/register', { body: registration(99), address });
    expect(refused.status).toBe(429);
    expect(((await refused.json()) as { code: string }).code).toBe('RATE_LIMITED');
    const wait = Number(refused.headers.get('retry-after'));
    expect(Number.isInteger(wait)).toBe(true);
    expect(wait).toBeGreaterThanOrEqual(1);
    expect(wait).toBeLessThanOrEqual(LIMITS.register.windowSec);
    // Another address is not affected.
    expect((await call('POST', '/auth/register', { body: registration(100) })).status).toBe(201);
  });

  it('counts an invalid request too: the limit comes before validation', async () => {
    const address = freshAddress();
    for (let i = 0; i < LIMITS.register.limit; i += 1) {
      expect((await call('POST', '/auth/register', { body: {}, address })).status).toBe(422);
    }
    expect((await call('POST', '/auth/register', { body: {}, address })).status).toBe(429);
  });

  it('limits one account from many addresses: sign-in by e-mail', async () => {
    const email = `hedef-${counter}@example.com`;
    for (let i = 0; i < LIMITS.loginEmail.limit; i += 1) {
      expect((await call('POST', '/auth/login', { body: { email, password: 'yanlis-parola' } })).status).toBe(401);
    }
    const refused = await call('POST', '/auth/login', { body: { email: email.toUpperCase(), password: 'yanlis-parola' } });
    expect(refused.status).toBe(429);
    // Someone else's e-mail from a new address is still fine.
    expect((await call('POST', '/auth/login', { body: { email: `baska-${counter}@example.com`, password: 'x' } })).status).toBe(401);
  });

  it('limits password reset requests by address and by e-mail, answering alike for any account', async () => {
    const email = `unknown-${counter}@example.com`;
    for (let i = 0; i < LIMITS.forgotEmail.limit; i += 1) {
      expect((await call('POST', '/auth/forgot-password', { body: { email } })).status).toBe(202);
    }
    expect((await call('POST', '/auth/forgot-password', { body: { email } })).status).toBe(429);

    const address = freshAddress();
    for (let i = 0; i < LIMITS.forgot.limit; i += 1) {
      expect((await call('POST', '/auth/forgot-password', { body: { email: `x${i}-${counter}@example.com` }, address })).status).toBe(202);
    }
    expect((await call('POST', '/auth/forgot-password', { body: { email: `y-${counter}@example.com` }, address })).status).toBe(429);
  });

  it('keys a signed-in request by the account, not the address', async () => {
    const registered = await call('POST', '/auth/register', { body: registration(1) });
    const cookie = (registered.headers.get('set-cookie') ?? '').split(';')[0]!;
    // 20 account changes from 20 different addresses use up the account's limit.
    for (let i = 0; i < LIMITS.accountWrite.limit; i += 1) {
      expect((await call('PATCH', '/me', { body: { firstName: `Ad${i}` }, cookie })).status).toBe(200);
    }
    expect((await call('PATCH', '/me', { body: { firstName: 'Fazla' }, cookie })).status).toBe(429);
    // The same address without the session is a different key.
    expect((await call('GET', '/health')).status).toBe(200);
  });

  it('applies the default limit to an endpoint with no limit of its own', async () => {
    const registered = await call('POST', '/auth/register', { body: registration(2) });
    const cookie = (registered.headers.get('set-cookie') ?? '').split(';')[0]!;
    for (let i = 0; i < DEFAULT_RATE_LIMIT.limit; i += 1) {
      expect((await call('GET', '/me', { cookie })).status).toBe(200);
    }
    const refused = await call('GET', '/me', { cookie });
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get('retry-after'))).toBeLessThanOrEqual(DEFAULT_RATE_LIMIT.windowSec);
  });

  it('does not limit /health', async () => {
    const address = freshAddress();
    for (let i = 0; i < DEFAULT_RATE_LIMIT.limit + 20; i += 1) {
      const response = await call('GET', '/health', { address });
      expect(response.status).toBe(200);
    }
  });
});
