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
import { AdminFleetExpensesService } from './fleet-expenses.service.js';

// "Every change is written to the audit log" (V2-38, ADR-24) for the expenses of the fleets: the action, the id, the company where the
// answer has it, and only the NAMES of the fields that were sent. The service is replaced by one that answers, so this is only about what
// the interceptor writes.
const fake = new FakePrisma();

@Global()
@Module({ providers: [{ provide: PrismaService, useValue: fake }], exports: [PrismaService] })
class FakePrismaModule {}

const COMPANY = '5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e01';
const ID = '6f0a1f7e-8f5e-4b86-9f5c-2d2f6d9a0b11';
const made = async () => ({ id: ID, company: { id: COMPANY, name: 'Ege Lojistik A.Ş.' } });
const service = { list: async () => ({ items: [], total: 0, page: 1, pageSize: 20 }), get: made, create: made, update: made };

describe('fleet expenses in the audit log (V2-38)', () => {
  let app: INestApplication;
  let base = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [FakePrismaModule, AuthModule, RateLimitModule, AdminModule] })
      .overrideProvider(AdminFleetExpensesService)
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
  const call = (method: string, path: string, cookie?: string, body?: unknown) =>
    fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.51.${Math.floor(counter / 250)}.${(counter += 1) % 250}`, ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  async function administrator() {
    const registered = await call('POST', '/auth/register', undefined, { email: `yonetici${counter}@example.com`, password: 'long-enough-1', firstName: 'Ece', lastName: 'Aydın', consent: true });
    const cookie = (registered.headers.get('set-cookie') ?? '').split(';')[0]!;
    const user = fake.users.at(-1)!;
    user.role = 'ADMIN';
    return { cookie, id: user.id as string };
  }

  it('entering an expense and correcting one each leave one row: the action, the id, the company, only the field names', async () => {
    const { cookie, id } = await administrator();
    expect((await call('POST', '/admin/fleet-expenses', cookie, { plate: '34 ABC 123', type: 'HGS', occurredAt: '2026-10-01', amount: 8550, place: 'Avrasya Tüneli' })).status).toBe(201);
    expect((await call('PATCH', `/admin/fleet-expenses/${ID}`, cookie, { updatedAt: '2026-10-31T10:00:00.000Z', amount: 9000 })).status).toBe(200);

    expect(fake.auditLogs).toHaveLength(2);
    expect(fake.auditLogs[0]).toMatchObject({ actorId: id, companyId: COMPANY, action: 'fleet-expense.create', entity: 'fleet-expense', entityId: ID, fields: ['plate', 'type', 'occurredAt', 'amount', 'place'] });
    expect(fake.auditLogs[1]).toMatchObject({ actorId: id, companyId: COMPANY, action: 'fleet-expense.update', entityId: ID, fields: ['updatedAt', 'amount'] });
    const written = JSON.stringify(fake.auditLogs);
    for (const value of ['34 ABC 123', 'Avrasya Tüneli', '8550']) expect(written).not.toContain(value);
  });

  it('a read is not logged', async () => {
    const { cookie } = await administrator();
    expect((await call('GET', '/admin/fleet-expenses', cookie)).status).toBe(200);
    expect((await call('GET', `/admin/fleet-expenses/${ID}`, cookie)).status).toBe(200);
    expect(fake.auditLogs).toHaveLength(0);
  });
});
