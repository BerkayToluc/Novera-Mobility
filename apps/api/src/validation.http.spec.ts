import 'reflect-metadata';
import { Global, Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { configureApp } from './app.setup.js';
import { AuthModule } from './auth/auth.module.js';
import { FakePrisma } from './auth/auth.testing.js';
import { GoogleTokenVerifier } from './auth/google-verifier.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { FormsModule } from './forms/forms.module.js';
import { HoldsModule } from './holds/holds.module.js';
import { PrismaService } from './prisma/prisma.service.js';
import { ReservationsModule } from './reservations/reservations.module.js';

// ADR-26 over real HTTP: a field of the wrong type (a number or an object where text is expected, a list
// where a flag is) is a 422 VALIDATION_FAILED on every endpoint that takes input, never a 500. The database
// is a stand-in that fails the test if it is touched: input is rejected before anything is read or written.
const fake = new FakePrisma();
const noDatabase = new Proxy(fake, {
  get(target, name, receiver) {
    if (name in target) return Reflect.get(target, name, receiver);
    return new Proxy({}, { get: () => () => Promise.reject(new Error(`database used for ${String(name)}`)) });
  },
});

@Global()
@Module({ providers: [{ provide: PrismaService, useValue: noDatabase }], exports: [PrismaService] })
class FakePrismaModule {}

describe('wrong-typed input is 422 on every endpoint (HTTP)', () => {
  let app: INestApplication;
  let base = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FakePrismaModule, AuthModule, FormsModule, HoldsModule, CatalogModule, ReservationsModule],
    })
      .overrideProvider(GoogleTokenVerifier)
      .useValue({ isConfigured: () => true, verify: async () => Promise.reject(new Error('not reached')) })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0);
    base = await app.getUrl();
  });
  afterAll(async () => app.close());

  let counter = 0;
  const address = () => `10.9.${Math.floor(counter / 250)}.${(counter += 1) % 250}`;

  async function send(method: string, path: string, body?: unknown, cookie?: string) {
    return fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': address(),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  // A signed-in person, for the endpoints behind the session guard.
  async function signedIn(): Promise<string> {
    const response = await send('POST', '/auth/register', {
      email: `person${(counter += 1)}@example.com`,
      password: 'long-enough-1',
      firstName: 'Ece',
      lastName: 'Aydın',
      consent: true,
    });
    expect(response.status).toBe(201);
    return (response.headers.get('set-cookie') ?? '').split(';')[0]!;
  }

  // Every field of the body set to the same wrong value, plus an empty object and an empty list (those two
  // only where something is required: PATCH /me with nothing to change is a valid, empty update).
  const wrong = [42, true, { nested: 1 }, ['a'], 'text'];
  const bodies = (fields: string[], required: boolean) => [
    ...(required ? [{}, []] : []),
    ...wrong.map((value) => Object.fromEntries(fields.map((field) => [field, value]))),
  ];

  const endpoints: Array<{ method: string; path: string; fields: string[]; auth?: boolean }> = [
    { method: 'POST', path: '/auth/register', fields: ['email', 'password', 'firstName', 'lastName', 'consent'] },
    { method: 'POST', path: '/auth/login', fields: ['email', 'password'] },
    { method: 'POST', path: '/auth/google', fields: ['credential', 'consent'] },
    { method: 'POST', path: '/auth/forgot-password', fields: ['email'] },
    { method: 'POST', path: '/auth/reset-password', fields: ['token', 'password'] },
    { method: 'PATCH', path: '/me', fields: ['firstName', 'lastName', 'locale', 'theme', 'currency', 'notifications'], auth: true },
    { method: 'POST', path: '/me/password', fields: ['currentPassword', 'newPassword'], auth: true },
    { method: 'POST', path: '/contact', fields: ['name', 'email', 'phone', 'subject', 'message', 'consent'] },
    {
      method: 'POST',
      path: '/quotes',
      fields: ['companyName', 'contactName', 'phone', 'email', 'vehicleCount', 'durationMonths', 'vehicleType', 'deliveryCities', 'notes', 'productSlug', 'consent'],
    },
    { method: 'POST', path: '/holds', fields: ['vehicleId', 'pickupBranchId', 'returnBranchId', 'startAt', 'endAt'] },
    {
      method: 'POST',
      path: '/reservations/price',
      fields: ['vehicleId', 'holdId', 'pickupBranchId', 'returnBranchId', 'startAt', 'endAt', 'currency', 'extras', 'usePoints', 'promoCode'],
    },
    {
      method: 'POST',
      path: '/reservations',
      fields: ['vehicleId', 'holdId', 'pickupBranchId', 'returnBranchId', 'startAt', 'endAt', 'currency', 'extras', 'usePoints', 'promoCode'],
      auth: true,
    },
  ];

  describe.each(endpoints)('$method $path', ({ method, path, fields, auth }) => {
    it.each(bodies(fields, path !== '/me').map((body, index) => [index, body] as const))('body #%i is 422, not 500', async (_index, body) => {
      const cookie = auth ? await signedIn() : undefined;
      const response = await send(method, path, body, cookie);
      expect(response.status).toBe(422);
      const answer = (await response.json()) as { code: string; fieldErrors?: Record<string, string> };
      expect(answer.code).toBe('VALIDATION_FAILED');
      expect(Object.keys(answer.fieldErrors ?? {}).length).toBeGreaterThan(0);
    });
  });

  it('keeps the field codes of the form endpoints', async () => {
    const response = await send('POST', '/contact', { name: 5, email: 'x', phone: 'abc', subject: '', message: 'm', consent: false });
    expect(((await response.json()) as { fieldErrors: unknown }).fieldErrors).toEqual({
      name: 'INVALID_FORMAT',
      email: 'INVALID_EMAIL',
      phone: 'INVALID_FORMAT',
      subject: 'REQUIRED',
      consent: 'CONSENT_REQUIRED',
    });
  });

  it('never reads an id or a role from a body: they are dropped', async () => {
    const cookie = await signedIn();
    const response = await send('PATCH', '/me', { firstName: 'Yeni', id: 'someone-else', role: 'ADMIN', userId: 'x' }, cookie);
    expect(response.status).toBe(200);
    const me = (await response.json()) as { firstName: string; id: string };
    expect(me.firstName).toBe('Yeni');
    expect(me.id).not.toBe('someone-else');
  });

  describe('query strings', () => {
    it.each([
      ['/vehicle-models?currency=TRY&currency=EUR', 'currency'],
      ['/vehicle-models?currency=GBP', 'currency'],
      ['/extras?currency=TRY&currency=EUR', 'currency'],
    ])('%s is 422 on %s', async (path, field) => {
      const response = await send('GET', path);
      expect(response.status).toBe(422);
      expect(((await response.json()) as { fieldErrors: Record<string, string> }).fieldErrors[field]).toBe('INVALID_FORMAT');
    });

    it('a repeated or empty search parameter is 422 too', async () => {
      const id = '3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b';
      const response = await send(
        'GET',
        `/vehicles?pickupBranchId=${id}&pickupBranchId=${id}&returnBranchId=&startAt=x&endAt=y&currency=zz`,
      );
      expect(response.status).toBe(422);
      expect(((await response.json()) as { fieldErrors: Record<string, string> }).fieldErrors).toEqual({
        pickupBranchId: 'INVALID_FORMAT',
        returnBranchId: 'REQUIRED',
        startAt: 'INVALID_FORMAT',
        endAt: 'INVALID_FORMAT',
        currency: 'INVALID_FORMAT',
      });
    });
  });
});
