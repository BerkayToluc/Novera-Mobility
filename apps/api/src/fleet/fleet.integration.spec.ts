import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { AdminContractsService } from '../admin/contracts/contracts.service.js';
import { AuthService } from '../auth/auth.service.js';
import { hashSessionToken, newSessionToken } from '../auth/session-token.js';
import { toUserResponse } from '../auth/user-view.js';
import { testPlate } from '../common/plate.testing.js';
import { QuotesService } from '../forms/quotes.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FleetAssignmentsService } from './fleet-assignments.service.js';
import { FleetContractsService } from './fleet-contracts.service.js';
import { FleetEmployeesService } from './fleet-employees.service.js';
import { FleetSummaryService } from './fleet-summary.service.js';
import { FleetVehiclesService } from './fleet-vehicles.service.js';

// The fleet panel's data against a real PostgreSQL (TEST_DATABASE_URL), like the other integration tests; skipped without one. Two
// companies, A and B, each with a contract, cars and people. What is asked for A never finds B's, and says "not found" like a record
// that is not there (ADR-25). Who may call the endpoints at all (401, 403) is in fleet.http.spec.ts.
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

describeDb('the fleet panel against the database (V2-35)', () => {
  let prisma: PrismaService;
  let admin: AdminContractsService;
  let vehicles: FleetVehiclesService;
  let contracts: FleetContractsService;
  let employees: FleetEmployeesService;
  let assignments: FleetAssignmentsService;
  let summary: FleetSummaryService;
  const run = randomUUID().slice(0, 8);
  const ids = { classId: '', modelId: '', modelSlug: `v35f-model-${run}`, productSlug: `v35f-urun-${run}`, productId: '' };
  const A = { id: '', contract: '', cars: [] as Array<{ id: string; plate: string }> };
  const B = { id: '', contract: '', cars: [] as Array<{ id: string; plate: string }> };
  const NONE = { id: '' };
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

  async function setUp(side: typeof A, name: string, cars: number, contractExtra: Record<string, unknown> = {}) {
    side.id = (await prisma.company.create({ data: { name: `V35F ${name} ${run}` } })).id;
    const made = await admin.create(side.id, { productSlug: ids.productSlug, startAt: day(-30), endAt: day(335), monthlyFee: 3_000_000, deliveryCity: 'İzmir', ...contractExtra });
    side.contract = made.number;
    for (let index = 0; index < cars; index += 1) {
      const plate = testPlate();
      const car = await admin.createVehicle(made.number, { modelSlug: ids.modelSlug, plate, year: 2025, startKm: 100 * (index + 1) });
      side.cars.push({ id: car.id, plate });
    }
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    admin = new AdminContractsService(prisma);
    vehicles = new FleetVehiclesService(prisma);
    contracts = new FleetContractsService(prisma, new QuotesService(prisma));
    employees = new FleetEmployeesService(prisma);
    assignments = new FleetAssignmentsService(prisma);
    summary = new FleetSummaryService(prisma);

    ids.classId = (await prisma.vehicleClass.create({ data: { slug: `v35f-sinif-${run}`, nameTr: 'T', nameEn: 'T' } })).id;
    ids.modelId = (
      await prisma.vehicleModel.create({
        data: { slug: ids.modelSlug, brand: 'Filom', model: `Deneme${run}`, seats: 5, bags: 3, transmission: 'AUTOMATIC', fuelType: 'PETROL', consumption: 5.5, consumptionUnit: 'L_PER_100KM', dailyPrice: 100000, description: { tr: 'Test', en: 'Test' }, classId: ids.classId },
      })
    ).id;
    ids.productId = (await prisma.product.create({ data: { slug: ids.productSlug } })).id;
    await setUp(A, 'A', 3, { endAt: day(40) });
    await setUp(B, 'B', 2);
    NONE.id = (await prisma.company.create({ data: { name: `V35F Bos ${run}` } })).id;
  });

  afterAll(async () => {
    const companyIds = [A.id, B.id, NONE.id];
    const cars = await prisma.fleetVehicle.findMany({ where: { companyId: { in: companyIds } }, select: { id: true } });
    await prisma.vehicleReading.deleteMany({ where: { fleetVehicleId: { in: cars.map((car) => car.id) } } });
    await prisma.vehicleAssignment.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.fleetVehicle.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.fleetContract.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.companyEmployee.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
    await prisma.product.deleteMany({ where: { id: ids.productId } });
    await prisma.vehicleModel.deleteMany({ where: { id: ids.modelId } });
    await prisma.vehicleClass.deleteMany({ where: { id: ids.classId } });
    await prisma.$disconnect();
  });

  describe('cars', () => {
    it('lists the company’s own cars only, and a company with no contract gets an empty list', async () => {
      const own = await vehicles.list(A.id, { pageSize: '100' });
      expect(own.total).toBe(3);
      expect(own.items.map((car) => car.plate).sort()).toEqual(A.cars.map((car) => car.plate).sort());
      expect((await vehicles.list(B.id, {})).total).toBe(2);
      expect(await vehicles.list(NONE.id, {})).toMatchObject({ total: 0, items: [] });
    });

    it('finds a car by its plate however it is typed, and by its model, and narrows by who has it', async () => {
      const car = A.cars[0]!;
      const typed = car.plate.replace(/ /g, '').toLowerCase();
      expect((await vehicles.list(A.id, { q: typed })).items.map((row) => row.plate)).toEqual([car.plate]);
      expect((await vehicles.list(A.id, { q: `filom deneme${run}` })).total).toBe(3);
      // B's cars are not found through A, whatever is typed.
      expect((await vehicles.list(A.id, { q: B.cars[0]!.plate })).total).toBe(0);
      expect((await vehicles.list(A.id, { assigned: 'true' })).total).toBe(0);
      expect((await vehicles.list(A.id, { assigned: 'false' })).total).toBe(3);
    });

    it('opens a car by plate, with its assignments and readings; another company’s car, or a plate that cannot be one, is 404', async () => {
      const car = A.cars[1]!;
      await admin.addReading(car.id, { km: 300, fuelPercent: 50 });
      const detail = await vehicles.get(A.id, car.plate.replace(/ /g, ''));
      expect(detail).toMatchObject({ plate: car.plate, lastKm: 300, assignee: null, assignments: [] });
      expect(detail.readings).toHaveLength(1);
      expect((await refused(vehicles.get(A.id, B.cars[0]!.plate))).status).toBe(404);
      expect((await refused(vehicles.get(A.id, 'not-a-plate'))).status).toBe(404);
      // The same plate is B's own to open.
      expect((await vehicles.get(B.id, B.cars[0]!.plate)).plate).toBe(B.cars[0]!.plate);
    });

    it('is 422 for a list asked for in a way that makes no sense', async () => {
      for (const query of [{ sort: 'startKm:asc' }, { status: 'GONE' }, { assigned: 'maybe' }, { contract: 'x' }, { pageSize: '101' }]) {
        expect((await refused(vehicles.list(A.id, query))).status).toBe(422);
      }
    });
  });

  describe('contracts and the summary', () => {
    it('lists and opens the company’s own contracts; another company’s is 404, a company with none gets an empty list', async () => {
      const list = await contracts.list(A.id, {});
      expect(list.items.map((row) => row.number)).toEqual([A.contract]);
      expect(list.items[0]).toMatchObject({ vehicleCount: 3, remainingDays: 40, monthlyFee: 3_000_000, status: 'ACTIVE' });
      const detail = await contracts.get(A.id, A.contract.toLowerCase());
      expect(detail.vehicles).toHaveLength(3);
      expect((await refused(contracts.get(A.id, B.contract))).status).toBe(404);
      expect((await refused(contracts.get(A.id, 'nope'))).status).toBe(404);
      expect((await contracts.list(NONE.id, {})).total).toBe(0);
    });

    it('counts the cars, who has them, the contracts that end soon and the cars due for maintenance', async () => {
      const first = A.cars[0]!;
      const detail = await admin.get(A.contract);
      const car = detail.vehicles.find((row) => row.id === first.id)!;
      await admin.updateVehicle(first.id, { updatedAt: car.updatedAt, nextMaintenanceOn: day(10) });
      const person = await employees.create(A.id, { firstName: 'Ada', lastName: 'Özet' });
      await assignments.create(A.id, { fleetVehicleId: first.id, employeeId: person.id });

      const a = await summary.get(A.id);
      expect(a).toMatchObject({ hasActiveContract: true, vehicles: { total: 3, assigned: 1, idle: 2 }, contracts: { active: 1, endingSoon: 1 }, maintenanceDue: 1 });
      const b = await summary.get(B.id);
      expect(b).toMatchObject({ vehicles: { total: 2, assigned: 0, idle: 2 }, contracts: { active: 1, endingSoon: 0 }, maintenanceDue: 0 });
      expect(await summary.get(NONE.id)).toMatchObject({ hasActiveContract: false, vehicles: { total: 0, assigned: 0, idle: 0 }, contracts: { active: 0, endingSoon: 0 }, maintenanceDue: 0 });
    });
  });

  describe('people', () => {
    it('makes a person, finds one by a word, and keeps the sicil no of a company to one person', async () => {
      const made = await employees.create(A.id, { firstName: 'Mert', lastName: `Kaya${run}`, department: 'Satış', employeeNo: 'S-1', email: 'Mert@Example.test', phone: '+90 532 555 01 01' });
      expect(made).toMatchObject({ firstName: 'Mert', department: 'Satış', employeeNo: 'S-1', email: 'mert@example.test', active: true, vehicle: null });
      expect((await employees.list(A.id, { q: `satış kaya${run}` })).items.map((row) => row.id)).toEqual([made.id]);
      expect((await refused(employees.create(A.id, { firstName: 'Başka', lastName: 'Kişi', employeeNo: 'S-1' }))).body).toMatchObject({ code: 'EMPLOYEE_NO_TAKEN' });
      // The same number in another company is another person's.
      expect((await employees.create(B.id, { firstName: 'Başka', lastName: 'Şirket', employeeNo: 'S-1' })).employeeNo).toBe('S-1');
      // Nothing is asked of a person who has no sicil no.
      await employees.create(A.id, { firstName: 'Sicilsiz', lastName: 'Bir' });
      await employees.create(A.id, { firstName: 'Sicilsiz', lastName: 'İki' });
    });

    it('is 422 for a person with no name, an address that is not one, or a list that makes no sense', async () => {
      expect((await refused(employees.create(A.id, {}))).body.fieldErrors).toEqual({ firstName: 'REQUIRED', lastName: 'REQUIRED' });
      expect((await refused(employees.create(A.id, { firstName: 'A', lastName: 'B', email: 'degil', phone: 'abc' }))).body.fieldErrors).toEqual({ email: 'INVALID_EMAIL', phone: 'INVALID_FORMAT' });
      expect((await refused(employees.list(A.id, { active: 'maybe' }))).status).toBe(422);
    });

    it('opens one person; another company’s person, or an id that cannot be one, is 404', async () => {
      const made = await employees.create(A.id, { firstName: 'Tek', lastName: 'Kişi', employeeNo: 'T-1' });
      expect(await employees.get(A.id, made.id)).toMatchObject({ id: made.id, firstName: 'Tek', employeeNo: 'T-1', active: true, vehicle: null });
      expect((await refused(employees.get(B.id, made.id))).status).toBe(404);
      expect((await refused(employees.get(A.id, 'not-an-id'))).status).toBe(404);
      expect((await refused(employees.get(A.id, randomUUID()))).status).toBe(404);
    });

    it('changes only what is sent, and an old copy is refused; another company’s person is 404 and is not changed', async () => {
      const made = await employees.create(A.id, { firstName: 'Değişen', lastName: 'Kişi', department: 'Eski' });
      const changed = await employees.update(A.id, made.id, { updatedAt: made.updatedAt, department: 'Yeni', phone: '' });
      expect(changed).toMatchObject({ department: 'Yeni', phone: null, firstName: 'Değişen' });
      expect((await refused(employees.update(A.id, made.id, { updatedAt: made.updatedAt, department: 'X' }))).body).toMatchObject({ code: 'STALE_WRITE' });
      expect((await refused(employees.update(B.id, made.id, { updatedAt: changed.updatedAt, department: 'Çalındı' }))).status).toBe(404);
      expect((await refused(employees.update(A.id, 'not-an-id', { updatedAt: changed.updatedAt }))).status).toBe(404);
      expect((await prisma.companyEmployee.findUniqueOrThrow({ where: { id: made.id } })).department).toBe('Yeni');
    });

    it('a person who is made inactive gives the car back at once, and cannot be given another', async () => {
      const car = A.cars[2]!;
      const person = await employees.create(A.id, { firstName: 'Ayrılan', lastName: 'Kişi' });
      await assignments.create(A.id, { fleetVehicleId: car.id, employeeId: person.id });
      expect((await employees.list(A.id, { q: 'ayrılan' })).items[0]!.vehicle).toEqual({ plate: car.plate });

      const left = await employees.update(A.id, person.id, { updatedAt: person.updatedAt, active: false });
      expect(left).toMatchObject({ active: false, vehicle: null });
      expect(await prisma.vehicleAssignment.count({ where: { fleetVehicleId: car.id, endedAt: null } })).toBe(0);
      expect((await refused(assignments.create(A.id, { fleetVehicleId: car.id, employeeId: person.id }))).body.fieldErrors).toEqual({ employeeId: 'NOT_ALLOWED' });
      expect((await employees.list(A.id, { q: 'ayrılan', active: 'true' })).total).toBe(0);
    });
  });

  describe('giving a car to a person', () => {
    it('gives it, shows it with the car and the person, and ends it; the history is kept', async () => {
      const car = B.cars[0]!;
      const person = await employees.create(B.id, { firstName: 'Zimmetli', lastName: 'Kişi', department: 'Satış' });
      const given = await assignments.create(B.id, { fleetVehicleId: car.id, employeeId: person.id, note: 'Teslim edildi', startedAt: new Date(Date.now() - 3_600_000).toISOString() });
      expect(given).toMatchObject({ vehicle: { plate: car.plate }, employee: { id: person.id, name: 'Zimmetli Kişi', department: 'Satış' }, endedAt: null, note: 'Teslim edildi' });
      expect((await vehicles.get(B.id, car.plate)).assignee).toMatchObject({ employeeId: person.id, name: 'Zimmetli Kişi' });
      expect((await assignments.list(B.id, { open: 'true' })).items.map((row) => row.id)).toContain(given.id);

      const ended = await assignments.end(B.id, given.id, undefined);
      expect(ended.endedAt).toEqual(expect.any(String));
      expect((await vehicles.get(B.id, car.plate)).assignee).toBeNull();
      expect((await vehicles.get(B.id, car.plate)).assignments.map((row) => row.id)).toEqual([given.id]);
      expect((await refused(assignments.end(B.id, given.id, {}))).body).toMatchObject({ code: 'INVALID_TRANSITION' });
    });

    it('a car that has someone is not given to a second person: 409 VEHICLE_ASSIGNED, and nothing is written', async () => {
      const car = B.cars[1]!;
      const one = await employees.create(B.id, { firstName: 'Birinci', lastName: 'Kişi' });
      const two = await employees.create(B.id, { firstName: 'İkinci', lastName: 'Kişi' });
      await assignments.create(B.id, { fleetVehicleId: car.id, employeeId: one.id });
      const answer = await refused(assignments.create(B.id, { fleetVehicleId: car.id, employeeId: two.id }));
      expect(answer).toMatchObject({ status: 409, body: { code: 'VEHICLE_ASSIGNED' } });
      expect(await prisma.vehicleAssignment.count({ where: { fleetVehicleId: car.id } })).toBe(1);
    });

    it('two given at the same moment: one gets the car, the other is told so', async () => {
      const car = A.cars[1]!;
      const people = await Promise.all([1, 2, 3, 4].map((n) => employees.create(A.id, { firstName: `Yarış${n}`, lastName: 'Kişi' })));
      const results = await Promise.allSettled(people.map((person) => assignments.create(A.id, { fleetVehicleId: car.id, employeeId: person.id })));
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      for (const result of results) {
        if (result.status === 'rejected') expect((result.reason as HttpException).getResponse()).toMatchObject({ code: 'VEHICLE_ASSIGNED' });
      }
      expect(await prisma.vehicleAssignment.count({ where: { fleetVehicleId: car.id, endedAt: null } })).toBe(1);
    });

    it('the database holds the rule too: a second open assignment, or one across two companies, is refused', async () => {
      const car = A.cars[0]!;
      const open = await prisma.vehicleAssignment.findFirstOrThrow({ where: { fleetVehicleId: car.id, endedAt: null } });
      const other = await prisma.companyEmployee.create({ data: { companyId: A.id, firstName: 'Doğrudan', lastName: 'Kişi' } });
      await expect(prisma.vehicleAssignment.create({ data: { companyId: A.id, fleetVehicleId: car.id, employeeId: other.id, startedAt: new Date() } })).rejects.toThrow();
      expect(open.endedAt).toBeNull();

      const foreign = await prisma.companyEmployee.create({ data: { companyId: B.id, firstName: 'Başka', lastName: 'Şirketin' } });
      const free = B.cars[1]!;
      await prisma.vehicleAssignment.deleteMany({ where: { fleetVehicleId: free.id } });
      await expect(prisma.vehicleAssignment.create({ data: { companyId: B.id, fleetVehicleId: free.id, employeeId: other.id, startedAt: new Date() } })).rejects.toThrow();
      await expect(prisma.vehicleAssignment.create({ data: { companyId: A.id, fleetVehicleId: A.cars[2]!.id, employeeId: foreign.id, startedAt: new Date() } })).rejects.toThrow();
    });

    it('another company’s car or person is the same answer as one that is not there; another company’s assignment is 404', async () => {
      const mine = await employees.create(A.id, { firstName: 'Kendi', lastName: 'Kişi' });
      const foreignCar = await refused(assignments.create(A.id, { fleetVehicleId: B.cars[0]!.id, employeeId: mine.id }));
      const missingCar = await refused(assignments.create(A.id, { fleetVehicleId: randomUUID(), employeeId: mine.id }));
      expect(foreignCar).toEqual(missingCar);
      expect(foreignCar.body.fieldErrors).toEqual({ fleetVehicleId: 'UNKNOWN_REFERENCE' });

      const foreignPerson = await employees.create(B.id, { firstName: 'Yabancı', lastName: 'Kişi' });
      const free = A.cars.find((car) => car.id !== A.cars[0]!.id && car.id !== A.cars[1]!.id)!;
      const answer = await refused(assignments.create(A.id, { fleetVehicleId: free.id, employeeId: foreignPerson.id }));
      expect(answer.body.fieldErrors).toEqual({ employeeId: 'UNKNOWN_REFERENCE' });

      // B gives a car to the person of its own, so there is an open assignment of B to reach for.
      await assignments.create(B.id, { fleetVehicleId: B.cars[1]!.id, employeeId: foreignPerson.id });
      const theirs = await assignments.list(B.id, { open: 'true' });
      expect(theirs.items.length).toBeGreaterThan(0);
      expect((await refused(assignments.end(A.id, theirs.items[0]!.id, {}))).status).toBe(404);
      expect((await assignments.list(A.id, { vehicle: B.cars[0]!.id })).total).toBe(0);
    });

    it('does not start in the future or before the last one ended, and does not give a car that has been given back', async () => {
      const car = B.cars[0]!;
      const person = await employees.create(B.id, { firstName: 'Tarih', lastName: 'Kişi' });
      expect((await refused(assignments.create(B.id, { fleetVehicleId: car.id, employeeId: person.id, startedAt: new Date(Date.now() + 3_600_000 * 5).toISOString() }))).body.fieldErrors).toEqual({ startedAt: 'OUT_OF_RANGE' });
      // The first assignment of this car ended a moment ago: a start before that overlaps it.
      expect((await refused(assignments.create(B.id, { fleetVehicleId: car.id, employeeId: person.id, startedAt: new Date(Date.now() - 86_400_000 * 5).toISOString() }))).body.fieldErrors).toEqual({ startedAt: 'OUT_OF_RANGE' });
      expect((await refused(assignments.create(B.id, { fleetVehicleId: car.id, employeeId: person.id, startedAt: 'yesterday' }))).body.fieldErrors).toEqual({ startedAt: 'INVALID_FORMAT' });

      const detail = await admin.get(B.contract);
      const target = detail.vehicles.find((row) => row.id === car.id)!;
      await admin.updateVehicle(car.id, { updatedAt: target.updatedAt, returned: true });
      expect((await refused(assignments.create(B.id, { fleetVehicleId: car.id, employeeId: person.id }))).body).toMatchObject({ code: 'INVALID_TRANSITION' });
    });
  });
  // The Filom link (V2-36): `GET /me` says whether the company has an active contract, so the profile shows the link only then.
  describe('who has a fleet', () => {
    it('says so for a corporate account whose company has an active contract, and for no other', async () => {
      const auth = new AuthService(prisma);
      const made: string[] = [];
      const hasFleet = async (word: string, companyId: string | null, accountType: 'CORPORATE' | 'INDIVIDUAL' = 'CORPORATE') => {
        const user = await prisma.user.create({ data: { email: `${word}-${run}@example.test`, passwordHash: 'x', firstName: 'Kişi', lastName: word, accountType, companyId } });
        made.push(user.id);
        const token = newSessionToken();
        await prisma.session.create({ data: { tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 86_400_000), userId: user.id } });
        const row = await auth.authenticate(token);
        return toUserResponse(row!).hasFleet;
      };
      try {
        expect(await hasFleet('var', A.id)).toBe(true);
        expect(await hasFleet('yok', NONE.id)).toBe(false);
        expect(await hasFleet('sirketsiz', null)).toBe(false);
        expect(await hasFleet('bireysel', A.id, 'INDIVIDUAL')).toBe(false);

        // A contract that has ended is no fleet: B has one contract, and it is ended once its cars are given back.
        const contract = await admin.get(B.contract);
        for (const car of contract.vehicles.filter((row) => row.status === 'ACTIVE')) await admin.updateVehicle(car.id, { updatedAt: car.updatedAt, returned: true });
        const fresh = await admin.get(B.contract);
        await admin.update(B.contract, { updatedAt: fresh.updatedAt, status: 'ENDED' });
        expect(await hasFleet('bitti', B.id)).toBe(false);
      } finally {
        await prisma.session.deleteMany({ where: { userId: { in: made } } });
        await prisma.user.deleteMany({ where: { id: { in: made } } });
      }
    });
  });
});
