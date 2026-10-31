import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { AdminContractsService } from '../admin/contracts/contracts.service.js';
import { AdminFleetExpensesService } from '../admin/fleet-expenses/fleet-expenses.service.js';
import { AdminQuotesService } from '../admin/quotes/quotes.service.js';
import type { UserRow } from '../auth/user-view.js';
import { testPlate } from '../common/plate.testing.js';
import { QuotesService } from '../forms/quotes.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FleetContractsService } from './fleet-contracts.service.js';
import { FleetExpensesService } from './fleet-expenses.service.js';
import { FleetSummaryService } from './fleet-summary.service.js';

// The expenses of the fleets against a real PostgreSQL (TEST_DATABASE_URL), like the other integration tests; skipped without one
// (V2-38). Two companies, A and B. The person of an expense is the one who had the car at that moment, worked out when it is read; what
// is asked for A never finds B's and says "not found" like a record that is not there (ADR-25). Who may call the endpoints at all (401,
// 403) is in fleet.http.spec.ts and admin.http.spec.ts.
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !/test/i.test(databaseUrl)) {
  throw new Error('TEST_DATABASE_URL must point at a database with "test" in its name.');
}
const describeDb = databaseUrl ? describe : describe.skip;

async function refused(promise: Promise<unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return { status: error.getStatus(), body: error.getResponse() as Record<string, unknown> };
    throw error;
  }
  throw new Error('expected the call to be refused');
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describeDb('the expenses of the fleets against the database (V2-38)', () => {
  let prisma: PrismaService;
  let admin: AdminContractsService;
  let adminExpenses: AdminFleetExpensesService;
  let adminQuotes: AdminQuotesService;
  let expenses: FleetExpensesService;
  let contracts: FleetContractsService;
  let summary: FleetSummaryService;
  const run = randomUUID().slice(0, 8);
  const ids = { classId: '', modelId: '', modelSlug: `v38e-model-${run}`, productSlug: `v38e-urun-${run}`, productId: '' };
  type Side = { id: string; contract: string; cars: Array<{ id: string; plate: string }>; ayse: string; burak: string; user: UserRow };
  const A = { id: '', contract: '', cars: [], ayse: '', burak: '', user: undefined as unknown as UserRow } satisfies Side as Side;
  const B = { id: '', contract: '', cars: [], ayse: '', burak: '', user: undefined as unknown as UserRow } satisfies Side as Side;
  const day = (offset: number) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
  const ago = (ms: number) => new Date(Date.now() - ms);
  // The moment the first car of A changed hands: ten days ago.
  const HANDOVER = Date.now() - 10 * DAY;

  async function setUp(side: Side, name: string, cars: number) {
    side.id = (await prisma.company.create({ data: { name: `V38E ${name} ${run}`, phone: '+90 232 000 00 00' } })).id;
    side.contract = (await admin.create(side.id, { productSlug: ids.productSlug, startAt: day(-200), endAt: day(165), monthlyFee: 3_000_000, deliveryCity: 'İzmir' })).number;
    for (let index = 0; index < cars; index += 1) {
      const plate = testPlate();
      const car = await admin.createVehicle(side.contract, { modelSlug: ids.modelSlug, plate, year: 2025, startKm: 100 * (index + 1) });
      side.cars.push({ id: car.id, plate });
    }
    side.ayse = (await prisma.companyEmployee.create({ data: { companyId: side.id, firstName: 'Ayşe', lastName: `Demir${name}`, department: 'Satış' } })).id;
    side.burak = (await prisma.companyEmployee.create({ data: { companyId: side.id, firstName: 'Burak', lastName: `Yılmaz${name}`, department: 'Operasyon' } })).id;
    const row = await prisma.user.create({
      data: { email: `v38e-${name.toLowerCase()}-${run}@example.test`, firstName: 'Mert', lastName: 'Kaya', accountType: 'CORPORATE', companyId: side.id },
    });
    side.user = { id: row.id, email: row.email, firstName: row.firstName, lastName: row.lastName, companyId: side.id } as unknown as UserRow;
  }

  // Ayşe had the first car from 30 days ago until the handover; Burak has it since. The second car has never been given to anybody.
  async function handOver(side: Side) {
    const car = side.cars[0]!;
    await prisma.vehicleAssignment.create({ data: { companyId: side.id, fleetVehicleId: car.id, employeeId: side.ayse, startedAt: ago(30 * DAY), endedAt: new Date(HANDOVER) } });
    await prisma.vehicleAssignment.create({ data: { companyId: side.id, fleetVehicleId: car.id, employeeId: side.burak, startedAt: new Date(HANDOVER) } });
  }

  const make = (side: Side, car: number, at: Date, extra: Record<string, unknown> = {}) =>
    prisma.fleetExpense.create({ data: { companyId: side.id, fleetVehicleId: side.cars[car]!.id, type: 'HGS', occurredAt: at, amount: 8550, ...extra } });

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    admin = new AdminContractsService(prisma);
    adminExpenses = new AdminFleetExpensesService(prisma);
    adminQuotes = new AdminQuotesService(prisma);
    expenses = new FleetExpensesService(prisma);
    contracts = new FleetContractsService(prisma, new QuotesService(prisma));
    summary = new FleetSummaryService(prisma);

    ids.classId = (await prisma.vehicleClass.create({ data: { slug: `v38e-sinif-${run}`, nameTr: 'T', nameEn: 'T' } })).id;
    ids.modelId = (
      await prisma.vehicleModel.create({
        data: { slug: ids.modelSlug, brand: 'Filom', model: `Masraf${run}`, seats: 5, bags: 3, transmission: 'AUTOMATIC', fuelType: 'PETROL', consumption: 5.5, consumptionUnit: 'L_PER_100KM', dailyPrice: 100000, description: { tr: 'Test', en: 'Test' }, classId: ids.classId },
      })
    ).id;
    ids.productId = (await prisma.product.create({ data: { slug: ids.productSlug } })).id;
    await setUp(A, 'A', 3);
    await setUp(B, 'B', 2);
    await handOver(A);
    await handOver(B);
  });

  afterEach(async () => {
    await prisma.fleetExpense.deleteMany({ where: { companyId: { in: [A.id, B.id] } } });
    await prisma.quoteRequest.deleteMany({ where: { userId: { in: [A.user.id, B.user.id] } } });
  });

  afterAll(async () => {
    const companyIds = [A.id, B.id];
    await prisma.quoteRequest.deleteMany({ where: { userId: { in: [A.user.id, B.user.id] } } });
    await prisma.fleetExpense.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.vehicleAssignment.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.fleetVehicle.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.fleetContract.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.companyEmployee.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.user.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
    await prisma.product.deleteMany({ where: { id: ids.productId } });
    await prisma.vehicleModel.deleteMany({ where: { id: ids.modelId } });
    await prisma.vehicleClass.deleteMany({ where: { id: ids.classId } });
    await prisma.$disconnect();
  });

  describe('who an expense belongs to', () => {
    it('the expenses on either side of the handover go to the person who had the car then; the moment of it goes to the one who took it', async () => {
      const before = await make(A, 0, new Date(HANDOVER - HOUR));
      const at = await make(A, 0, new Date(HANDOVER));
      const after = await make(A, 0, new Date(HANDOVER + HOUR));
      const early = await make(A, 0, ago(40 * DAY));
      const never = await make(A, 1, ago(5 * DAY));

      const byId = new Map((await expenses.list(A.id, { pageSize: '100' })).items.map((item) => [item.id, item.employee]));
      expect(byId.get(before.id)).toMatchObject({ id: A.ayse, name: expect.stringContaining('Ayşe') });
      expect(byId.get(at.id)).toMatchObject({ id: A.burak });
      expect(byId.get(after.id)).toMatchObject({ id: A.burak, department: 'Operasyon' });
      // Before the first assignment, and on a car nobody has had: nobody.
      expect(byId.get(early.id)).toBeNull();
      expect(byId.get(never.id)).toBeNull();
    });

    it('is worked out when it is read: when the assignment is corrected, the expense follows, and nothing about the person is stored', async () => {
      const row = await make(A, 0, new Date(HANDOVER - HOUR));
      expect(Object.keys(row)).not.toContain('employeeId');
      expect((await expenses.get(A.id, row.id)).employee?.id).toBe(A.ayse);
      // The handover is moved to before the expense: the car was Burak's already.
      await prisma.vehicleAssignment.updateMany({ where: { fleetVehicleId: A.cars[0]!.id, employeeId: A.ayse }, data: { endedAt: new Date(HANDOVER - 2 * HOUR) } });
      await prisma.vehicleAssignment.updateMany({ where: { fleetVehicleId: A.cars[0]!.id, employeeId: A.burak }, data: { startedAt: new Date(HANDOVER - 2 * HOUR) } });
      try {
        expect((await expenses.get(A.id, row.id)).employee?.id).toBe(A.burak);
      } finally {
        await prisma.vehicleAssignment.updateMany({ where: { fleetVehicleId: A.cars[0]!.id, employeeId: A.ayse }, data: { endedAt: new Date(HANDOVER) } });
        await prisma.vehicleAssignment.updateMany({ where: { fleetVehicleId: A.cars[0]!.id, employeeId: A.burak }, data: { startedAt: new Date(HANDOVER) } });
      }
    });
  });

  describe('the list', () => {
    it('is the company’s own only, newest first, and narrows by type, state, car, person and day', async () => {
      const hgs = await make(A, 0, new Date(HANDOVER - 2 * DAY));
      const penalty = await make(A, 0, new Date(HANDOVER + 2 * DAY), { type: 'PENALTY', amount: 119_000, status: 'DISPUTED' });
      const nobody = await make(A, 1, ago(3 * DAY), { type: 'MAINTENANCE', amount: 250_000 });
      await make(B, 0, ago(1 * DAY));

      const all = await expenses.list(A.id, {});
      expect(all.total).toBe(3);
      expect(all.items.map((item) => item.id)).toEqual([nobody.id, penalty.id, hgs.id]);
      expect(all.items.every((item) => item.company.id === A.id)).toBe(true);

      expect((await expenses.list(A.id, { type: 'PENALTY' })).items.map((item) => item.id)).toEqual([penalty.id]);
      expect((await expenses.list(A.id, { status: 'DISPUTED' })).items.map((item) => item.id)).toEqual([penalty.id]);
      expect((await expenses.list(A.id, { vehicle: A.cars[1]!.id })).items.map((item) => item.id)).toEqual([nobody.id]);
      expect((await expenses.list(A.id, { employee: A.ayse })).items.map((item) => item.id)).toEqual([hgs.id]);
      expect((await expenses.list(A.id, { employee: A.burak })).items.map((item) => item.id)).toEqual([penalty.id]);
      expect((await expenses.list(A.id, { employee: 'none' })).items.map((item) => item.id)).toEqual([nobody.id]);
      // A person of the other company is no person of this one.
      expect((await expenses.list(A.id, { employee: B.ayse })).total).toBe(0);
      expect((await expenses.list(A.id, { sort: 'amount:desc' })).items.map((item) => item.id)).toEqual([nobody.id, penalty.id, hgs.id]);
    });

    it('takes the days from and to as Istanbul days, both included', async () => {
      const istanbulNoon = (offset: number) => new Date(`${day(offset)}T09:00:00.000Z`);
      const a = await make(A, 0, istanbulNoon(-3));
      const b = await make(A, 0, istanbulNoon(-2));
      const c = await make(A, 0, istanbulNoon(-1));
      expect((await expenses.list(A.id, { from: day(-2), to: day(-2) })).items.map((item) => item.id)).toEqual([b.id]);
      expect((await expenses.list(A.id, { from: day(-3), to: day(-2) })).items.map((item) => item.id).sort()).toEqual([a.id, b.id].sort());
      expect((await expenses.list(A.id, { from: day(-1) })).items.map((item) => item.id)).toEqual([c.id]);
    });

    it('pages without repeating or skipping one, even when expenses share a moment', async () => {
      const at = ago(2 * DAY);
      for (let index = 0; index < 5; index += 1) await make(A, 0, at);
      const first = await expenses.list(A.id, { pageSize: '3', page: '1' });
      const second = await expenses.list(A.id, { pageSize: '3', page: '2' });
      expect(first.total).toBe(5);
      expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(5);
    });

    it('is 422 for a list asked for in a way that makes no sense', async () => {
      for (const query of [{ sort: 'place:asc' }, { type: 'TAX' }, { status: 'PAID' }, { vehicle: 'x' }, { employee: 'x' }, { from: '2026-02-30' }, { pageSize: '101' }]) {
        expect((await refused(expenses.list(A.id, query))).status).toBe(422);
      }
    });
  });

  describe('another company’s expense is a 404', () => {
    it('cannot be opened, changed or reflected through the other company, and the answer is the one for an expense that is not there', async () => {
      const theirs = await make(B, 0, ago(3 * DAY));
      const gone = randomUUID();
      const version = theirs.updatedAt.toISOString();
      const calls = [
        expenses.get(A.id, theirs.id),
        expenses.setStatus(A.id, theirs.id, { updatedAt: version, status: 'DISPUTED' }),
        expenses.reflect(A.id, { ids: [theirs.id] }),
      ];
      const answers = await Promise.all(calls.map((call) => refused(call)));
      const nothing = await refused(expenses.get(A.id, gone));
      for (const answer of answers) expect(answer).toEqual(nothing);
      expect(nothing.status).toBe(404);
      expect((await refused(expenses.get(A.id, 'not-an-id'))).status).toBe(404);
      // Nothing of theirs changed, and the list shows nothing of theirs.
      expect((await prisma.fleetExpense.findUniqueOrThrow({ where: { id: theirs.id } })).status).toBe('OPEN');
      expect((await expenses.list(A.id, {})).total).toBe(0);
      expect((await expenses.list(B.id, {})).total).toBe(1);
    });
  });

  describe('the state of an expense', () => {
    it('open can be disputed and the dispute taken back; asking for the state it is in changes nothing', async () => {
      const row = await make(A, 0, ago(2 * DAY));
      const disputed = await expenses.setStatus(A.id, row.id, { updatedAt: row.updatedAt.toISOString(), status: 'DISPUTED' });
      expect(disputed.status).toBe('DISPUTED');
      const same = await expenses.setStatus(A.id, row.id, { updatedAt: disputed.updatedAt, status: 'DISPUTED' });
      expect(same.updatedAt).toBe(disputed.updatedAt);
      expect((await expenses.setStatus(A.id, row.id, { updatedAt: disputed.updatedAt, status: 'OPEN' })).status).toBe('OPEN');
    });

    it('open becomes reflected when somebody had the car; it is then final', async () => {
      const row = await make(A, 0, ago(2 * DAY));
      const reflected = await expenses.setStatus(A.id, row.id, { updatedAt: row.updatedAt.toISOString(), status: 'REFLECTED' });
      expect(reflected).toMatchObject({ status: 'REFLECTED', employee: { id: A.burak } });
      for (const status of ['OPEN', 'DISPUTED']) {
        const answer = await refused(expenses.setStatus(A.id, row.id, { updatedAt: reflected.updatedAt, status }));
        expect([status, answer.status, answer.body.code]).toEqual([status, 409, 'INVALID_TRANSITION']);
      }
    });

    it('is not reflected to nobody, and a dispute is not reflected without being taken back first', async () => {
      const nobody = await make(A, 1, ago(2 * DAY));
      const answer = await refused(expenses.setStatus(A.id, nobody.id, { updatedAt: nobody.updatedAt.toISOString(), status: 'REFLECTED' }));
      expect([answer.status, answer.body.code]).toEqual([409, 'INVALID_TRANSITION']);
      const disputed = await make(A, 0, ago(2 * DAY), { status: 'DISPUTED' });
      expect((await refused(expenses.setStatus(A.id, disputed.id, { updatedAt: disputed.updatedAt.toISOString(), status: 'REFLECTED' }))).body.code).toBe('INVALID_TRANSITION');
    });

    it('an edit made against an older copy is refused with STALE_WRITE and writes nothing', async () => {
      const row = await make(A, 0, ago(2 * DAY));
      const old = row.updatedAt.toISOString();
      await expenses.setStatus(A.id, row.id, { updatedAt: old, status: 'DISPUTED' });
      const answer = await refused(expenses.setStatus(A.id, row.id, { updatedAt: old, status: 'REFLECTED' }));
      expect([answer.status, answer.body.code]).toEqual([409, 'STALE_WRITE']);
      expect((await prisma.fleetExpense.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('DISPUTED');
    });

    it('needs the version and a state that exists', async () => {
      const row = await make(A, 0, ago(2 * DAY));
      const answer = await refused(expenses.setStatus(A.id, row.id, { status: 'PAID' }));
      expect(answer.status).toBe(422);
      expect(answer.body.fieldErrors).toEqual({ updatedAt: 'REQUIRED', status: 'INVALID_FORMAT' });
    });
  });

  describe('reflecting many at once', () => {
    it('changes only the open ones that had a person, and says what it left and why', async () => {
      const open = await make(A, 0, ago(2 * DAY));
      const earlier = await make(A, 0, new Date(HANDOVER - DAY));
      const disputed = await make(A, 0, ago(3 * DAY), { status: 'DISPUTED' });
      const done = await make(A, 0, ago(4 * DAY), { status: 'REFLECTED' });
      const nobody = await make(A, 1, ago(2 * DAY));

      const result = await expenses.reflect(A.id, { ids: [open.id, earlier.id, disputed.id, done.id, nobody.id] });
      expect(result.reflected).toBe(2);
      expect([...result.skipped].sort((x, y) => x.id.localeCompare(y.id))).toEqual(
        [
          { id: disputed.id, reason: 'NOT_OPEN' },
          { id: done.id, reason: 'NOT_OPEN' },
          { id: nobody.id, reason: 'NO_ASSIGNEE' },
        ].sort((x, y) => x.id.localeCompare(y.id)),
      );
      const states = new Map((await prisma.fleetExpense.findMany({ where: { companyId: A.id } })).map((row) => [row.id, row.status]));
      expect([states.get(open.id), states.get(earlier.id)]).toEqual(['REFLECTED', 'REFLECTED']);
      expect(states.get(disputed.id)).toBe('DISPUTED');
      expect(states.get(nobody.id)).toBe('OPEN');
    });

    it('an id that is another company’s or does not exist refuses the whole call: nothing changes, and the two cannot be told apart', async () => {
      const mine = await make(A, 0, ago(2 * DAY));
      const theirs = await make(B, 0, ago(2 * DAY));
      const foreign = await refused(expenses.reflect(A.id, { ids: [mine.id, theirs.id] }));
      const missing = await refused(expenses.reflect(A.id, { ids: [mine.id, randomUUID()] }));
      expect(foreign.status).toBe(404);
      expect(foreign.body).toEqual(missing.body);
      expect((await prisma.fleetExpense.findUniqueOrThrow({ where: { id: mine.id } })).status).toBe('OPEN');
      expect((await prisma.fleetExpense.findUniqueOrThrow({ where: { id: theirs.id } })).status).toBe('OPEN');
    });

    it('a repeated id counts once, and an empty, too long or malformed list is 422', async () => {
      const mine = await make(A, 0, ago(2 * DAY));
      expect(await expenses.reflect(A.id, { ids: [mine.id, mine.id] })).toEqual({ reflected: 1, skipped: [] });
      for (const ids of [[], undefined, 'x', ['x'], Array.from({ length: 101 }, () => randomUUID())]) {
        expect([ids, (await refused(expenses.reflect(A.id, { ids }))).status]).toEqual([ids, 422]);
      }
    });

    it('two calls at the same moment reflect each expense once', async () => {
      const rows = await Promise.all(Array.from({ length: 4 }, () => make(A, 0, ago(2 * DAY))));
      const ids = rows.map((row) => row.id);
      const [one, two] = await Promise.all([expenses.reflect(A.id, { ids }), expenses.reflect(A.id, { ids })]);
      expect(one.reflected + two.reflected).toBe(4);
      expect(await prisma.fleetExpense.count({ where: { companyId: A.id, status: 'REFLECTED' } })).toBe(4);
    });
  });

  describe('the administration', () => {
    it('enters an expense by the plate; the car’s company is the expense’s, and the person comes from the assignments', async () => {
      const made = await adminExpenses.create({ plate: B.cars[0]!.plate.replace(/ /g, '').toLowerCase(), type: 'HGS', occurredAt: new Date(HANDOVER + HOUR).toISOString(), amount: 8550, place: 'Avrasya Tüneli', description: 'Geçiş' });
      expect(made).toMatchObject({ company: { id: B.id }, vehicle: { plate: B.cars[0]!.plate }, status: 'OPEN', amount: 8550, place: 'Avrasya Tüneli', employee: { id: B.burak } });
      expect((await expenses.list(B.id, {})).total).toBe(1);
      expect((await expenses.list(A.id, {})).total).toBe(0);
      expect((await adminExpenses.get(made.id)).id).toBe(made.id);
    });

    it('a plate that is no fleet car, a day in the future and an amount of nothing are field problems', async () => {
      const body = { type: 'HGS', occurredAt: day(-1), amount: 100 };
      const unknown = await refused(adminExpenses.create({ ...body, plate: testPlate() }));
      expect([unknown.status, unknown.body.fieldErrors]).toEqual([422, { plate: 'UNKNOWN_REFERENCE' }]);
      const future = await refused(adminExpenses.create({ ...body, plate: A.cars[0]!.plate, occurredAt: new Date(Date.now() + 2 * DAY).toISOString() }));
      expect(future.body.fieldErrors).toEqual({ occurredAt: 'OUT_OF_RANGE' });
      expect((await refused(adminExpenses.create({ ...body, plate: A.cars[0]!.plate, amount: 0 }))).body.fieldErrors).toEqual({ amount: 'OUT_OF_RANGE' });
      expect(await prisma.fleetExpense.count({ where: { companyId: { in: [A.id, B.id] } } })).toBe(0);
    });

    it('the database refuses an amount of nothing even if the service were bypassed', async () => {
      await expect(make(A, 0, ago(DAY), { amount: 0 })).rejects.toThrow();
      await expect(make(A, 0, ago(DAY), { amount: -1 })).rejects.toThrow();
    });

    it('lists across the companies, by company, by a part of the plate, and by state', async () => {
      const a = await make(A, 0, ago(2 * DAY));
      const b = await make(B, 1, ago(1 * DAY), { status: 'DISPUTED' });
      const everything = await adminExpenses.list({ pageSize: '100' });
      expect(everything.items.map((item) => item.id)).toEqual(expect.arrayContaining([a.id, b.id]));
      expect((await adminExpenses.list({ company: A.id })).items.map((item) => item.id)).toEqual([a.id]);
      expect((await adminExpenses.list({ q: B.cars[1]!.plate.slice(3, 6).toLowerCase() })).items.map((item) => item.id)).toContain(b.id);
      expect((await adminExpenses.list({ company: B.id, status: 'DISPUTED' })).items.map((item) => item.id)).toEqual([b.id]);
    });

    it('corrects an open or disputed expense; a reflected one is final, and an old copy is refused', async () => {
      const row = await make(A, 0, ago(2 * DAY));
      const fixed = await adminExpenses.update(row.id, { updatedAt: row.updatedAt.toISOString(), amount: 9000, place: '' });
      expect(fixed).toMatchObject({ amount: 9000, place: null });
      const stale = await refused(adminExpenses.update(row.id, { updatedAt: row.updatedAt.toISOString(), amount: 1 }));
      expect([stale.status, stale.body.code]).toEqual([409, 'STALE_WRITE']);
      const reflected = await expenses.setStatus(A.id, row.id, { updatedAt: fixed.updatedAt, status: 'REFLECTED' });
      const final = await refused(adminExpenses.update(row.id, { updatedAt: reflected.updatedAt, amount: 1 }));
      expect([final.status, final.body.code]).toEqual([409, 'INVALID_TRANSITION']);
      expect((await prisma.fleetExpense.findUniqueOrThrow({ where: { id: row.id } })).amount).toBe(9000);
      expect((await refused(adminExpenses.update(randomUUID(), { updatedAt: row.updatedAt.toISOString() }))).status).toBe(404);
    });
  });

  describe('the summary', () => {
    it('counts the open expenses of the company and their total, and nobody else’s', async () => {
      await make(A, 0, ago(DAY), { amount: 1000 });
      await make(A, 0, ago(DAY), { amount: 2500 });
      await make(A, 0, ago(DAY), { amount: 99_999, status: 'DISPUTED' });
      await make(B, 0, ago(DAY), { amount: 777 });
      expect((await summary.get(A.id)).expenses).toEqual({ open: { count: 2, total: 3500 } });
      expect((await summary.get(B.id)).expenses).toEqual({ open: { count: 1, total: 777 } });
    });
  });

  describe('the renewal request', () => {
    it('opens a quote request with the product and the number of cars, marked as a renewal, and the administration finds it among the quotes', async () => {
      const made = await contracts.requestRenewal(A.user, A.id, A.contract.toLowerCase(), {});
      expect(made).toMatchObject({ received: true, referenceNumber: expect.stringMatching(/^TKL-\d{4}-\d{5,}$/) });
      const row = await prisma.quoteRequest.findUniqueOrThrow({ where: { number: made.referenceNumber } });
      expect(row).toMatchObject({
        source: 'FLEET_RENEWAL',
        status: 'RECEIVED',
        productId: ids.productId,
        userId: A.user.id,
        companyName: `V38E A ${run}`,
        email: A.user.email,
        vehicleCount: 3,
        durationMonths: 12,
        phone: '+90 232 000 00 00',
      });
      expect(row.notes).toBe(`Renewal of contract ${A.contract}`);
      expect(row.vehicleType).toContain('Filom');
      const listed = await adminQuotes.list({ source: 'FLEET_RENEWAL', pageSize: '100' });
      expect(listed.items.some((item) => item.number === made.referenceNumber)).toBe(true);
    });

    it('takes a different number of cars and months and a word to the sales team', async () => {
      const made = await contracts.requestRenewal(A.user, A.id, A.contract, { vehicleCount: 8, durationMonths: 24, notes: 'Beş araç daha ekleyelim' });
      const row = await prisma.quoteRequest.findUniqueOrThrow({ where: { number: made.referenceNumber } });
      expect(row).toMatchObject({ vehicleCount: 8, durationMonths: 24 });
      expect(row.notes).toBe(`Renewal of contract ${A.contract}\nBeş araç daha ekleyelim`);
    });

    it('is not asked for twice while the first is being handled, and is asked for again once it is closed', async () => {
      const first = await contracts.requestRenewal(A.user, A.id, A.contract, {});
      const again = await refused(contracts.requestRenewal(A.user, A.id, A.contract, {}));
      expect([again.status, again.body.code]).toEqual([409, 'ALREADY_REQUESTED']);
      expect(await prisma.quoteRequest.count({ where: { userId: A.user.id } })).toBe(1);
      await prisma.quoteRequest.update({ where: { number: first.referenceNumber }, data: { status: 'CLOSED' } });
      expect((await contracts.requestRenewal(A.user, A.id, A.contract, {})).received).toBe(true);
    });

    it('another company’s contract, or a number that cannot be one, is 404 and opens nothing', async () => {
      for (const number of [B.contract, 'SZL-2026-99999', 'nope']) {
        expect([number, (await refused(contracts.requestRenewal(A.user, A.id, number, {}))).status]).toEqual([number, 404]);
      }
      expect(await prisma.quoteRequest.count({ where: { userId: { in: [A.user.id, B.user.id] } } })).toBe(0);
    });

    it('is 422 for input that makes no sense', async () => {
      for (const body of [{ vehicleCount: 0 }, { vehicleCount: 1.5 }, { durationMonths: 121 }, { notes: 'x'.repeat(501) }]) {
        expect([body, (await refused(contracts.requestRenewal(A.user, A.id, A.contract, body))).status]).toEqual([body, 422]);
      }
    });
  });
});
