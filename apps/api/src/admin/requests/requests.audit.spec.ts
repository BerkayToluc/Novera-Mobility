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
import { AdminRequestsService } from './requests.service.js';

// "Every change is written to the audit log" (V2-41, ADR-24) for the service requests: the action, the number, the company where the answer
// has it, and only the NAMES of the fields that were sent. The service is replaced by one that answers, so this is only about what the
// interceptor writes.
const fake = new FakePrisma();

@Global()
@Module({ providers: [{ provide: PrismaService, useValue: fake }], exports: [PrismaService] })
class FakePrismaModule {}

const COMPANY = '5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e01';
const NUMBER = 'TLP-2026-00007';
const answer = async () => ({ number: NUMBER, company: { id: COMPANY, name: 'Ege Lojistik A.Ş.' } });
const service = { list: async () => ({ items: [], total: 0, page: 1, pageSize: 20 }), get: answer, setStatus: answer };

describe('service requests in the audit log (V2-41)', () => {
  let app: INestApplication;
  let base = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [FakePrismaModule, AuthModule, RateLimitModule, AdminModule] })
      .overrideProvider(AdminRequestsService)
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
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.52.${Math.floor(counter / 250)}.${(counter += 1) % 250}`, ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  async function administrator() {
    const registered = await call('POST', '/auth/register', undefined, { email: `yonetici${counter}@example.com`, password: 'long-enough-1', firstName: 'Ece', lastName: 'Aydın', consent: true });
    const cookie = (registered.headers.get('set-cookie') ?? '').split(';')[0]!;
    const user = fake.users.at(-1)!;
    user.role = 'ADMIN';
    return { cookie, id: user.id as string };
  }

  it('moving a request leaves one row: the action, the number, the company, only the field names, and none of the words', async () => {
    const { cookie, id } = await administrator();
    expect((await call('POST', `/admin/requests/${NUMBER.toLowerCase()}/status`, cookie, { status: 'DISPATCHED', note: 'Çekici yola çıktı', assignee: 'Ege Çekici 0532 000 00 00' })).status).toBe(200);
    expect(fake.auditLogs).toHaveLength(1);
    expect(fake.auditLogs[0]).toMatchObject({ actorId: id, companyId: COMPANY, action: 'request.status', entity: 'request', entityId: NUMBER, fields: ['status', 'note', 'assignee'] });
    const written = JSON.stringify(fake.auditLogs);
    for (const value of ['Çekici yola çıktı', 'Ege Çekici', '0532']) expect(written).not.toContain(value);
  });

  it('a read is not logged', async () => {
    const { cookie } = await administrator();
    expect((await call('GET', '/admin/requests', cookie)).status).toBe(200);
    expect((await call('GET', `/admin/requests/${NUMBER}`, cookie)).status).toBe(200);
    expect(fake.auditLogs).toHaveLength(0);
  });
});
