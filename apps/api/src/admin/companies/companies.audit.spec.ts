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
import { CompaniesService } from './companies.service.js';
import type { CompanyDetail, CompanyUser } from './companies.view.js';

// "Every change is written to the audit log" (V2-33, ADR-24) for the companies and the invitations: the action, the company, and
// the NAMES of the fields that were sent, never their values. The people invited are personal data: their e-mail addresses and
// names are not in the log. The service is replaced by one that answers, so this is only about what the interceptor writes.
const fake = new FakePrisma();

@Global()
@Module({ providers: [{ provide: PrismaService, useValue: fake }], exports: [PrismaService] })
class FakePrismaModule {}

const ID = '6f0a1f7e-8f5e-4b86-9f5c-2d2f6d9a0b11';
const USER_ID = '0b1c2d3e-8f5e-4b86-9f5c-2d2f6d9a0b22';
const COMPANY: CompanyDetail = {
  id: ID,
  name: 'Ege Lojistik A.Ş.',
  taxOffice: 'Bornova',
  city: 'İzmir',
  phone: '+90 232 555 01 00',
  salesContact: null,
  createdAt: '2026-10-29T10:00:00.000Z',
  updatedAt: '2026-10-29T10:00:00.000Z',
  users: [],
};
const PERSON: CompanyUser = {
  id: USER_ID,
  email: 'mert@egelojistik.example',
  firstName: 'Mert',
  lastName: 'Kaya',
  title: 'Filo Müdürü',
  status: 'PENDING',
  invite: { expiresAt: '2026-11-06T10:00:00.000Z', expired: false },
  createdAt: '2026-10-29T10:00:00.000Z',
};
const service = {
  list: async () => ({ items: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => COMPANY,
  create: async () => COMPANY,
  update: async () => COMPANY,
  invite: async () => PERSON,
  resend: async () => PERSON,
};

describe('companies in the audit log (V2-33)', () => {
  let app: INestApplication;
  let base = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [FakePrismaModule, AuthModule, RateLimitModule, AdminModule] })
      .overrideProvider(CompaniesService)
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
        'X-Forwarded-For': `10.10.${Math.floor(counter / 250)}.${(counter += 1) % 250}`,
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

  it('making a company, changing it, inviting a person and sending the invitation again each leave one row: action, company, only the field names', async () => {
    const { cookie, id } = await administrator();
    expect((await call('POST', '/admin/companies', { cookie, body: { name: 'Ege Lojistik A.Ş.', city: 'İzmir' } })).status).toBe(201);
    expect((await call('PATCH', `/admin/companies/${ID}`, { cookie, body: { updatedAt: COMPANY.updatedAt, phone: '+90 232 555 01 00' } })).status).toBe(200);
    expect((await call('POST', `/admin/companies/${ID}/users`, { cookie, body: { email: PERSON.email, firstName: 'Mert', lastName: 'Kaya', title: 'Filo Müdürü' } })).status).toBe(201);
    expect((await call('POST', `/admin/companies/${ID}/users/${USER_ID}/resend`, { cookie })).status).toBe(200);

    expect(fake.auditLogs).toHaveLength(4);
    expect(fake.auditLogs[0]).toMatchObject({ actorId: id, action: 'company.create', entity: 'company', entityId: ID, fields: ['name', 'city'] });
    expect(fake.auditLogs[1]).toMatchObject({ action: 'company.update', entityId: ID, fields: ['updatedAt', 'phone'] });
    expect(fake.auditLogs[2]).toMatchObject({ action: 'company.invite', entityId: ID, fields: ['email', 'firstName', 'lastName', 'title'] });
    expect(fake.auditLogs[3]).toMatchObject({ action: 'company.invite-resend', entityId: ID, fields: [] });
    // Names only: not the company's details, and nothing about the person invited.
    const written = JSON.stringify(fake.auditLogs);
    for (const secret of ['mert@egelojistik', 'Mert', 'Kaya', 'Filo Müdürü', '555 01 00', 'Bornova']) expect(written).not.toContain(secret);
  });

  it('a read is not logged', async () => {
    const { cookie } = await administrator();
    expect((await call('GET', '/admin/companies', { cookie })).status).toBe(200);
    expect((await call('GET', `/admin/companies/${ID}`, { cookie })).status).toBe(200);
    expect(fake.auditLogs).toHaveLength(0);
  });
});
