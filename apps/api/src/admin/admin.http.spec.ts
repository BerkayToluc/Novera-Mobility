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
  unhandledMessages: null,
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
