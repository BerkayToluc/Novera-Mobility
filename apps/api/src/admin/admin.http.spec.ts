import 'reflect-metadata';
import { Global, Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { configureApp } from '../app.setup.js';
import { AuthModule } from '../auth/auth.module.js';
import { FakePrisma } from '../auth/auth.testing.js';
import { RateLimitModule } from '../common/rate-limit.module.js';
import { RateLimitStore } from '../common/rate-limit.store.js';
import { MemoryRateLimitStore } from '../common/rate-limit.testing.js';
import { LIMITS } from '../common/rate-limits.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AdminModule } from './admin.module.js';
import { AdminSummaryService } from './admin-summary.service.js';

// "No session 401, customer 403, administrator 200" (ADMIN.md §6, V2-23), the audit log, and the order of the guards.
const fake = new FakePrisma();
// The counts themselves are tested against the database (admin-summary.integration.spec.ts); here only the door is.
const SUMMARY = {
  date: '2026-10-29',
  rentalsStartingToday: 2,
  rentalsEndingToday: 1,
  reservationsLast7Days: 9,
  quotesAwaiting: 3,
  unhandledMessages: 4,
  serviceRequests: null,
};

@Global()
@Module({ providers: [{ provide: PrismaService, useValue: fake }], exports: [PrismaService] })
class FakePrismaModule {}

describe('administration over HTTP', () => {
  let app: INestApplication;
  let base = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [FakePrismaModule, AuthModule, RateLimitModule, AdminModule] })
      .overrideProvider(AdminSummaryService)
      .useValue({ get: async () => SUMMARY })
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
    fake.throttles = [];
    fake.auditLogs = [];
  });

  let counter = 0;
  const freshAddress = () => `10.9.${Math.floor(counter / 250)}.${(counter += 1) % 250}`;

  const call = (method: string, path: string, options: { body?: unknown; cookie?: string; address?: string; type?: string } = {}) =>
    fetch(base + path, {
      method,
      headers: {
        'Content-Type': options.type ?? 'application/json',
        'X-Forwarded-For': options.address ?? freshAddress(),
        ...(options.cookie ? { Cookie: options.cookie } : {}),
      },
      body: options.body === undefined ? undefined : typeof options.body === 'string' ? options.body : JSON.stringify(options.body),
    });

  // A signed-in person: registers, then (for an administrator) is given the role the way `admin:create` does.
  async function signedIn(role: 'CUSTOMER' | 'ADMIN') {
    const address = freshAddress();
    const response = await call('POST', '/auth/register', {
      address,
      body: { email: `kisi${counter}@example.com`, password: 'long-enough-1', firstName: 'Ece', lastName: 'Aydın', consent: true },
    });
    const cookie = (response.headers.get('set-cookie') ?? '').split(';')[0]!;
    const user = fake.users.at(-1)!;
    user.role = role;
    return { cookie, address, id: user.id as string };
  }

  describe('the door', () => {
    it('no session is 401 UNAUTHENTICATED', async () => {
      for (const method of ['GET', 'POST']) {
        const response = await call(method, '/admin/ping', method === 'POST' ? { body: {} } : {});
        expect(response.status).toBe(401);
        expect((await response.json()).code).toBe('UNAUTHENTICATED');
      }
    });

    it('a customer is 403 FORBIDDEN, however the path is written', async () => {
      const { cookie } = await signedIn('CUSTOMER');
      for (const path of ['/admin/ping', '/ADMIN/ping', '/Admin/Ping']) {
        const response = await call('GET', path, { cookie });
        expect(response.status).toBe(403);
        expect((await response.json()).code).toBe('FORBIDDEN');
      }
      const post = await call('POST', '/admin/ping', { cookie, body: {} });
      expect(post.status).toBe(403);
    });

    it('an administrator is 200', async () => {
      const { cookie } = await signedIn('ADMIN');
      const response = await call('GET', '/admin/ping', { cookie });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true, role: 'ADMIN' });
    });

    it('taking the role away works at once, with the session still open', async () => {
      const { cookie, id } = await signedIn('ADMIN');
      expect((await call('GET', '/admin/ping', { cookie })).status).toBe(200);
      fake.users.find((user) => user.id === id)!.role = 'CUSTOMER';
      expect((await call('GET', '/admin/ping', { cookie })).status).toBe(403);
    });

    it('the rest of the API is not behind the administrator guard', async () => {
      const { cookie } = await signedIn('CUSTOMER');
      expect((await call('GET', '/me', { cookie })).status).toBe(200);
    });
  });

  describe('GET /admin/summary (V2-25)', () => {
    it('no session is 401, a customer is 403, an administrator gets the numbers', async () => {
      const anonymous = await call('GET', '/admin/summary');
      expect(anonymous.status).toBe(401);
      expect((await anonymous.json()).code).toBe('UNAUTHENTICATED');

      const customer = await signedIn('CUSTOMER');
      const refused = await call('GET', '/admin/summary', { cookie: customer.cookie });
      expect(refused.status).toBe(403);
      const refusal = await refused.json();
      expect(refusal.code).toBe('FORBIDDEN');
      expect(JSON.stringify(refusal)).not.toContain('quotesAwaiting');

      const admin = await signedIn('ADMIN');
      const response = await call('GET', '/admin/summary', { cookie: admin.cookie });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(SUMMARY);
    });

    it('a read is not written to the audit log, which records changes', async () => {
      const admin = await signedIn('ADMIN');
      await call('GET', '/admin/summary', { cookie: admin.cookie });
      expect(fake.auditLogs).toHaveLength(0);
    });
  });

  // The door and the input of the campaign code endpoints (V2-26). What the codes do against a database is in
  // promo-codes.integration.spec.ts; an invalid request is turned away before any database call, so the fake does here.
  describe('campaign codes: the door and the input (V2-26)', () => {
    const routes: [string, string][] = [
      ['GET', '/admin/promo-codes'],
      ['POST', '/admin/promo-codes'],
      ['GET', '/admin/promo-codes/YAZ25'],
      ['PATCH', '/admin/promo-codes/YAZ25'],
      ['DELETE', '/admin/promo-codes/YAZ25'],
    ];

    it('no session is 401 UNAUTHENTICATED on every route', async () => {
      for (const [method, path] of routes) {
        const response = await call(method, path, ['POST', 'PATCH'].includes(method) ? { body: {} } : {});
        expect(response.status).toBe(401);
        expect((await response.json()).code).toBe('UNAUTHENTICATED');
      }
    });

    it('a customer is 403 FORBIDDEN on every route', async () => {
      const { cookie } = await signedIn('CUSTOMER');
      for (const [method, path] of routes) {
        const response = await call(method, path, { cookie, ...(['POST', 'PATCH'].includes(method) ? { body: {} } : {}) });
        expect(response.status).toBe(403);
        expect((await response.json()).code).toBe('FORBIDDEN');
      }
    });

    it('a new code with wrong fields is 422 with a code for each field', async () => {
      const { cookie } = await signedIn('ADMIN');
      const response = await call('POST', '/admin/promo-codes', {
        cookie,
        body: { code: 'a!', percent: 95, validFrom: 'not a date', maxRedemptions: 0, oncePerUser: 'yes' },
      });
      expect(response.status).toBe(422);
      expect((await response.json()).fieldErrors).toEqual({
        code: 'INVALID_FORMAT',
        percent: 'OUT_OF_RANGE',
        validFrom: 'INVALID_FORMAT',
        maxRedemptions: 'OUT_OF_RANGE',
        oncePerUser: 'INVALID_FORMAT',
      });
    });

    it('a new code with nothing in it asks for the code and the percent', async () => {
      const { cookie } = await signedIn('ADMIN');
      const response = await call('POST', '/admin/promo-codes', { cookie, body: {} });
      expect(response.status).toBe(422);
      expect((await response.json()).fieldErrors).toEqual({ code: 'REQUIRED', percent: 'REQUIRED' });
    });

    it('a change has to say which version of the record it was made against', async () => {
      const { cookie } = await signedIn('ADMIN');
      const response = await call('PATCH', '/admin/promo-codes/YAZ25', { cookie, body: { percent: 10 } });
      expect(response.status).toBe(422);
      expect((await response.json()).fieldErrors).toEqual({ updatedAt: 'REQUIRED' });
    });

    it('a change with a percent that is too high or a flag that is not a flag is 422', async () => {
      const { cookie } = await signedIn('ADMIN');
      const response = await call('PATCH', '/admin/promo-codes/YAZ25', {
        cookie,
        body: { updatedAt: '2026-10-29T10:00:00.000Z', percent: 91, active: 'no' },
      });
      expect(response.status).toBe(422);
      expect((await response.json()).fieldErrors).toEqual({ percent: 'OUT_OF_RANGE', active: 'INVALID_FORMAT' });
    });

    it('a list asked for in a way that makes no sense is 422, not quietly something else', async () => {
      const { cookie } = await signedIn('ADMIN');
      for (const [query, field, code] of [
        ['pageSize=500', 'pageSize', 'OUT_OF_RANGE'],
        ['page=0', 'page', 'OUT_OF_RANGE'],
        ['page=abc', 'page', 'INVALID_FORMAT'],
        ['sort=passwordHash:asc', 'sort', 'INVALID_FORMAT'],
        ['sort=code:sideways', 'sort', 'INVALID_FORMAT'],
        ['status=DELETED', 'status', 'INVALID_FORMAT'],
      ] as const) {
        const response = await call('GET', `/admin/promo-codes?${query}`, { cookie });
        expect(response.status).toBe(422);
        expect((await response.json()).fieldErrors).toEqual({ [field]: code });
      }
    });

    it('a body that is not JSON is 415 before anything is read', async () => {
      const { cookie } = await signedIn('ADMIN');
      const response = await call('POST', '/admin/promo-codes', { cookie, body: 'code=YAZ25', type: 'text/plain' });
      expect(response.status).toBe(415);
    });
  });

  // The door and the input of the branch endpoints (V2-27). What they do against a database is in
  // branches/branches.integration.spec.ts; a request that is turned away is turned away before any database call.
  describe('branches: the door and the input (V2-27)', () => {
    const ID = '6f1c1b5e-2f3a-4c55-9d0e-0a1b2c3d4e5f';
    const routes: [string, string][] = [
      ['GET', '/admin/branches'],
      ['POST', '/admin/branches'],
      ['GET', `/admin/branches/${ID}`],
      ['PATCH', `/admin/branches/${ID}`],
      ['POST', `/admin/branches/${ID}/close`],
      ['POST', `/admin/branches/${ID}/reopen`],
    ];
    const withBody = (method: string) => (['POST', 'PATCH'].includes(method) ? { body: {} } : {});

    it('no session is 401 UNAUTHENTICATED on every route', async () => {
      for (const [method, path] of routes) {
        const response = await call(method, path, withBody(method));
        expect(response.status).toBe(401);
        expect((await response.json()).code).toBe('UNAUTHENTICATED');
      }
    });

    it('a customer is 403 FORBIDDEN on every route', async () => {
      const { cookie } = await signedIn('CUSTOMER');
      for (const [method, path] of routes) {
        const response = await call(method, path, { cookie, ...withBody(method) });
        expect(response.status).toBe(403);
        expect((await response.json()).code).toBe('FORBIDDEN');
      }
    });

    it('a new branch with nothing in it asks for every field', async () => {
      const { cookie } = await signedIn('ADMIN');
      const response = await call('POST', '/admin/branches', { cookie, body: {} });
      expect(response.status).toBe(422);
      expect(Object.keys((await response.json()).fieldErrors).sort()).toEqual(
        ['address', 'city', 'email', 'kind', 'latitude', 'longitude', 'name', 'openingHours', 'phone'],
      );
    });

    it('wrong values are 422 with a code for each field', async () => {
      const { cookie } = await signedIn('ADMIN');
      const response = await call('POST', '/admin/branches', {
        cookie,
        body: {
          name: 'x'.repeat(81),
          city: 'Atlantis',
          address: 'Adres',
          latitude: '39.9',
          longitude: 120,
          phone: 'abc',
          email: 'nope',
          kind: 'HARBOUR',
          openingHours: { weekdays: '08:30-19:00', saturday: '9-5', sunday: 'closed' },
        },
      });
      expect(response.status).toBe(422);
      expect((await response.json()).fieldErrors).toEqual({
        name: 'TOO_LONG',
        city: 'INVALID_FORMAT',
        latitude: 'INVALID_FORMAT',
        longitude: 'OUT_OF_RANGE',
        phone: 'INVALID_FORMAT',
        email: 'INVALID_EMAIL',
        kind: 'INVALID_FORMAT',
        openingHours: 'INVALID_FORMAT',
      });
    });

    it('a change has to say which version it was made against', async () => {
      const { cookie } = await signedIn('ADMIN');
      const response = await call('PATCH', `/admin/branches/${ID}`, { cookie, body: { phone: '+90 312 555 00 00' } });
      expect(response.status).toBe(422);
      expect((await response.json()).fieldErrors).toEqual({ updatedAt: 'REQUIRED' });
    });

    it('a list asked for in a way that makes no sense is 422', async () => {
      const { cookie } = await signedIn('ADMIN');
      for (const [query, field] of [
        ['pageSize=101', 'pageSize'],
        ['sort=password:asc', 'sort'],
        ['status=GONE', 'status'],
        ['city=Atlantis', 'city'],
      ] as const) {
        const response = await call('GET', `/admin/branches?${query}`, { cookie });
        expect(response.status).toBe(422);
        expect(Object.keys((await response.json()).fieldErrors)).toEqual([field]);
      }
    });

    it('an id that is not an id is 404 without asking the database', async () => {
      const { cookie } = await signedIn('ADMIN');
      for (const [method, path] of [
        ['GET', '/admin/branches/not-an-id'],
        ['POST', '/admin/branches/not-an-id/close'],
        ['POST', '/admin/branches/not-an-id/reopen'],
      ] as const) {
        const response = await call(method, path, { cookie, ...withBody(method) });
        expect(response.status).toBe(404);
        expect((await response.json()).code).toBe('NOT_FOUND');
      }
    });

    it('a body that is not JSON is 415', async () => {
      const { cookie } = await signedIn('ADMIN');
      const response = await call('POST', '/admin/branches', { cookie, body: 'name=x', type: 'text/plain' });
      expect(response.status).toBe(415);
    });
  });

  // The door and the input of the vehicle model endpoints (V2-29). What they do against a database is in
  // vehicle-models/vehicle-models.integration.spec.ts; a request that is turned away is turned away before any database call.
  describe('vehicle models: the door and the input (V2-29)', () => {
    const SLUG = 'renault-clio';
    const routes: [string, string][] = [
      ['GET', '/admin/vehicle-models'],
      ['POST', '/admin/vehicle-models'],
      ['GET', `/admin/vehicle-models/${SLUG}`],
      ['PATCH', `/admin/vehicle-models/${SLUG}`],
      ['POST', `/admin/vehicle-models/${SLUG}/retire`],
      ['POST', `/admin/vehicle-models/${SLUG}/restore`],
      ['GET', '/admin/vehicle-classes'],
    ];
    const withBody = (method: string) => (['POST', 'PATCH'].includes(method) ? { body: {} } : {});

    it('no session is 401 UNAUTHENTICATED on every route', async () => {
      for (const [method, path] of routes) {
        const response = await call(method, path, withBody(method));
        expect(response.status).toBe(401);
        expect((await response.json()).code).toBe('UNAUTHENTICATED');
      }
    });

    it('a customer is 403 FORBIDDEN on every route', async () => {
      const { cookie } = await signedIn('CUSTOMER');
      for (const [method, path] of routes) {
        const response = await call(method, path, { cookie, ...withBody(method) });
        expect(response.status).toBe(403);
        expect((await response.json()).code).toBe('FORBIDDEN');
      }
    });

    it('a new model with nothing in it asks for every field but the address and the picture', async () => {
      const { cookie } = await signedIn('ADMIN');
      const response = await call('POST', '/admin/vehicle-models', { cookie, body: {} });
      expect(response.status).toBe(422);
      expect(Object.keys((await response.json()).fieldErrors).sort()).toEqual(
        ['bags', 'brand', 'classSlug', 'consumption', 'dailyPrice', 'description', 'fuelType', 'model', 'seats', 'transmission'],
      );
    });

    it('wrong values are 422 with a code for each field', async () => {
      const { cookie } = await signedIn('ADMIN');
      const response = await call('POST', '/admin/vehicle-models', {
        cookie,
        body: {
          brand: 'Renault',
          model: 'Clio',
          slug: 'Bad Slug',
          classSlug: 'ekonomik',
          fuelType: 'STEAM',
          transmission: 'MANUAL',
          seats: '5',
          bags: 2,
          consumption: 'az',
          dailyPrice: 12.5,
          description: { tr: 'Türkçe', en: '' },
          imageUrl: 'https://evil.com/a.webp',
        },
      });
      expect(response.status).toBe(422);
      expect((await response.json()).fieldErrors).toEqual({
        slug: 'INVALID_FORMAT',
        fuelType: 'INVALID_FORMAT',
        seats: 'INVALID_FORMAT',
        consumption: 'INVALID_FORMAT',
        dailyPrice: 'INVALID_FORMAT',
        description: 'REQUIRED',
        imageUrl: 'INVALID_FORMAT',
      });
    });

    it('the address of a model cannot be changed: a change that sends one is 422 NOT_ALLOWED', async () => {
      const { cookie } = await signedIn('ADMIN');
      const response = await call('PATCH', `/admin/vehicle-models/${SLUG}`, {
        cookie,
        body: { updatedAt: '2026-10-29T10:00:00.000Z', slug: 'baska-adres' },
      });
      expect(response.status).toBe(422);
      expect((await response.json()).fieldErrors).toEqual({ slug: 'NOT_ALLOWED' });
    });

    it('a change has to say which version it was made against', async () => {
      const { cookie } = await signedIn('ADMIN');
      const response = await call('PATCH', `/admin/vehicle-models/${SLUG}`, { cookie, body: { dailyPrice: 150000 } });
      expect(response.status).toBe(422);
      expect((await response.json()).fieldErrors).toEqual({ updatedAt: 'REQUIRED' });
    });

    it('a list asked for in a way that makes no sense is 422', async () => {
      const { cookie } = await signedIn('ADMIN');
      for (const [query, field] of [
        ['pageSize=101', 'pageSize'],
        ['sort=passwordHash:asc', 'sort'],
        ['status=GONE', 'status'],
        ['fuel=STEAM', 'fuel'],
        ['class=Not%20A%20Slug', 'class'],
      ] as const) {
        const response = await call('GET', `/admin/vehicle-models?${query}`, { cookie });
        expect(response.status).toBe(422);
        expect(Object.keys((await response.json()).fieldErrors)).toEqual([field]);
      }
    });

    it('an address that cannot be one is 404 without asking the database', async () => {
      const { cookie } = await signedIn('ADMIN');
      for (const [method, path] of [
        ['GET', '/admin/vehicle-models/Not%20A%20Slug'],
        ['POST', '/admin/vehicle-models/Not%20A%20Slug/retire'],
        ['POST', '/admin/vehicle-models/Not%20A%20Slug/restore'],
      ] as const) {
        const response = await call(method, path, { cookie, ...withBody(method) });
        expect(response.status).toBe(404);
        expect((await response.json()).code).toBe('NOT_FOUND');
      }
    });

    it('a body that is not JSON is 415', async () => {
      const { cookie } = await signedIn('ADMIN');
      const response = await call('POST', '/admin/vehicle-models', { cookie, body: 'brand=x', type: 'text/plain' });
      expect(response.status).toBe(415);
    });
  });

  // The door and the input of the vehicle and extra service endpoints (V2-30). What they do against a database is in
  // vehicles/vehicles.integration.spec.ts and extras/extras.integration.spec.ts.
  describe('vehicles and extra services: the door and the input (V2-30)', () => {
    const ID = '6f0a1f7e-8f5e-4b86-9f5c-2d2f6d9a0b11';
    const routes: [string, string][] = [
      ['GET', '/admin/vehicles'],
      ['POST', '/admin/vehicles'],
      ['GET', `/admin/vehicles/${ID}`],
      ['PATCH', `/admin/vehicles/${ID}`],
      ['GET', '/admin/extras'],
      ['GET', '/admin/extras/child-seat'],
      ['PATCH', '/admin/extras/child-seat'],
    ];
    const withBody = (method: string) => (['POST', 'PATCH'].includes(method) ? { body: {} } : {});

    it('no session is 401 UNAUTHENTICATED on every route', async () => {
      for (const [method, path] of routes) {
        const response = await call(method, path, withBody(method));
        expect(response.status).toBe(401);
        expect((await response.json()).code).toBe('UNAUTHENTICATED');
      }
    });

    it('a customer is 403 FORBIDDEN on every route', async () => {
      const { cookie } = await signedIn('CUSTOMER');
      for (const [method, path] of routes) {
        const response = await call(method, path, { cookie, ...withBody(method) });
        expect(response.status).toBe(403);
        expect((await response.json()).code).toBe('FORBIDDEN');
      }
    });

    it('a new car with nothing in it asks for all four fields', async () => {
      const { cookie } = await signedIn('ADMIN');
      const response = await call('POST', '/admin/vehicles', { cookie, body: {} });
      expect(response.status).toBe(422);
      expect(Object.keys((await response.json()).fieldErrors).sort()).toEqual(['branchId', 'modelSlug', 'plate', 'year']);
    });

    it('a plate that is not a Turkish one, a year out of range and a branch that is not an id are 422 with a code each', async () => {
      const { cookie } = await signedIn('ADMIN');
      const response = await call('POST', '/admin/vehicles', {
        cookie,
        body: { plate: '99 QWX 1', year: 2010, modelSlug: 'Not A Slug', branchId: 'istanbul' },
      });
      expect(response.status).toBe(422);
      expect((await response.json()).fieldErrors).toEqual({
        plate: 'INVALID_FORMAT',
        year: 'OUT_OF_RANGE',
        modelSlug: 'INVALID_FORMAT',
        branchId: 'INVALID_FORMAT',
      });
    });

    it('the plate, the year and the model of a car cannot be changed: a change that sends one is 422 NOT_ALLOWED', async () => {
      const { cookie } = await signedIn('ADMIN');
      const response = await call('PATCH', `/admin/vehicles/${ID}`, {
        cookie,
        body: { updatedAt: '2026-10-29T10:00:00.000Z', plate: '34 ABC 123', year: 2024, modelSlug: 'renault-clio' },
      });
      expect(response.status).toBe(422);
      expect((await response.json()).fieldErrors).toEqual({ plate: 'NOT_ALLOWED', year: 'NOT_ALLOWED', modelSlug: 'NOT_ALLOWED' });
    });

    it('a change to a car or an extra has to say which version it was made against', async () => {
      const { cookie } = await signedIn('ADMIN');
      for (const path of [`/admin/vehicles/${ID}`, '/admin/extras/child-seat']) {
        const response = await call('PATCH', path, { cookie, body: { active: false, price: 100 } });
        expect(response.status).toBe(422);
        expect((await response.json()).fieldErrors).toMatchObject({ updatedAt: 'REQUIRED' });
      }
    });

    it('an extra keeps its address and its way of being priced, and takes a price in kuruş that is a whole number in range', async () => {
      const { cookie } = await signedIn('ADMIN');
      const response = await call('PATCH', '/admin/extras/child-seat', {
        cookie,
        body: { updatedAt: '2026-10-29T10:00:00.000Z', slug: 'other', pricing: 'FIXED', price: 12.5, name: { tr: 'Çocuk koltuğu', en: '' } },
      });
      expect(response.status).toBe(422);
      expect((await response.json()).fieldErrors).toEqual({ slug: 'NOT_ALLOWED', pricing: 'NOT_ALLOWED', price: 'INVALID_FORMAT', name: 'REQUIRED' });
    });

    it('a list asked for in a way that makes no sense is 422', async () => {
      const { cookie } = await signedIn('ADMIN');
      for (const [query, field] of [
        ['pageSize=101', 'pageSize'],
        ['sort=passwordHash:asc', 'sort'],
        ['status=GONE', 'status'],
        ['branch=istanbul', 'branch'],
        ['model=Not%20A%20Slug', 'model'],
      ] as const) {
        const response = await call('GET', `/admin/vehicles?${query}`, { cookie });
        expect(response.status).toBe(422);
        expect(Object.keys((await response.json()).fieldErrors)).toEqual([field]);
      }
    });

    it('an id or an address that cannot be one is 404 without asking the database', async () => {
      const { cookie } = await signedIn('ADMIN');
      for (const [method, path] of [
        ['GET', '/admin/vehicles/not-an-id'],
        ['PATCH', '/admin/vehicles/not-an-id'],
        ['GET', '/admin/extras/Not%20A%20Slug'],
        ['PATCH', '/admin/extras/Not%20A%20Slug'],
      ] as const) {
        const response = await call(method, path, { cookie, ...withBody(method) });
        expect(response.status).toBe(404);
        expect((await response.json()).code).toBe('NOT_FOUND');
      }
    });

    it('a body that is not JSON is 415', async () => {
      const { cookie } = await signedIn('ADMIN');
      const response = await call('POST', '/admin/vehicles', { cookie, body: 'plate=x', type: 'text/plain' });
      expect(response.status).toBe(415);
    });
  });

  // The door and the input of the booking endpoints (V2-31). What they do against a database is in
  // reservations/reservations.integration.spec.ts; a request that is turned away is turned away before any database call.
  describe('bookings: the door and the input (V2-31)', () => {
    const NUMBER = 'NVR-2026-00123';
    const routes: [string, string][] = [
      ['GET', '/admin/reservations'],
      ['GET', `/admin/reservations/${NUMBER}`],
      ['POST', `/admin/reservations/${NUMBER}/cancel`],
    ];
    const withBody = (method: string) => (method === 'POST' ? { body: {} } : {});

    it('no session is 401 UNAUTHENTICATED on every route', async () => {
      for (const [method, path] of routes) {
        const response = await call(method, path, withBody(method));
        expect(response.status).toBe(401);
        expect((await response.json()).code).toBe('UNAUTHENTICATED');
      }
    });

    it('a customer is 403 FORBIDDEN on every route', async () => {
      const { cookie } = await signedIn('CUSTOMER');
      for (const [method, path] of routes) {
        const response = await call(method, path, { cookie, ...withBody(method) });
        expect(response.status).toBe(403);
        expect((await response.json()).code).toBe('FORBIDDEN');
      }
    });

    it('a cancellation without a reason, or with one that is too short, is 422 with a code', async () => {
      const { cookie } = await signedIn('ADMIN');
      const none = await call('POST', `/admin/reservations/${NUMBER}/cancel`, { cookie, body: {} });
      expect(none.status).toBe(422);
      expect((await none.json()).fieldErrors).toEqual({ reason: 'REQUIRED' });
      const short = await call('POST', `/admin/reservations/${NUMBER}/cancel`, { cookie, body: { reason: 'kısa' } });
      expect(short.status).toBe(422);
      expect((await short.json()).fieldErrors).toEqual({ reason: 'TOO_SHORT' });
    });

    it('a list asked for in a way that makes no sense is 422', async () => {
      const { cookie } = await signedIn('ADMIN');
      for (const [query, field] of [
        ['pageSize=101', 'pageSize'],
        ['sort=passwordHash:asc', 'sort'],
        ['status=GONE', 'status'],
        ['branch=istanbul', 'branch'],
        ['from=yesterday', 'from'],
        ['to=2026-13-40', 'to'],
        ['from=2026-10-12&to=2026-10-10', 'to'],
      ] as const) {
        const response = await call('GET', `/admin/reservations?${query}`, { cookie });
        expect(response.status).toBe(422);
        expect(Object.keys((await response.json()).fieldErrors)).toEqual([field]);
      }
    });

    it('a number that cannot be one is 404 without asking the database', async () => {
      const { cookie } = await signedIn('ADMIN');
      for (const [method, path] of [
        ['GET', '/admin/reservations/not-a-number'],
        ['POST', '/admin/reservations/not-a-number/cancel'],
      ] as const) {
        const response = await call(method, path, method === 'POST' ? { cookie, body: { reason: 'Deneme nedeni' } } : { cookie });
        expect(response.status).toBe(404);
        expect((await response.json()).code).toBe('NOT_FOUND');
      }
    });

    it('a body that is not JSON is 415', async () => {
      const { cookie } = await signedIn('ADMIN');
      const response = await call('POST', `/admin/reservations/${NUMBER}/cancel`, { cookie, body: 'reason=x', type: 'text/plain' });
      expect(response.status).toBe(415);
    });
  });

  // The door and the input of the quote request and contact message endpoints (V2-32). What they do against a database is in
  // quotes/quotes.integration.spec.ts and messages/messages.integration.spec.ts; a request that is turned away is turned away
  // before any database call.
  describe('quote requests and contact messages: the door and the input (V2-32)', () => {
    const NUMBER = 'TKL-2026-00042';
    const ID = '6f0a1f7e-8f5e-4b86-9f5c-2d2f6d9a0b11';
    const routes: [string, string][] = [
      ['GET', '/admin/quotes'],
      ['GET', `/admin/quotes/${NUMBER}`],
      ['PATCH', `/admin/quotes/${NUMBER}`],
      ['GET', '/admin/contact-messages'],
      ['GET', `/admin/contact-messages/${ID}`],
      ['PATCH', `/admin/contact-messages/${ID}`],
    ];
    const withBody = (method: string) => (method === 'PATCH' ? { body: {} } : {});

    it('no session is 401 UNAUTHENTICATED on every route', async () => {
      for (const [method, path] of routes) {
        const response = await call(method, path, withBody(method));
        expect(response.status).toBe(401);
        expect((await response.json()).code).toBe('UNAUTHENTICATED');
      }
    });

    it('a customer is 403 FORBIDDEN on every route', async () => {
      const { cookie } = await signedIn('CUSTOMER');
      for (const [method, path] of routes) {
        const response = await call(method, path, { cookie, ...withBody(method) });
        expect(response.status).toBe(403);
        expect((await response.json()).code).toBe('FORBIDDEN');
      }
    });

    it('a change to a quote request has to say which version it was made against', async () => {
      const { cookie } = await signedIn('ADMIN');
      const response = await call('PATCH', `/admin/quotes/${NUMBER}`, { cookie, body: { status: 'OFFERED' } });
      expect(response.status).toBe(422);
      expect((await response.json()).fieldErrors).toEqual({ updatedAt: 'REQUIRED' });
    });

    it('a state that does not exist, and a note that is not text or is too long, are 422 with a code each', async () => {
      const { cookie } = await signedIn('ADMIN');
      const response = await call('PATCH', `/admin/quotes/${NUMBER}`, {
        cookie,
        body: { updatedAt: '2026-10-29T10:00:00.000Z', status: 'DONE', internalNote: 12 },
      });
      expect(response.status).toBe(422);
      expect((await response.json()).fieldErrors).toEqual({ status: 'INVALID_FORMAT', internalNote: 'INVALID_FORMAT' });
      const long = await call('PATCH', `/admin/quotes/${NUMBER}`, { cookie, body: { updatedAt: '2026-10-29T10:00:00.000Z', internalNote: 'x'.repeat(2001) } });
      expect((await long.json()).fieldErrors).toEqual({ internalNote: 'TOO_LONG' });
    });

    it('the mark on a message needs a real true or false', async () => {
      const { cookie } = await signedIn('ADMIN');
      const none = await call('PATCH', `/admin/contact-messages/${ID}`, { cookie, body: {} });
      expect(none.status).toBe(422);
      expect((await none.json()).fieldErrors).toEqual({ handled: 'REQUIRED' });
      const text = await call('PATCH', `/admin/contact-messages/${ID}`, { cookie, body: { handled: 'yes' } });
      expect((await text.json()).fieldErrors).toEqual({ handled: 'INVALID_FORMAT' });
    });

    it('a list asked for in a way that makes no sense is 422', async () => {
      const { cookie } = await signedIn('ADMIN');
      for (const [path, field] of [
        ['/admin/quotes?pageSize=101', 'pageSize'],
        ['/admin/quotes?sort=internalNote:asc', 'sort'],
        ['/admin/quotes?status=GONE', 'status'],
        ['/admin/quotes?source=MAIL', 'source'],
        ['/admin/contact-messages?handled=maybe', 'handled'],
        ['/admin/contact-messages?sort=message:asc', 'sort'],
      ] as const) {
        const response = await call('GET', path, { cookie });
        expect(response.status).toBe(422);
        expect(Object.keys((await response.json()).fieldErrors)).toEqual([field]);
      }
    });

    it('a number or an id that cannot be one is 404 without asking the database', async () => {
      const { cookie } = await signedIn('ADMIN');
      for (const [method, path] of [
        ['GET', '/admin/quotes/not-a-number'],
        ['PATCH', '/admin/quotes/not-a-number'],
        ['GET', '/admin/contact-messages/not-an-id'],
        ['PATCH', '/admin/contact-messages/not-an-id'],
      ] as const) {
        const response = await call(method, path, { cookie, ...(method === 'PATCH' ? { body: { handled: true, updatedAt: '2026-10-29T10:00:00.000Z' } } : {}) });
        expect(response.status).toBe(404);
        expect((await response.json()).code).toBe('NOT_FOUND');
      }
    });

    it('a body that is not JSON is 415', async () => {
      const { cookie } = await signedIn('ADMIN');
      const response = await call('PATCH', `/admin/quotes/${NUMBER}`, { cookie, body: 'status=OFFERED', type: 'text/plain' });
      expect(response.status).toBe(415);
    });
  });

  // The door and the input of the company endpoints (V2-33). What they do against a database is in
  // companies/companies.integration.spec.ts; a request that is turned away is turned away before any database call.
  describe('companies and invitations: the door and the input (V2-33)', () => {
    const ID = '6f0a1f7e-8f5e-4b86-9f5c-2d2f6d9a0b11';
    const USER_ID = '0b1c2d3e-8f5e-4b86-9f5c-2d2f6d9a0b22';
    const routes: [string, string][] = [
      ['GET', '/admin/companies'],
      ['POST', '/admin/companies'],
      ['GET', `/admin/companies/${ID}`],
      ['PATCH', `/admin/companies/${ID}`],
      ['POST', `/admin/companies/${ID}/users`],
      ['POST', `/admin/companies/${ID}/users/${USER_ID}/resend`],
    ];
    const withBody = (method: string, path: string) => (method === 'POST' && !path.endsWith('/resend') ? { body: {} } : method === 'PATCH' ? { body: {} } : {});

    it('no session is 401 UNAUTHENTICATED on every route', async () => {
      for (const [method, path] of routes) {
        const response = await call(method, path, withBody(method, path));
        expect(response.status).toBe(401);
        expect((await response.json()).code).toBe('UNAUTHENTICATED');
      }
    });

    it('a customer is 403 FORBIDDEN on every route', async () => {
      const { cookie } = await signedIn('CUSTOMER');
      for (const [method, path] of routes) {
        const response = await call(method, path, { cookie, ...withBody(method, path) });
        expect(response.status).toBe(403);
        expect((await response.json()).code).toBe('FORBIDDEN');
      }
    });

    it('a new company with nothing in it asks for the name', async () => {
      const { cookie } = await signedIn('ADMIN');
      const response = await call('POST', '/admin/companies', { cookie, body: {} });
      expect(response.status).toBe(422);
      expect((await response.json()).fieldErrors).toEqual({ name: 'REQUIRED' });
    });

    it('wrong values are 422 with a code for each field', async () => {
      const { cookie } = await signedIn('ADMIN');
      const response = await call('POST', '/admin/companies', {
        cookie,
        body: { name: 'A', phone: 'abc', taxOffice: 12, salesContact: { name: 'Selin', email: 'degil', phone: '+90 212 555 01 99' } },
      });
      expect(response.status).toBe(422);
      expect((await response.json()).fieldErrors).toEqual({ name: 'TOO_SHORT', phone: 'INVALID_FORMAT', taxOffice: 'INVALID_FORMAT', salesContact: 'INVALID_EMAIL' });
    });

    it('a change has to say which version it was made against', async () => {
      const { cookie } = await signedIn('ADMIN');
      const response = await call('PATCH', `/admin/companies/${ID}`, { cookie, body: { city: 'Ankara' } });
      expect(response.status).toBe(422);
      expect((await response.json()).fieldErrors).toEqual({ updatedAt: 'REQUIRED' });
    });

    it('an invitation needs an e-mail address and a name, and a language that is one', async () => {
      const { cookie } = await signedIn('ADMIN');
      const none = await call('POST', `/admin/companies/${ID}/users`, { cookie, body: {} });
      expect(none.status).toBe(422);
      expect(Object.keys((await none.json()).fieldErrors).sort()).toEqual(['email', 'firstName', 'lastName']);
      const wrong = await call('POST', `/admin/companies/${ID}/users`, { cookie, body: { email: 'degil', firstName: 'A', lastName: 'B', locale: 'fr' } });
      expect((await wrong.json()).fieldErrors).toEqual({ email: 'INVALID_EMAIL', locale: 'INVALID_FORMAT' });
    });

    it('a list asked for in a way that makes no sense is 422', async () => {
      const { cookie } = await signedIn('ADMIN');
      for (const [query, field] of [
        ['pageSize=101', 'pageSize'],
        ['sort=salesContact:asc', 'sort'],
        ['q=' + 'x'.repeat(101), 'q'],
      ] as const) {
        const response = await call('GET', `/admin/companies?${query}`, { cookie });
        expect(response.status).toBe(422);
        expect(Object.keys((await response.json()).fieldErrors)).toEqual([field]);
      }
    });

    it('an id that cannot be one is 404 without asking the database', async () => {
      const { cookie } = await signedIn('ADMIN');
      for (const [method, path] of [
        ['GET', '/admin/companies/not-an-id'],
        ['PATCH', '/admin/companies/not-an-id'],
        ['POST', '/admin/companies/not-an-id/users'],
        ['POST', `/admin/companies/${ID}/users/not-an-id/resend`],
      ] as const) {
        const response = await call(method, path, { cookie, body: method === 'POST' && path.endsWith('/users') ? { email: 'a@b.co', firstName: 'A', lastName: 'B' } : method === 'PATCH' ? { updatedAt: '2026-10-29T10:00:00.000Z' } : undefined });
        expect(response.status).toBe(404);
        expect((await response.json()).code).toBe('NOT_FOUND');
      }
    });

    it('a body that is not JSON is 415', async () => {
      const { cookie } = await signedIn('ADMIN');
      const response = await call('POST', '/admin/companies', { cookie, body: 'name=x', type: 'text/plain' });
      expect(response.status).toBe(415);
    });
  });

  describe('the audit log', () => {
    it('a change is logged with the names of its fields and none of the values', async () => {
      const { cookie, id } = await signedIn('ADMIN');
      const response = await call('POST', '/admin/ping', {
        cookie,
        body: { note: 'a secret value 4455 555 66 77', other: 1, 'has a space': 2, 'ayse@example.com': 3 },
      });
      expect(response.status).toBe(204);
      expect(fake.auditLogs).toHaveLength(1);
      const [row] = fake.auditLogs;
      expect(row).toMatchObject({ actorId: id, action: 'admin.ping', entity: 'ping', entityId: null, fields: ['note', 'other'] });
      // Nothing but names: not the value, not a key that is not a plain name.
      const written = JSON.stringify(fake.auditLogs);
      expect(written).not.toContain('secret value');
      expect(written).not.toContain('ayse@example.com');
      expect(written).not.toContain('has a space');
    });

    it('a read is not logged, nor a change that was refused or failed', async () => {
      const { cookie } = await signedIn('ADMIN');
      await call('GET', '/admin/ping', { cookie });
      const invalid = await call('POST', '/admin/ping', { cookie, body: { note: 'x'.repeat(500) } });
      expect(invalid.status).toBe(422);
      const customer = await signedIn('CUSTOMER');
      expect((await call('POST', '/admin/ping', { cookie: customer.cookie, body: { note: 'x' } })).status).toBe(403);
      expect((await call('POST', '/admin/ping', { body: { note: 'x' } })).status).toBe(401);
      expect(fake.auditLogs).toHaveLength(0);
    });

    it('turns away a body that is not JSON before anything is written (415)', async () => {
      const { cookie } = await signedIn('ADMIN');
      const response = await call('POST', '/admin/ping', { cookie, body: 'note=x', type: 'application/x-www-form-urlencoded' });
      expect(response.status).toBe(415);
      expect(fake.auditLogs).toHaveLength(0);
    });
  });

  describe('the limit (120 a minute for the administrator)', () => {
    it('counts the administrator, not the address, and refuses the 121st with 429', async () => {
      const first = await signedIn('ADMIN');
      const second = await signedIn('ADMIN');
      let last = 0;
      for (let i = 0; i < LIMITS.admin.limit + 1; i++) last = (await call('GET', '/admin/ping', { cookie: first.cookie, address: first.address })).status;
      expect(last).toBe(429);
      // Another administrator, even from the same address, has their own counter.
      expect((await call('GET', '/admin/ping', { cookie: second.cookie, address: first.address })).status).toBe(200);
    });

    it('is counted before the door: probing without a session is limited by address too', async () => {
      const address = freshAddress();
      const statuses = new Set<number>();
      for (let i = 0; i < LIMITS.admin.limit + 1; i++) statuses.add((await call('GET', '/admin/ping', { address })).status);
      expect(statuses).toEqual(new Set([401, 429]));
    });
  });
});
