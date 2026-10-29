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

// "No session 401, customer 403, administrator 200" (ADMIN.md §6, V2-23), the audit log, and the order of the guards.
const fake = new FakePrisma();

@Global()
@Module({ providers: [{ provide: PrismaService, useValue: fake }], exports: [PrismaService] })
class FakePrismaModule {}

describe('administration over HTTP', () => {
  let app: INestApplication;
  let base = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [FakePrismaModule, AuthModule, RateLimitModule, AdminModule] })
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
