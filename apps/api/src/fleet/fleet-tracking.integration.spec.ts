import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { AdminContractsService } from '../admin/contracts/contracts.service.js';
import { testPlate } from '../common/plate.testing.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FleetTrackingService } from './fleet-tracking.service.js';
import { sliceOf } from './simulation/slice.js';
import { chooseRoute, trackDay, type RoutePoint } from './simulation/tracking.js';

// The live tracking against a real PostgreSQL (TEST_DATABASE_URL), like the other integration tests; skipped without one (V2-43). What the
// issue names is here: the simulation gives the same answer for the same car and the same five minutes, the ignition is off outside the
// working hours, and a car of another company is a 404. Who may call the endpoints at all (401, 403) is in fleet.http.spec.ts.
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

// A Friday at 11:07 Istanbul, and the same Friday at 22:30 and the Saturday at noon.
const FRIDAY_MORNING = new Date('2026-10-30T08:07:00.000Z');
const FRIDAY_NIGHT = new Date('2026-10-30T19:30:00.000Z');
const SATURDAY_NOON = new Date('2026-10-31T09:00:00.000Z');

describeDb('the live tracking against the database (V2-43)', () => {
  let prisma: PrismaService;
  let admin: AdminContractsService;
  let tracking: FleetTrackingService;
  const run = randomUUID().slice(0, 8);
  // Real cities (a contract is delivered to one of the known ones) that the seed has no routes for, so only the test's own routes are in them.
  const CITY = 'Bolu';
  const NO_ROUTE_CITY = 'Edirne';
  const ids = { classId: '', productSlug: `v43-urun-${run}`, productId: '', modelId: '', modelSlug: `v43-model-${run}` };
  const A = { id: '', contract: '', cars: [] as Array<{ id: string; plate: string }>, noRoute: { id: '', plate: '' }, given: { id: '', plate: '' } };
  const B = { id: '', contract: '', car: { id: '', plate: '' } };
  const NONE = { id: '' };
  const NO_ROUTE = { companyId: '' };
  const employee = { id: '', first: 'Deniz', last: `Test${run}` };
  const routeIds: string[] = [];
  const ROUTES = [
    { name: `A ${run}`, points: [{ latitude: 40, longitude: 30 }, { latitude: 40.02, longitude: 30.03 }, { latitude: 40.05, longitude: 30.04 }] },
    { name: `B ${run}`, points: [{ latitude: 40.1, longitude: 30.1 }, { latitude: 40.12, longitude: 30.0 }, { latitude: 40.15, longitude: 30.02 }] },
  ];

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    admin = new AdminContractsService(prisma);
    tracking = new FleetTrackingService(prisma);

    ids.classId = (await prisma.vehicleClass.create({ data: { slug: `v43-sinif-${run}`, nameTr: 'T', nameEn: 'T' } })).id;
    ids.modelId = (
      await prisma.vehicleModel.create({
        data: { slug: ids.modelSlug, brand: 'Filom', model: `T${run}`, seats: 5, bags: 3, transmission: 'AUTOMATIC', fuelType: 'PETROL', consumption: 5.5, consumptionUnit: 'L_PER_100KM', dailyPrice: 100000, description: { tr: 'Test', en: 'Test' }, classId: ids.classId },
      })
    ).id;
    ids.productId = (await prisma.product.create({ data: { slug: ids.productSlug } })).id;
    for (const route of ROUTES) routeIds.push((await prisma.trackingRoute.create({ data: { city: CITY, name: route.name, points: route.points } })).id);

    const car = async (contract: string) => {
      const plate = testPlate();
      const made = await admin.createVehicle(contract, { modelSlug: ids.modelSlug, plate, year: 2025, startKm: 1_000 });
      return { id: made.id, plate };
    };
    const company = async (label: string, city: string) => {
      const row = await prisma.company.create({ data: { name: `V43 ${label} ${run}` } });
      const contract = (await admin.create(row.id, { productSlug: ids.productSlug, startAt: '2026-01-01', endAt: '2027-12-31', monthlyFee: 3_000_000, deliveryCity: city })).number;
      return { id: row.id, contract };
    };
    Object.assign(A, await company('A', CITY));
    A.cars = [await car(A.contract), await car(A.contract), await car(A.contract), await car(A.contract)];
    A.given = await car(A.contract);
    await admin.updateVehicle(A.given.id, { updatedAt: (await prisma.fleetVehicle.findUniqueOrThrow({ where: { id: A.given.id } })).updatedAt.toISOString(), returned: true });
    const other = await company('A yolsuz', NO_ROUTE_CITY);
    A.noRoute = await car(other.contract);
    // The car with no route is a second company's, so that every car of the first one is on a route.
    NO_ROUTE.companyId = other.id;
    Object.assign(B, await company('B', CITY));
    B.car = await car(B.contract);
    NONE.id = (await prisma.company.create({ data: { name: `V43 Bos ${run}` } })).id;

    employee.id = (await prisma.companyEmployee.create({ data: { companyId: A.id, firstName: employee.first, lastName: employee.last } })).id;
    await prisma.vehicleAssignment.create({ data: { companyId: A.id, fleetVehicleId: A.cars[0]!.id, employeeId: employee.id, startedAt: new Date('2026-10-01T06:00:00Z') } });
  });

  afterAll(async () => {
    const companyIds = [A.id, B.id, NONE.id, NO_ROUTE.companyId].filter(Boolean);
    await prisma.vehicleAssignment.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.companyEmployee.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.trackingRoute.deleteMany({ where: { id: { in: routeIds } } });
    await prisma.fleetVehicle.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.fleetContract.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
    await prisma.product.deleteMany({ where: { id: ids.productId } });
    await prisma.vehicleModel.deleteMany({ where: { id: ids.modelId } });
    await prisma.vehicleClass.deleteMany({ where: { id: ids.classId } });
    await prisma.$disconnect();
  });

  describe('GET /fleet/tracking', () => {
    it('lists the cars of the company in use, by plate, with a position on a route of their city, never a car given back or another company’s', async () => {
      const list = await tracking.tracking(A.id, FRIDAY_MORNING);
      expect(list.simulated).toBe(true);
      expect(list.items.map((item) => item.plate)).toEqual(A.cars.map((c) => c.plate).sort());
      for (const item of list.items) {
        expect(item.city).toBe(CITY);
        expect(item.position).not.toBeNull();
        expect(item.ignition).toBe(true);
        expect(item.speedKmh).toBeGreaterThanOrEqual(0);
      }
      expect(list.items.some((item) => item.plate === A.given.plate || item.plate === B.car.plate)).toBe(false);
    });

    it('says who has each car, by name, and nobody for the others', async () => {
      const list = await tracking.tracking(A.id, FRIDAY_MORNING);
      const first = list.items.find((item) => item.plate === A.cars[0]!.plate)!;
      expect(first.employee).toEqual({ id: employee.id, name: `${employee.first} ${employee.last}` });
      expect(list.items.filter((item) => item.employee === null)).toHaveLength(3);
    });

    it('gives the same answer for the same cars and the same five minutes, and moves them in the next', async () => {
      const again = await tracking.tracking(A.id, new Date(FRIDAY_MORNING.getTime() + 60_000));
      const first = await tracking.tracking(A.id, FRIDAY_MORNING);
      // A minute later is the same five minutes unless the slice turns over; 11:07 and 11:08 are both in 11:05.
      expect(sliceOf(FRIDAY_MORNING)).toBe(sliceOf(new Date(FRIDAY_MORNING.getTime() + 60_000)));
      expect(again).toEqual(first);
      const later = await tracking.tracking(A.id, new Date(FRIDAY_MORNING.getTime() + 10 * 60_000));
      expect(later.updatedAt).not.toBe(first.updatedAt);
      expect(later.items.map((item) => item.position)).not.toEqual(first.items.map((item) => item.position));
    });

    it('is the position of the pure simulation on the route the car is given', async () => {
      const list = await tracking.tracking(A.id, FRIDAY_MORNING);
      const car = A.cars[0]!;
      const route = chooseRoute(car.id, ROUTES)!;
      const sample = trackDay(car.id, route.points as RoutePoint[], '2026-10-30')[sliceSlot(FRIDAY_MORNING)]!;
      const item = list.items.find((entry) => entry.plate === car.plate)!;
      expect(item.position).toEqual({ latitude: sample.latitude, longitude: sample.longitude });
      expect(item.speedKmh).toBe(sample.speedKmh);
    });

    it('has the ignition off and the speed zero at night and at the weekend, the car standing', async () => {
      for (const moment of [FRIDAY_NIGHT, SATURDAY_NOON]) {
        const list = await tracking.tracking(A.id, moment);
        expect(list.items.every((item) => !item.ignition && item.speedKmh === 0 && item.position !== null)).toBe(true);
      }
      const saturday = await tracking.tracking(A.id, SATURDAY_NOON);
      const night = await tracking.tracking(A.id, FRIDAY_NIGHT);
      expect(saturday.items.map((item) => item.position)).toEqual(night.items.map((item) => item.position));
    });

    it('lists a car of a city with no route without a position', async () => {
      const list = await tracking.tracking(NO_ROUTE.companyId, FRIDAY_MORNING);
      expect(list.items).toHaveLength(1);
      expect(list.items[0]).toMatchObject({ plate: A.noRoute.plate, position: null, speedKmh: 0, ignition: true });
    });

    it('a company with no car has an empty list, and another company sees its own cars only', async () => {
      expect((await tracking.tracking(NONE.id, FRIDAY_MORNING)).items).toEqual([]);
      const other = await tracking.tracking(B.id, FRIDAY_MORNING);
      expect(other.items.map((item) => item.plate)).toEqual([B.car.plate]);
    });
  });

  describe('GET /fleet/vehicles/{plate}/route', () => {
    it('gives every five minutes of a day that is over, in order, with the position the list gave at that moment', async () => {
      const car = A.cars[0]!;
      const day = await tracking.route(A.id, car.plate, { date: '2026-10-30' }, SATURDAY_NOON);
      expect(day).toMatchObject({ simulated: true, date: '2026-10-30', vehicle: { plate: car.plate, city: CITY } });
      expect(day.points).toHaveLength(288);
      expect(day.points[0]!.at).toBe('2026-10-29T21:00:00.000Z');
      const ats = day.points.map((point) => point.at);
      expect([...ats].sort()).toEqual(ats);
      const listed = (await tracking.tracking(A.id, FRIDAY_MORNING)).items.find((item) => item.plate === car.plate)!;
      const then = day.points[sliceSlot(FRIDAY_MORNING)]!;
      expect({ latitude: then.latitude, longitude: then.longitude }).toEqual(listed.position);
    });

    it('today is only up to now', async () => {
      const car = A.cars[0]!;
      const day = await tracking.route(A.id, car.plate, {}, FRIDAY_MORNING);
      expect(day.date).toBe('2026-10-30');
      expect(day.points).toHaveLength(sliceSlot(FRIDAY_MORNING) + 1);
    });

    it('takes the plate with spaces and any case', async () => {
      const car = A.cars[0]!;
      const spaced = car.plate.replace(/^(\d{2})(\D+)(\d+)$/, '$1 $2 $3').toLowerCase();
      expect((await tracking.route(A.id, spaced, { date: '2026-10-30' }, SATURDAY_NOON)).vehicle.plate).toBe(car.plate);
    });

    it('a city with no route gives a car with no points', async () => {
      const day = await tracking.route(NO_ROUTE.companyId, A.noRoute.plate, { date: '2026-10-30' }, SATURDAY_NOON);
      expect(day.points).toEqual([]);
      expect(day.vehicle.route).toBeNull();
    });

    it('refuses a day later than today, one before the last seven, and one that is not a day, each with its code', async () => {
      const car = A.cars[0]!;
      for (const date of ['2026-11-01', '2026-10-24']) {
        const result = await refused(tracking.route(A.id, car.plate, { date }, SATURDAY_NOON));
        expect(result.status).toBe(422);
        expect(JSON.stringify(result.body)).toContain('OUT_OF_RANGE');
      }
      // Seven days: today (31st) and the six before it, so the 25th is the oldest.
      await expect(tracking.route(A.id, car.plate, { date: '2026-10-25' }, SATURDAY_NOON)).resolves.toBeDefined();
      for (const date of ['2026-02-30', 'dün', '30.10.2026']) {
        const result = await refused(tracking.route(A.id, car.plate, { date }, SATURDAY_NOON));
        expect(result.status).toBe(422);
        expect(JSON.stringify(result.body)).toContain('INVALID_FORMAT');
      }
    });

    it('another company’s car, one given back, one that does not exist and a plate that cannot be one are the same 404', async () => {
      const results = await Promise.all(
        [B.car.plate, A.given.plate, testPlate(), '!!'].map(async (plate) => refused(tracking.route(A.id, plate, { date: '2026-10-30' }, SATURDAY_NOON))),
      );
      for (const result of results) expect(result.status).toBe(404);
      expect(new Set(results.map((result) => JSON.stringify(result.body))).size).toBe(1);
    });
  });
});

const sliceSlot = (at: Date): number => Math.floor((at.getTime() - new Date('2026-10-29T21:00:00.000Z').getTime()) / 300_000);
