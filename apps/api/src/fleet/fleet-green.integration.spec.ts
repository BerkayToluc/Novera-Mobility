import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { AdminContractsService } from '../admin/contracts/contracts.service.js';
import { testPlate } from '../common/plate.testing.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FleetGreenService } from './fleet-green.service.js';
import { FleetSummaryService } from './fleet-summary.service.js';
import { sliceOf } from './simulation/slice.js';
import { stationStatus } from './simulation/stations.js';

// The Green Fleet data against a real PostgreSQL (TEST_DATABASE_URL), like the other integration tests; skipped without one (V2-40). The two
// things the issue names are here: the simulation gives the same answer for the same car and the same five minutes, and the carbon is the
// kilometres times the factors. Who may call the endpoints at all (401, 403) is in fleet.http.spec.ts.
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

const NOW = new Date('2026-10-31T10:07:00.000Z');
const at = (iso: string) => new Date(iso);

describeDb('the Green Fleet against the database (V2-40)', () => {
  let prisma: PrismaService;
  let admin: AdminContractsService;
  let green: FleetGreenService;
  let summary: FleetSummaryService;
  const run = randomUUID().slice(0, 8);
  const ids = { classId: '', productSlug: `v40g-urun-${run}`, productId: '', models: {} as Record<'ELECTRIC' | 'HYBRID' | 'PETROL', { id: string; slug: string }> };
  const A = { id: '', contract: '', ev: { id: '', plate: '' }, hybrid: { id: '', plate: '' }, petrol: { id: '', plate: '' } };
  const B = { id: '', contract: '', ev: { id: '', plate: '' } };
  const NONE = { id: '' };
  const OTHER_CITY = `V40Bolu${run}`;
  const stations: string[] = [];

  async function model(fuel: 'ELECTRIC' | 'HYBRID' | 'PETROL') {
    const slug = `v40g-${fuel.toLowerCase()}-${run}`;
    const row = await prisma.vehicleModel.create({
      data: { slug, brand: 'Filom', model: `${fuel}${run}`, seats: 5, bags: 3, transmission: 'AUTOMATIC', fuelType: fuel, consumption: 5.5, consumptionUnit: fuel === 'ELECTRIC' ? 'KWH_PER_100KM' : 'L_PER_100KM', dailyPrice: 100000, description: { tr: 'Test', en: 'Test' }, classId: ids.classId },
    });
    ids.models[fuel] = { id: row.id, slug };
  }

  const station = async (name: string, city: string, latitude: number, longitude: number) => {
    const row = await prisma.chargingStation.create({ data: { name: `${name} ${run}`, city, latitude, longitude, sockets: ['CCS', 'TYPE2'] } });
    stations.push(row.id);
    return row;
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    admin = new AdminContractsService(prisma);
    green = new FleetGreenService(prisma);
    summary = new FleetSummaryService(prisma);

    ids.classId = (await prisma.vehicleClass.create({ data: { slug: `v40g-sinif-${run}`, nameTr: 'T', nameEn: 'T' } })).id;
    for (const fuel of ['ELECTRIC', 'HYBRID', 'PETROL'] as const) await model(fuel);
    ids.productId = (await prisma.product.create({ data: { slug: ids.productSlug } })).id;

    const car = async (contract: string, fuel: 'ELECTRIC' | 'HYBRID' | 'PETROL', startKm: number) => {
      const plate = testPlate();
      const made = await admin.createVehicle(contract, { modelSlug: ids.models[fuel].slug, plate, year: 2025, startKm });
      return { id: made.id, plate };
    };
    A.id = (await prisma.company.create({ data: { name: `V40G A ${run}` } })).id;
    A.contract = (await admin.create(A.id, { productSlug: ids.productSlug, startAt: '2026-01-01', endAt: '2027-12-31', monthlyFee: 3_000_000, deliveryCity: 'Konya' })).number;
    A.ev = await car(A.contract, 'ELECTRIC', 1_000);
    A.hybrid = await car(A.contract, 'HYBRID', 5_000);
    A.petrol = await car(A.contract, 'PETROL', 9_000);
    B.id = (await prisma.company.create({ data: { name: `V40G B ${run}` } })).id;
    B.contract = (await admin.create(B.id, { productSlug: ids.productSlug, startAt: '2026-01-01', endAt: '2027-12-31', monthlyFee: 3_000_000, deliveryCity: 'Bolu' })).number;
    B.ev = await car(B.contract, 'ELECTRIC', 2_000);
    NONE.id = (await prisma.company.create({ data: { name: `V40G Bos ${run}` } })).id;

    // The electric car: charge and health written down in March, June, September and October; km 1,000 → 3,200 by the end of September, → 4,000 in October.
    const reading = (car: { id: string }, when: string, km: number, charge: number | null, health: number | null) => ({ fleetVehicleId: car.id, at: at(when), km, chargePercent: charge, batteryHealthPercent: health });
    await prisma.vehicleReading.createMany({
      data: [
        reading(A.ev, '2026-03-15T09:00:00Z', 1_200, 80, 99),
        reading(A.ev, '2026-06-15T09:00:00Z', 2_000, 55, 97),
        reading(A.ev, '2026-08-31T12:00:00Z', 3_000, 70, 96),
        reading(A.ev, '2026-09-30T12:00:00Z', 3_200, 40, 95),
        reading(A.ev, '2026-10-20T12:00:00Z', 4_000, 62, 94),
        reading(A.hybrid, '2026-08-31T12:00:00Z', 5_000, null, 98),
        reading(A.hybrid, '2026-10-20T12:00:00Z', 5_500, null, 97),
        reading(A.petrol, '2026-10-20T12:00:00Z', 9_900, null, null),
        reading(B.ev, '2026-10-20T12:00:00Z', 2_800, 33, 91),
      ],
    });

    // Three stations right at the centre of Konya, nearest first, and two in a city with no known centre.
    await station('Merkez', 'Konya', 37.8746, 32.4932);
    await station('Yakın', 'Konya', 37.8846, 32.4932);
    await station('Uzak', 'Konya', 37.9746, 32.4932);
    await station('Bolu Bir', OTHER_CITY, 40.7, 31.6);
    await station('Bolu Iki', OTHER_CITY, 40.8, 31.7);
  });

  afterAll(async () => {
    const companyIds = [A.id, B.id, NONE.id];
    const cars = await prisma.fleetVehicle.findMany({ where: { companyId: { in: companyIds } }, select: { id: true } });
    await prisma.vehicleReading.deleteMany({ where: { fleetVehicleId: { in: cars.map((c) => c.id) } } });
    await prisma.chargingStation.deleteMany({ where: { id: { in: stations } } });
    await prisma.fleetVehicle.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.fleetContract.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
    await prisma.product.deleteMany({ where: { id: ids.productId } });
    await prisma.vehicleModel.deleteMany({ where: { id: { in: Object.values(ids.models).map((m) => m.id) } } });
    await prisma.vehicleClass.deleteMany({ where: { id: ids.classId } });
    await prisma.$disconnect();
  });

  describe('the cars, their charge and battery, and the carbon', () => {
    it('lists only the electric and hybrid cars of the company, by plate, never the petrol one or another company’s', async () => {
      const report = await green.green(A.id, { from: '2026-10', to: '2026-10' }, NOW);
      expect(report.vehicles.map((v) => v.plate).sort()).toEqual([A.ev.plate, A.hybrid.plate].sort());
      expect(report.vehicles.map((v) => v.fuel).sort()).toEqual(['ELECTRIC', 'HYBRID']);
      expect(report.vehicles.some((v) => v.plate === B.ev.plate || v.plate === A.petrol.plate)).toBe(false);
    });

    it('the carbon is the kilometres of the period times the factors, car by car and in total', async () => {
      const report = await green.green(A.id, { from: '2026-10', to: '2026-10' }, NOW);
      const ev = report.vehicles.find((v) => v.plate === A.ev.plate)!;
      const hybrid = report.vehicles.find((v) => v.plate === A.hybrid.plate)!;
      // October: the electric car 3,200 → 4,000 = 800 km; the hybrid 5,000 → 5,500 = 500 km.
      expect(ev.km).toBe(800);
      expect(ev.savedGrams).toBe(800 * (170 - 45));
      expect(hybrid.km).toBe(500);
      expect(hybrid.savedGrams).toBe(500 * (170 - 105));
      expect(report.totals).toEqual({ km: 1_300, savedGrams: 800 * 125 + 500 * 65 });
      expect(report.coefficients).toEqual({ petrol: 170, hybrid: 105, electric: 45 });
    });

    it('a longer period adds the months up; the default is the last three months', async () => {
      const wide = await green.green(A.id, { from: '2026-08', to: '2026-10' }, NOW);
      expect(wide.vehicles.find((v) => v.plate === A.ev.plate)!.km).toBe(2_000);
      // The odometer at the end of July is June's reading (2,000) and at the end of October it is 4,000; the months in between add up to that.
      const byDefault = await green.green(A.id, {}, NOW);
      expect([byDefault.from, byDefault.to]).toEqual(['2026-08', '2026-10']);
    });

    it('the latest charge and health are the last written down, and the trend is the readings of the last six months, oldest first', async () => {
      const ev = (await green.green(A.id, {}, NOW)).vehicles.find((v) => v.plate === A.ev.plate)!;
      expect(ev.charge).toEqual({ percent: 62, at: '2026-10-20T12:00:00.000Z' });
      expect(ev.batteryHealth).toEqual({ percent: 94, at: '2026-10-20T12:00:00.000Z' });
      // March is older than six months before 31 October; June, August, September and October are not.
      expect(ev.batteryTrend.map((point) => point.percent)).toEqual([97, 96, 95, 94]);
      const hybrid = (await green.green(A.id, {}, NOW)).vehicles.find((v) => v.plate === A.hybrid.plate)!;
      expect(hybrid.charge).toBeNull();
      expect(hybrid.batteryHealth?.percent).toBe(97);
    });

    it('a company with no green car gets an empty list, and the summary counts the green cars', async () => {
      const empty = await green.green(NONE.id, {}, NOW);
      expect(empty.vehicles).toEqual([]);
      expect(empty.totals).toEqual({ km: 0, savedGrams: 0 });
      expect((await summary.get(A.id, NOW)).greenVehicles).toBe(2);
      expect((await summary.get(NONE.id, NOW)).greenVehicles).toBe(0);
    });

    it('is 422 for months that make no sense', async () => {
      for (const [query, fieldErrors] of [
        [{ from: '2026-13' }, { from: 'INVALID_FORMAT' }],
        [{ from: '2026-10', to: '2026-09' }, { from: 'OUT_OF_RANGE' }],
        [{ from: '2026-10', to: '2026-12' }, { to: 'OUT_OF_RANGE' }],
      ] as const) {
        const answer = await refused(green.green(A.id, query, NOW));
        expect([answer.status, answer.body.fieldErrors]).toEqual([422, fieldErrors]);
      }
    });
  });

  describe('the charging stations', () => {
    it('lists the nearest first, from the centre of the city the contract is delivered to, with a distance, a state and the simulation flag', async () => {
      const list = await green.stations(A.id, A.ev.plate, { limit: '3' }, NOW);
      expect(list.simulated).toBe(true);
      expect(list.vehicle).toMatchObject({ plate: A.ev.plate, city: 'Konya' });
      expect(list.items).toHaveLength(3);
      expect(list.items.map((item) => item.name.replace(` ${run}`, ''))).toEqual(expect.arrayContaining(['Merkez']));
      const distances = list.items.map((item) => item.distanceKm!);
      expect([...distances].sort((a, b) => a - b)).toEqual(distances);
      expect(list.items[0]!.name).toBe(`Merkez ${run}`);
      expect(list.items[0]!.distanceKm).toBe(0);
      for (const item of list.items) expect(['AVAILABLE', 'BUSY', 'OUT_OF_ORDER']).toContain(item.status);
    });

    it('the same car and the same five minutes give the same answer, and a state is the one the simulation says for that slice', async () => {
      const first = await green.stations(A.id, A.ev.plate, { limit: '10' }, NOW);
      const later = await green.stations(A.id, A.ev.plate, { limit: '10' }, new Date(NOW.getTime() + 2 * 60_000));
      expect(later).toEqual(first);
      expect(first.updatedAt).toBe('2026-10-31T10:05:00.000Z');
      for (const item of first.items) expect(item.status).toBe(stationStatus(item.id, sliceOf(NOW)));
      // Over a day the states of the stations do move.
      const states = new Set<string>();
      for (let step = 0; step < 288; step += 1) {
        const moment = new Date(NOW.getTime() + step * 5 * 60_000);
        for (const item of (await green.stations(A.id, A.ev.plate, { limit: '3' }, moment)).items) states.add(item.status);
      }
      expect(states.size).toBeGreaterThan(1);
    });

    it('takes the plate however it is typed, a hybrid car too, and a limit of 1 to 20 (5 when none is given)', async () => {
      expect((await green.stations(A.id, A.ev.plate.replace(/ /g, '').toLowerCase(), {}, NOW)).items.length).toBeLessThanOrEqual(5);
      expect((await green.stations(A.id, A.hybrid.plate, { limit: '1' }, NOW)).items).toHaveLength(1);
      for (const limit of ['0', '21', 'x', '-1']) {
        const answer = await refused(green.stations(A.id, A.ev.plate, { limit }, NOW));
        expect([limit, answer.status]).toEqual([limit, 422]);
      }
    });

    it('a car whose city has no known centre gets the stations without distances, those of its own city first', async () => {
      await prisma.fleetContract.update({ where: { number: B.contract }, data: { deliveryCity: OTHER_CITY } });
      const list = await green.stations(B.id, B.ev.plate, { limit: '2' }, NOW);
      expect(list.vehicle.position).toBeNull();
      expect(list.items.map((item) => item.city)).toEqual([OTHER_CITY, OTHER_CITY]);
      expect(list.items.every((item) => item.distanceKm === null)).toBe(true);
    });

    it('a car that was given back has no stations: the same 404', async () => {
      const gone = await admin.createVehicle(A.contract, { modelSlug: ids.models.ELECTRIC.slug, plate: testPlate(), year: 2025, startKm: 1 });
      await prisma.fleetVehicle.update({ where: { id: gone.id }, data: { status: 'RETURNED', returnedAt: NOW } });
      const plate = (await prisma.fleetVehicle.findUniqueOrThrow({ where: { id: gone.id } })).plate;
      expect((await refused(green.stations(A.id, plate, {}, NOW))).status).toBe(404);
      expect((await green.green(A.id, {}, NOW)).vehicles.some((v) => v.plate === plate)).toBe(false);
    });

    it('a petrol car, another company’s car and a plate that cannot be one are 404, the same as a car that is not there', async () => {
      const nothing = await refused(green.stations(A.id, testPlate(), {}, NOW));
      for (const plate of [A.petrol.plate, B.ev.plate, 'not-a-plate']) {
        const answer = await refused(green.stations(A.id, plate, {}, NOW));
        expect([plate, answer.status]).toEqual([plate, 404]);
        expect(answer.body.code).toBe(nothing.body.code);
      }
    });
  });
});
