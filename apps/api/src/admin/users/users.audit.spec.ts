import 'reflect-metadata';
import { Global, Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { configureApp } from '../../app.setup.js';
import { AuthModule } from '../../auth/auth.module.js';
import { FakePrisma } from '../../auth/auth.testing.js';
import { RateLimitModule } from '../../common/rate-limit.module.js';
import { RateLimitStore } from '../../common/rate-limit.store.js';
import { MemoryRateLimitStore } from '../../common/rate-limit.testing.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AdminModule } from '../admin.module.js';
import { UsersService } from './users.service.js';
import type { UserDetail } from './users.view.js';

// "Every change is written to the audit log" (V2-34, ADR-24) for closing and opening an account: the action, the account's id, and
// no field names (the call has no body). The person's e-mail address and name are not in the log. The service is replaced by one
// that answers, so this is only about what the interceptor writes.
const fake = new FakePrisma();

@Global()
@Module({ providers: [{ provide: PrismaService, useValue: fake }], exports: [PrismaService] })
class FakePrismaModule {}

const ID = '0b1c2d3e-8f5e-4b86-9f5c-2d2f6d9a0b22';
const DETAIL: UserDetail = {
  id: ID,
  email: 'mert@egelojistik.example',
  firstName: 'Mert',
  lastName: 'Kaya',
  type: 'CORPORATE',
  status: 'DISABLED',
  companyName: 'Ege Lojistik A.Ş.',
  disabledAt: '2026-10-31T10:00:00.000Z',
  createdAt: '2026-10-29T10:00:00.000Z',
  title: null,
  locale: 'TR',
  hasPassword: true,
  googleLinked: false,
  company: null,
  reservations: { total: 0, upcoming: 0 },
  points: 0,
};
const service = {
  list: async () => ({ items: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => DETAIL,
  disable: async () => DETAIL,
  enable: async () => DETAIL,
};

describe('accounts in the audit log (V2-34)', () => {
  let app: INestApplication;
  let base = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [FakePrismaModule, AuthModule, RateLimitModule, AdminModule] })
      .overrideProvider(UsersService)
      .useValue(service)
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
  const call = (method: string, path: string, cookie?: string) =>
    fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': `10.20.${Math.floor(counter / 250)}.${(counter += 1) % 250}`,
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });

  async function administrator() {
    const registered = await fetch(base + '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.21.0.${(counter += 1) % 250}` },
      body: JSON.stringify({ email: `yonetici${counter}@example.com`, password: 'long-enough-1', firstName: 'Ece', lastName: 'Aydın', consent: true }),
    });
    const cookie = (registered.headers.get('set-cookie') ?? '').split(';')[0]!;
    const user = fake.users.at(-1)!;
    user.role = 'ADMIN';
    return { cookie, id: user.id as string };
  }

  it('closing and opening an account each leave one row: the action and the account, no field names, nothing about the person', async () => {
    const { cookie, id } = await administrator();
    expect((await call('POST', `/admin/users/${ID}/disable`, cookie)).status).toBe(200);
    expect((await call('POST', `/admin/users/${ID}/enable`, cookie)).status).toBe(200);

    expect(fake.auditLogs).toHaveLength(2);
    expect(fake.auditLogs[0]).toMatchObject({ actorId: id, action: 'user.disable', entity: 'user', entityId: ID, fields: [] });
    expect(fake.auditLogs[1]).toMatchObject({ actorId: id, action: 'user.enable', entity: 'user', entityId: ID, fields: [] });
    const written = JSON.stringify(fake.auditLogs);
    for (const secret of ['mert@egelojistik', 'Mert', 'Kaya', 'Ege Lojistik']) expect(written).not.toContain(secret);
  });

  it('a read is not logged, and neither is reading the log itself', async () => {
    const { cookie } = await administrator();
    expect((await call('GET', '/admin/users', cookie)).status).toBe(200);
    expect((await call('GET', `/admin/users/${ID}`, cookie)).status).toBe(200);
    expect(fake.auditLogs).toHaveLength(0);
  });
});
