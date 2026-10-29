import 'reflect-metadata';
import { Global, Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { configureApp } from '../app.setup.js';
import { AuthModule } from '../auth/auth.module.js';
import { FakePrisma } from '../auth/auth.testing.js';
import { RateLimitModule } from '../common/rate-limit.module.js';
import { RateLimitStore } from '../common/rate-limit.store.js';
import { MemoryRateLimitStore } from '../common/rate-limit.testing.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AdminModule } from './admin.module.js';
import { PromoCodesService } from './promo-codes.service.js';
import type { PromoCodeView } from './promo-codes.view.js';

// "Every change is written to the audit log" (V2-26, ADR-24) for the campaign codes: the action, the code as the id, and
// the NAMES of the fields that were sent, never their values. The service is replaced by one that answers, so this is only
// about what the interceptor writes; what the service does is in promo-codes.integration.spec.ts.
const fake = new FakePrisma();

@Global()
@Module({ providers: [{ provide: PrismaService, useValue: fake }], exports: [PrismaService] })
class FakePrismaModule {}

const VIEW: PromoCodeView = {
  code: 'YAZ25',
  percent: 25,
  active: true,
  validFrom: null,
  validUntil: null,
  maxRedemptions: null,
  oncePerUser: true,
  used: 0,
  deletable: true,
  status: 'ACTIVE',
  createdAt: '2026-10-29T10:00:00.000Z',
  updatedAt: '2026-10-29T10:00:00.000Z',
};
const service = {
  list: async () => ({ items: [VIEW], total: 1, page: 1, pageSize: 20 }),
  get: async () => VIEW,
  create: async () => VIEW,
  update: async () => VIEW,
  remove: async () => undefined,
};

describe('campaign codes in the audit log (V2-26)', () => {
  let app: INestApplication;
  let base = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [FakePrismaModule, AuthModule, RateLimitModule, AdminModule] })
      .overrideProvider(PromoCodesService)
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
  const call = (method: string, path: string, options: { body?: unknown; cookie?: string } = {}) =>
    fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': `10.8.${Math.floor(counter / 250)}.${(counter += 1) % 250}`,
        ...(options.cookie ? { Cookie: options.cookie } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

  async function administrator() {
    const response = await call('POST', '/auth/register', {
      body: { email: `yonetici${counter}@example.com`, password: 'long-enough-1', firstName: 'Ece', lastName: 'Aydın', consent: true },
    });
    const cookie = (response.headers.get('set-cookie') ?? '').split(';')[0]!;
    const user = fake.users.at(-1)!;
    user.role = 'ADMIN';
    return { cookie, id: user.id as string };
  }

  it('creating, changing and deleting each leave one row: action, code, and only the field names', async () => {
    const { cookie, id } = await administrator();

    expect((await call('POST', '/admin/promo-codes', { cookie, body: { code: 'yaz25', percent: 25, maxRedemptions: 100 } })).status).toBe(201);
    expect((await call('PATCH', '/admin/promo-codes/yaz25', { cookie, body: { updatedAt: VIEW.updatedAt, percent: 30 } })).status).toBe(200);
    expect((await call('DELETE', '/admin/promo-codes/YAZ25', { cookie })).status).toBe(204);

    expect(fake.auditLogs).toHaveLength(3);
    expect(fake.auditLogs[0]).toMatchObject({ actorId: id, action: 'promo-code.create', entity: 'promo-code', entityId: 'YAZ25', fields: ['code', 'percent', 'maxRedemptions'] });
    // The code in the address is written the way it is stored, whatever case it came in.
    expect(fake.auditLogs[1]).toMatchObject({ action: 'promo-code.update', entity: 'promo-code', entityId: 'YAZ25', fields: ['updatedAt', 'percent'] });
    expect(fake.auditLogs[2]).toMatchObject({ action: 'promo-code.delete', entity: 'promo-code', entityId: 'YAZ25', fields: [] });
    // Not one value: a percent, a limit or a date is not in the log.
    expect(JSON.stringify(fake.auditLogs)).not.toContain('"percent":');
  });

  it('a read is not logged', async () => {
    const { cookie } = await administrator();
    expect((await call('GET', '/admin/promo-codes', { cookie })).status).toBe(200);
    expect((await call('GET', '/admin/promo-codes/YAZ25', { cookie })).status).toBe(200);
    expect(fake.auditLogs).toHaveLength(0);
  });
});
