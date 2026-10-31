import 'reflect-metadata';
import { Global, Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminModule } from '../admin/admin.module.js';
import { configureApp } from '../app.setup.js';
import { AuthModule } from '../auth/auth.module.js';
import { FakePrisma } from '../auth/auth.testing.js';
import { RateLimitModule } from '../common/rate-limit.module.js';
import { RateLimitStore } from '../common/rate-limit.store.js';
import { MemoryRateLimitStore } from '../common/rate-limit.testing.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FleetAssignmentsService } from './fleet-assignments.service.js';
import { FleetContractsService } from './fleet-contracts.service.js';
import { FleetEmployeesService } from './fleet-employees.service.js';
import { FleetExpensesService } from './fleet-expenses.service.js';
import { FleetInvoicesService } from './fleet-invoices.service.js';
import { FleetGreenService } from './fleet-green.service.js';
import { FleetReportsService } from './fleet-reports.service.js';
import { FleetRequestsService } from './fleet-requests.service.js';
import { FleetSummaryService } from './fleet-summary.service.js';
import { FleetVehiclesService } from './fleet-vehicles.service.js';
import { FleetModule } from './fleet.module.js';

// "No session 401, not a corporate account of a company 403" for every `/fleet/*` route (V2-35, FLEET.md §2, §4.1), the audit log of
// what is changed (the account is the actor, the company is on the line, only field names), and the limit. What the endpoints do with
// the data, and that another company's record is a 404, is in fleet.integration.spec.ts against a database. The services are replaced
// by ones that answer, so this is only about the door and the log.
const fake = new FakePrisma();

@Global()
@Module({ providers: [{ provide: PrismaService, useValue: fake }], exports: [PrismaService] })
class FakePrismaModule {}

const ID = '6f0a1f7e-8f5e-4b86-9f5c-2d2f6d9a0b11';
const COMPANY = '5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e01';
const page = { items: [], total: 0, page: 1, pageSize: 20 };
const answer = async () => ({ id: ID });
const stub = (names: string[]) => Object.fromEntries(names.map((name) => [name, name === 'list' ? async () => page : answer]));

const ROUTES: Array<[string, string, unknown?]> = [
  ['GET', '/fleet/summary'],
  ['GET', '/fleet/vehicles'],
  ['GET', '/fleet/vehicles/34-ABC-123'],
  ['GET', '/fleet/contracts'],
  ['GET', '/fleet/contracts/SZL-2026-00001'],
  ['GET', '/fleet/employees'],
  ['GET', `/fleet/employees/${ID}`],
  ['POST', '/fleet/employees', { firstName: 'Ada', lastName: 'Kaya', email: 'ada@example.test' }],
  ['PATCH', `/fleet/employees/${ID}`, { updatedAt: '2026-10-31T10:00:00.000Z', department: 'Satış' }],
  ['GET', '/fleet/invoices'],
  ['GET', '/fleet/invoices/FTR-2026-00001'],
  ['GET', '/fleet/assignments'],
  ['POST', '/fleet/assignments', { fleetVehicleId: ID, employeeId: ID, note: 'Not' }],
  ['POST', `/fleet/assignments/${ID}/end`, {}],
  ['POST', '/fleet/contracts/SZL-2026-00001/renewal-request', { notes: 'Lütfen arayın' }],
  ['GET', '/fleet/reports?from=2026-09&to=2026-10'],
  ['GET', '/fleet/green?from=2026-08&to=2026-10'],
  ['GET', '/fleet/vehicles/34-ABC-123/charging-stations?limit=5'],
  ['GET', '/fleet/requests'],
  ['GET', '/fleet/requests/TLP-2026-00001'],
  ['POST', '/fleet/requests', { type: 'ROADSIDE', fleetVehicleId: ID, details: { incident: 'TIRE', location: { address: 'Gizli Sokak 7' } } }],
  ['POST', '/fleet/requests/TLP-2026-00001/cancel', {}],
  ['GET', '/fleet/expenses'],
  ['GET', `/fleet/expenses/${ID}`],
  ['PATCH', `/fleet/expenses/${ID}`, { updatedAt: '2026-10-31T10:00:00.000Z', status: 'DISPUTED' }],
  ['POST', '/fleet/expenses/reflect', { ids: [ID] }],
];

describe('the fleet panel over HTTP (V2-35)', () => {
  let app: INestApplication;
  let base = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [FakePrismaModule, AuthModule, RateLimitModule, AdminModule, FleetModule] })
      .overrideProvider(FleetSummaryService)
      .useValue({ get: answer })
      .overrideProvider(FleetVehiclesService)
      .useValue(stub(['list', 'get']))
      .overrideProvider(FleetContractsService)
      .useValue(stub(['list', 'get', 'requestRenewal']))
      .overrideProvider(FleetRequestsService)
      .useValue({ ...stub(['list', 'get', 'cancel']), create: async () => ({ number: 'TLP-2026-00001' }) })
      .overrideProvider(FleetGreenService)
      .useValue(stub(['green', 'stations']))
      .overrideProvider(FleetReportsService)
      .useValue(stub(['get']))
      .overrideProvider(FleetExpensesService)
      .useValue(stub(['list', 'get', 'setStatus', 'reflect']))
      .overrideProvider(FleetEmployeesService)
      .useValue(stub(['list', 'get', 'create', 'update']))
      .overrideProvider(FleetInvoicesService)
      .useValue(stub(['list', 'get']))
      .overrideProvider(FleetAssignmentsService)
      .useValue(stub(['list', 'create', 'end']))
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
  const freshAddress = () => `10.30.${Math.floor(counter / 250)}.${(counter += 1) % 250}`;
  const call = (method: string, path: string, options: { body?: unknown; cookie?: string; address?: string } = {}) =>
    fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': options.address ?? freshAddress(),
        ...(options.cookie ? { Cookie: options.cookie } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

  // A signed-in person: registers (an individual account), then is made what the test needs, the way the database would have it.
  async function signedIn(kind: 'individual' | 'corporate' | 'corporate-without-company' | 'admin') {
    const address = freshAddress();
    const response = await call('POST', '/auth/register', {
      address,
      body: { email: `kisi${counter}@example.com`, password: 'long-enough-1', firstName: 'Ece', lastName: 'Aydın', consent: true },
    });
    const cookie = (response.headers.get('set-cookie') ?? '').split(';')[0]!;
    const user = fake.users.at(-1)!;
    if (kind === 'corporate' || kind === 'corporate-without-company') user.accountType = 'CORPORATE';
    if (kind === 'corporate') user.companyId = COMPANY;
    if (kind === 'admin') user.role = 'ADMIN';
    return { cookie, address, id: user.id as string };
  }

  it('no session is 401 UNAUTHENTICATED on every route', async () => {
    for (const [method, path, body] of ROUTES) {
      const response = await call(method, path, { body });
      expect([method, path, response.status]).toEqual([method, path, 401]);
      expect((await response.json()).code).toBe('UNAUTHENTICATED');
    }
  });

  it('an individual account, an administrator and a corporate account with no company are 403 FORBIDDEN on every route', async () => {
    for (const kind of ['individual', 'admin', 'corporate-without-company'] as const) {
      const { cookie } = await signedIn(kind);
      for (const [method, path, body] of ROUTES) {
        const response = await call(method, path, { cookie, body });
        expect([kind, method, path, response.status]).toEqual([kind, method, path, 403]);
        expect((await response.json()).code).toBe('FORBIDDEN');
      }
    }
    expect(fake.auditLogs).toHaveLength(0);
  });

  it('the door does not depend on the case of the path', async () => {
    const { cookie } = await signedIn('individual');
    for (const path of ['/fleet/summary', '/FLEET/summary', '/Fleet/Vehicles']) {
      expect([path, (await call('GET', path, { cookie })).status]).toEqual([path, 403]);
      expect([path, (await call('GET', path)).status]).toEqual([path, 401]);
    }
  });

  it('a corporate account of a company gets in on every route', async () => {
    const { cookie } = await signedIn('corporate');
    for (const [method, path, body] of ROUTES) {
      const response = await call(method, path, { cookie, body });
      expect([method, path, response.status]).toEqual([method, path, method === 'POST' && !path.endsWith('/end') && !path.endsWith('/reflect') && !path.endsWith('/cancel') ? 201 : 200]);
    }
  });

  it('what is changed is in the audit log: the account is the actor, the company is on the line, and only the field names are written', async () => {
    const { cookie, id } = await signedIn('corporate');
    for (const [method, path, body] of ROUTES) await call(method, path, { cookie, body });

    expect(fake.auditLogs).toHaveLength(9);
    expect(fake.auditLogs[0]).toMatchObject({ actorId: id, companyId: COMPANY, action: 'fleet-employee.create', entity: 'employee', entityId: ID, fields: ['firstName', 'lastName', 'email'] });
    expect(fake.auditLogs[1]).toMatchObject({ actorId: id, companyId: COMPANY, action: 'fleet-employee.update', entityId: ID, fields: ['updatedAt', 'department'] });
    expect(fake.auditLogs[2]).toMatchObject({ actorId: id, companyId: COMPANY, action: 'fleet-assignment.create', entity: 'assignment', entityId: ID, fields: ['fleetVehicleId', 'employeeId', 'note'] });
    expect(fake.auditLogs[3]).toMatchObject({ actorId: id, companyId: COMPANY, action: 'fleet-assignment.end', entityId: ID, fields: [] });
    expect(fake.auditLogs[4]).toMatchObject({ actorId: id, companyId: COMPANY, action: 'fleet-contract.renewal-request', entity: 'contract', entityId: 'SZL-2026-00001', fields: ['notes'] });
    expect(fake.auditLogs[5]).toMatchObject({ actorId: id, companyId: COMPANY, action: 'fleet-request.create', entity: 'request', entityId: 'TLP-2026-00001', fields: ['type', 'fleetVehicleId', 'details'] });
    expect(fake.auditLogs[6]).toMatchObject({ actorId: id, companyId: COMPANY, action: 'fleet-request.cancel', entity: 'request', entityId: 'TLP-2026-00001', fields: [] });
    expect(fake.auditLogs[7]).toMatchObject({ actorId: id, companyId: COMPANY, action: 'fleet-expense.update', entity: 'expense', entityId: ID, fields: ['updatedAt', 'status'] });
    expect(fake.auditLogs[8]).toMatchObject({ actorId: id, companyId: COMPANY, action: 'fleet-expense.reflect', entity: 'expense', entityId: null, fields: ['ids'] });
    const written = JSON.stringify(fake.auditLogs);
    for (const secret of ['ada@example.test', 'Ada', 'Kaya', 'Satış', 'Lütfen arayın', 'Gizli Sokak']) expect(written).not.toContain(secret);
  });

  it('a company may make 20 service requests an hour, whichever of its accounts makes them; the 21st is 429', async () => {
    const first = await signedIn('corporate');
    const second = await signedIn('corporate');
    // Their own company, so what the other tests in this file have already made does not count against it.
    const SHARED = '5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e99';
    for (const account of [first, second]) fake.users.find((user) => user.id === account.id)!.companyId = SHARED;
    const make = (cookie: string) => call('POST', '/fleet/requests', { cookie, body: { type: 'ROADSIDE', fleetVehicleId: ID, details: {} } });
    for (let index = 0; index < 12; index += 1) expect((await make(first.cookie)).status).toBe(201);
    for (let index = 0; index < 8; index += 1) expect((await make(second.cookie)).status).toBe(201);
    const refused = await make(first.cookie);
    expect(refused.status).toBe(429);
    expect((await refused.json()).code).toBe('RATE_LIMITED');
    expect(refused.headers.get('retry-after')).toBeTruthy();
    // Only making them is limited: looking at them is not.
    expect((await call('GET', '/fleet/requests', { cookie: first.cookie })).status).toBe(200);
  });

  it('counts the account, not the address, and refuses the 121st request in a minute with 429', async () => {
    const { cookie } = await signedIn('corporate');
    let last = 0;
    for (let index = 0; index < 121; index += 1) last = (await call('GET', '/fleet/summary', { cookie })).status;
    expect(last).toBe(429);
  });

  it('a body that is not JSON is 415, and an input that is not right is turned away before the database', async () => {
    const { cookie } = await signedIn('corporate');
    const response = await fetch(base + '/fleet/employees', { method: 'POST', headers: { 'Content-Type': 'text/plain', Cookie: cookie, 'X-Forwarded-For': freshAddress() }, body: 'name=x' });
    expect(response.status).toBe(415);
  });
});
