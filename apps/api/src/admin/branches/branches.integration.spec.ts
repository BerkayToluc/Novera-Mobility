import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { lockOpenBranches } from '../../common/branch-lock.js';
import { CatalogService } from '../../catalog/catalog.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PricingService } from '../../reservations/pricing.service.js';
import { BranchesService } from './branches.service.js';
import { testPlate } from '../../common/plate.testing.js';

// The branch administration against a real PostgreSQL (TEST_DATABASE_URL), like the other integration tests; skipped without
// one. The test database is shared with suites that run at the same time and holds the seed branches, so every list is
// narrowed to this run's own branches by a word in their names (`run`).
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !/test/i.test(databaseUrl)) {
  throw new Error('TEST_DATABASE_URL must point at a database with "test" in its name.');
}
const describeDb = databaseUrl ? describe : describe.skip;

const DAY = 86_400_000;
const days = (count: number) => new Date(Date.now() + count * DAY);

// What an HttpException answered, to compare on without caring about its class.
async function refused(promise: Promise<unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return { status: error.getStatus(), body: error.getResponse() as Record<string, unknown> };
    throw error;
  }
  throw new Error('expected the call to be refused');
}

describeDb('branch administration against the database (V2-27)', () => {
  let prisma: PrismaService;
  let service: BranchesService;
  const run = randomUUID().slice(0, 8).toUpperCase();
  const created: string[] = [];
  const ids = { classId: '', modelId: '' };
  const vehicleIds: string[] = [];

  const body = (suffix: string, overrides: Record<string, unknown> = {}) => ({
    name: `Bayi ${run} ${suffix}`,
    city: 'Ankara',
    address: 'Kızılay Mahallesi, Çankaya',
    latitude: 39.9179,
    longitude: 32.8627,
    phone: '+90 312 555 00 00',
    email: `bayi-${suffix.toLowerCase()}-${run.toLowerCase()}@example.test`,
    kind: 'CITY',
    openingHours: { weekdays: '08:30-19:00', saturday: '09:00-17:00', sunday: 'closed' },
    ...overrides,
  });
  const make = async (suffix: string, overrides: Record<string, unknown> = {}) => {
    const view = await service.create(body(suffix, overrides));
    created.push(view.id);
    return view;
  };
  const book = (suffix: string, pickup: string, ret: string, startAt: Date, endAt: Date, status: 'CONFIRMED' | 'CANCELLED' = 'CONFIRMED') =>
    prisma.reservation.create({
      data: {
        number: `B27-${run}-${suffix}`,
        status,
        startAt,
        endAt,
        days: 1,
        vehicleDailyPrice: 100000,
        totalPrice: 100000,
        vehicleId: vehicleIds[0]!,
        pickupBranchId: pickup,
        returnBranchId: ret,
      },
    });

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    service = new BranchesService(prisma);

    ids.classId = (await prisma.vehicleClass.create({ data: { slug: `b27-sinif-${run}`, nameTr: 'T', nameEn: 'T' } })).id;
    ids.modelId = (
      await prisma.vehicleModel.create({
        data: {
          slug: `b27-model-${run.toLowerCase()}`,
          brand: 'Test',
          model: 'Model',
          seats: 5,
          bags: 3,
          transmission: 'AUTOMATIC',
          fuelType: 'PETROL',
          consumption: 5.5,
          consumptionUnit: 'L_PER_100KM',
          dailyPrice: 100000,
          description: { tr: 'Test', en: 'Test' },
          classId: ids.classId,
        },
      })
    ).id;
    // A branch that always stays open, with the one car the bookings of these tests use.
    const home = await make('EV');
    vehicleIds.push((await prisma.vehicle.create({ data: { plate: testPlate(), year: 2030, vehicleModelId: ids.modelId, branchId: home.id } })).id);
  });

  afterAll(async () => {
    await prisma.hold.deleteMany({ where: { OR: [{ pickupBranchId: { in: created } }, { returnBranchId: { in: created } }] } });
    await prisma.reservation.deleteMany({ where: { number: { startsWith: `B27-${run}` } } });
    await prisma.vehicle.deleteMany({ where: { OR: [{ id: { in: vehicleIds } }, { branchId: { in: created } }] } });
    await prisma.branch.deleteMany({ where: { id: { in: created } } });
    await prisma.vehicleModel.deleteMany({ where: { id: ids.modelId } });
    await prisma.vehicleClass.deleteMany({ where: { id: ids.classId } });
    await prisma.$disconnect();
  });

  describe('creating', () => {
    it('writes what was sent, open, with no cars, and the kind that was chosen', async () => {
      const view = await make('NEW', { kind: 'AIRPORT', email: `  Bayi-NEW-${run.toLowerCase()}@Example.TEST ` });
      expect(view).toMatchObject({
        name: `Bayi ${run} NEW`,
        city: 'Ankara',
        kind: 'AIRPORT',
        status: 'OPEN',
        closedAt: null,
        activeVehicles: 0,
        email: `bayi-new-${run.toLowerCase()}@example.test`,
        openingHours: { weekdays: '08:30-19:00', saturday: '09:00-17:00', sunday: 'closed' },
      });
      expect((await service.get(view.id)).usage).toEqual({ reservations: 0, holds: 0, vehicles: 0 });
    });

    it('refuses what is wrong with a code for each field', async () => {
      const bad = await refused(
        service.create(
          body('BAD', {
            city: 'Atlantis',
            // Latitude and longitude swapped (32.86 is not a latitude of Türkiye; 39.91 east happens to be a longitude of it),
            // and a longitude that is nowhere near.
            latitude: 32.86,
            longitude: 10,
            email: 'not-an-address',
            phone: 'abc',
            kind: 'HARBOUR',
            openingHours: { weekdays: '19:00-08:30', saturday: '09:00-17:00', sunday: 'closed' },
          }),
        ),
      );
      expect(bad.status).toBe(422);
      expect(bad.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        fieldErrors: {
          city: 'INVALID_FORMAT',
          latitude: 'OUT_OF_RANGE',
          longitude: 'OUT_OF_RANGE',
          email: 'INVALID_EMAIL',
          phone: 'INVALID_FORMAT',
          kind: 'INVALID_FORMAT',
          openingHours: 'INVALID_FORMAT',
        },
      });
      expect(await prisma.branch.count({ where: { name: `Bayi ${run} BAD` } })).toBe(0);
    });

    it('asks for every field of a new branch', async () => {
      const empty = await refused(service.create({}));
      expect(Object.keys(empty.body.fieldErrors as object).sort()).toEqual(
        ['address', 'city', 'email', 'kind', 'latitude', 'longitude', 'name', 'openingHours', 'phone'],
      );
    });

    it('a day of hours has to be whole: all three days, each valid', async () => {
      const partial = await refused(service.create(body('H', { openingHours: { weekdays: '08:30-19:00', saturday: '09:00-17:00' } })));
      expect(partial.body).toMatchObject({ fieldErrors: { openingHours: 'INVALID_FORMAT' } });
    });
  });

  describe('listing', () => {
    beforeAll(async () => {
      await make('LA', { name: `Bayi ${run} İzmir Kadıköy`, city: 'İzmir' });
      await make('LB', { name: `Bayi ${run} Antalya`, city: 'Antalya', kind: 'AIRPORT' });
      const closing = await make('LC', { name: `Bayi ${run} Çorum`, city: 'Çorum' });
      await service.close(closing.id);
    });
    const mine = (query: Record<string, string> = {}) => service.list({ q: run, ...query });

    it('lists this run’s branches with their state, in name order', async () => {
      const page = await mine({ sort: 'name:asc' });
      const names = page.items.map((item) => item.name.replace(`Bayi ${run} `, ''));
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'tr')));
      expect(page.items.find((item) => item.name.endsWith('Çorum'))?.status).toBe('CLOSED');
      expect(page.items.find((item) => item.name.endsWith('Antalya'))?.status).toBe('OPEN');
    });

    it('narrows by city and by state', async () => {
      expect((await mine({ city: 'İzmir' })).items.map((item) => item.city)).toEqual(['İzmir']);
      expect((await mine({ status: 'CLOSED' })).items.map((item) => item.city)).toEqual(['Çorum']);
      const open = await mine({ status: 'OPEN' });
      expect(open.items.every((item) => item.status === 'OPEN')).toBe(true);
      expect(open.items.length).toBeGreaterThanOrEqual(3);
    });

    it('searches the name, city and address without caring about case or Turkish letters', async () => {
      expect((await service.list({ q: `${run} izmir kadikoy` })).items.map((item) => item.city)).toEqual(['İzmir']);
      expect((await service.list({ q: `${run} CORUM` })).items.map((item) => item.city)).toEqual(['Çorum']);
      expect((await service.list({ q: 'kizilay' })).total).toBeGreaterThanOrEqual(3);
    });

    it('pages with a total that does not change', async () => {
      const all = await mine({ sort: 'name:asc' });
      const first = await mine({ sort: 'name:asc', pageSize: '2', page: '1' });
      expect(first).toMatchObject({ total: all.total, page: 1, pageSize: 2 });
      expect(first.items.map((item) => item.id)).toEqual(all.items.slice(0, 2).map((item) => item.id));
      expect((await mine({ page: '99' })).items).toEqual([]);
    });

    it('counts the cars that are switched on', async () => {
      const home = (await mine({ q: `${run} EV` })).items[0]!;
      expect(home.activeVehicles).toBe(1);
    });
  });

  describe('changing', () => {
    it('changes only what is sent and moves the version on', async () => {
      const view = await make('CH');
      const changed = await service.update(view.id, { updatedAt: view.updatedAt, phone: '+90 312 555 11 22', openingHours: { weekdays: '09:00-18:00', saturday: 'closed', sunday: 'closed' } });
      expect(changed).toMatchObject({ phone: '+90 312 555 11 22', name: view.name, city: 'Ankara', openingHours: { saturday: 'closed' } });
      expect(changed.updatedAt).not.toBe(view.updatedAt);
    });

    it('an edit made against an old version is 409 STALE_WRITE and writes nothing', async () => {
      const view = await make('ST');
      await service.update(view.id, { updatedAt: view.updatedAt, name: `Bayi ${run} ST ikinci` });
      const late = await refused(service.update(view.id, { updatedAt: view.updatedAt, name: `Bayi ${run} ST üçüncü` }));
      expect(late.status).toBe(409);
      expect(late.body.code).toBe('STALE_WRITE');
      expect((await service.get(view.id)).name).toBe(`Bayi ${run} ST ikinci`);
    });

    it('refuses a wrong value on a change as it does on a new branch', async () => {
      const view = await make('CV');
      const bad = await refused(service.update(view.id, { updatedAt: view.updatedAt, latitude: 10, city: 'Yok' }));
      expect(bad.body).toMatchObject({ fieldErrors: { latitude: 'OUT_OF_RANGE', city: 'INVALID_FORMAT' } });
    });

    it('a branch that does not exist, or an id that cannot be one, is 404', async () => {
      expect((await refused(service.get(randomUUID()))).status).toBe(404);
      expect((await refused(service.get('not-an-id'))).status).toBe(404);
      expect((await refused(service.update(randomUUID(), { updatedAt: new Date().toISOString() }))).status).toBe(404);
      expect((await refused(service.close(randomUUID()))).status).toBe(404);
      expect((await refused(service.reopen('x'))).status).toBe(404);
    });
  });

  describe('closing and opening again', () => {
    it('closes a branch that nothing depends on, and says so; closing again changes nothing', async () => {
      const view = await make('CL');
      const closed = await service.close(view.id);
      expect(closed).toMatchObject({ status: 'CLOSED' });
      expect(closed.closedAt).not.toBeNull();
      const again = await service.close(view.id);
      expect(again.closedAt).toBe(closed.closedAt);
    });

    it('is refused while a booking starts there in the future, with how many', async () => {
      const view = await make('R1');
      await book('R1', view.id, vehicleIdBranch(), days(5), days(6));
      const stay = await refused(service.close(view.id));
      expect(stay.status).toBe(409);
      expect(stay.body).toMatchObject({ code: 'IN_USE', details: { reservations: 1, holds: 0, vehicles: 0 } });
      // Nothing was changed by the refusal.
      expect(await service.get(view.id)).toMatchObject({ status: 'OPEN', closedAt: null, updatedAt: view.updatedAt });
    });

    it('is refused while a booking ends there in the future, even one already under way', async () => {
      const view = await make('R2');
      await book('R2', vehicleIdBranch(), view.id, days(-1), days(2));
      const stay = await refused(service.close(view.id));
      expect(stay.body).toMatchObject({ code: 'IN_USE', details: { reservations: 1 } });
    });

    it('past bookings and cancelled ones do not keep a branch open', async () => {
      const view = await make('R3');
      await book('R3A', view.id, view.id, days(-10), days(-9));
      await book('R3B', view.id, view.id, days(5), days(6), 'CANCELLED');
      expect((await service.close(view.id)).status).toBe('CLOSED');
    });

    it('is refused while a hold is running, and not by one that has run out', async () => {
      const held = await make('HD');
      await prisma.hold.create({ data: holdOf(held.id, new Date(Date.now() + 10 * 60_000)) });
      const stay = await refused(service.close(held.id));
      expect(stay.body).toMatchObject({ code: 'IN_USE', details: { holds: 1 } });

      const over = await make('HO');
      await prisma.hold.create({ data: holdOf(over.id, new Date(Date.now() - 60_000)) });
      expect((await service.close(over.id)).status).toBe('CLOSED');
    });

    it('is refused while a car that is switched on is there, and not by one that is switched off', async () => {
      const view = await make('VE');
      const car = await prisma.vehicle.create({ data: { plate: testPlate(), year: 2030, vehicleModelId: ids.modelId, branchId: view.id } });
      expect((await refused(service.close(view.id))).body).toMatchObject({ code: 'IN_USE', details: { vehicles: 1 } });
      expect((await service.get(view.id)).usage.vehicles).toBe(1);
      await prisma.vehicle.update({ where: { id: car.id }, data: { active: false } });
      expect((await service.close(view.id)).status).toBe('CLOSED');
    });

    it('says all the reasons at once', async () => {
      const view = await make('AL');
      await prisma.vehicle.create({ data: { plate: testPlate(), year: 2030, vehicleModelId: ids.modelId, branchId: view.id } });
      await prisma.hold.create({ data: holdOf(view.id, new Date(Date.now() + 10 * 60_000)) });
      await book('AL', view.id, view.id, days(3), days(4));
      expect((await refused(service.close(view.id))).body).toMatchObject({ details: { reservations: 1, holds: 1, vehicles: 1 } });
    });

    it('opens a closed branch again, and opening an open one changes nothing', async () => {
      const view = await make('OP');
      await service.close(view.id);
      const opened = await service.reopen(view.id);
      expect(opened).toMatchObject({ status: 'OPEN', closedAt: null });
      expect((await service.reopen(view.id)).updatedAt).toBe(opened.updatedAt);
    });

    it('a closed branch can still be corrected', async () => {
      const view = await make('CC');
      const closed = await service.close(view.id);
      const fixed = await service.update(view.id, { updatedAt: closed.updatedAt, address: 'Düzeltilmiş adres' });
      expect(fixed).toMatchObject({ status: 'CLOSED', address: 'Düzeltilmiş adres' });
    });
  });

  describe('what the site sees', () => {
    it('a closed branch is not in the public list, an open one is, with its kind; open it again and it is back', async () => {
      const catalog = new CatalogService(prisma);
      const open = await make('PU', { kind: 'AIRPORT' });
      const gone = await make('PG');
      await service.close(gone.id);

      const names = async () => (await catalog.getBranches()).filter((branch) => branch.name.includes(run));
      let listed = await names();
      expect(listed.find((branch) => branch.id === open.id)).toMatchObject({ kind: 'AIRPORT', name: open.name });
      expect(listed.find((branch) => branch.id === gone.id)).toBeUndefined();

      await service.reopen(gone.id);
      listed = await names();
      expect(listed.find((branch) => branch.id === gone.id)).toMatchObject({ kind: 'CITY' });
    });

    it('a booking cannot name a closed branch, as the pick-up or as the return', async () => {
      const open = await make('BO');
      const shut = await make('BS');
      await service.close(shut.id);
      const pricing = new PricingService(prisma);
      expect((await refused(pricing.assertBranchesExist({ pickupBranchId: open.id, returnBranchId: shut.id }))).body).toMatchObject({
        fieldErrors: { returnBranchId: 'UNKNOWN_REFERENCE' },
      });
      expect((await refused(pricing.assertBranchesExist({ pickupBranchId: shut.id, returnBranchId: open.id }))).body).toMatchObject({
        fieldErrors: { pickupBranchId: 'UNKNOWN_REFERENCE' },
      });
      await expect(pricing.assertBranchesExist({ pickupBranchId: open.id, returnBranchId: open.id })).resolves.toBeUndefined();
    });

    it('a past booking keeps the branch name even when the branch is closed', async () => {
      const view = await make('PB');
      const past = await book('PB', view.id, view.id, days(-10), days(-9));
      await service.close(view.id);
      const row = await prisma.reservation.findUniqueOrThrow({ where: { id: past.id }, include: { pickupBranch: true } });
      expect(row.pickupBranch.name).toBe(view.name);
    });
  });

  // A booking and a closing at the same moment take turns (common/branch-lock.ts): the booking holds the branch for sharing
  // until it is committed, and the closing, which takes it for update, waits.
  describe('against a booking made at the same moment', () => {
    it('a closing waits for the booking, then sees it and refuses', async () => {
      const view = await make('RC');
      const events: string[] = [];
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      let locked!: () => void;
      const lockTaken = new Promise<void>((resolve) => {
        locked = resolve;
      });
      const booking = prisma.$transaction(async (tx) => {
        await lockOpenBranches(tx, { pickupBranchId: view.id, returnBranchId: view.id });
        await tx.reservation.create({
          data: {
            number: `B27-${run}-RC`,
            startAt: days(7),
            endAt: days(8),
            days: 1,
            vehicleDailyPrice: 100000,
            totalPrice: 100000,
            vehicleId: vehicleIds[0]!,
            pickupBranchId: view.id,
            returnBranchId: view.id,
          },
        });
        events.push('booking made');
        locked();
        await held;
        events.push('booking commits');
      });
      await lockTaken;

      const closing = refused(service.close(view.id)).then((answer) => {
        events.push('closing answered');
        return answer;
      });
      await new Promise((resolve) => setTimeout(resolve, 400));
      expect(events).toEqual(['booking made']);

      release();
      await booking;
      const answer = await closing;
      expect(events).toEqual(['booking made', 'booking commits', 'closing answered']);
      expect(answer.body).toMatchObject({ code: 'IN_USE', details: { reservations: 1 } });
    });

    it('a booking that comes after the closing finds the branch closed', async () => {
      const view = await make('RD');
      await service.close(view.id);
      const late = await refused(
        prisma.$transaction((tx) => lockOpenBranches(tx, { pickupBranchId: view.id, returnBranchId: vehicleIdBranch() })),
      );
      expect(late.status).toBe(422);
      expect(late.body).toMatchObject({ fieldErrors: { pickupBranchId: 'UNKNOWN_REFERENCE' } });
    });
  });

  // The branch that always stays open and holds the car the bookings use.
  function vehicleIdBranch(): string {
    return created[0]!;
  }

  function holdOf(branchId: string, expiresAt: Date) {
    return {
      vehicleId: vehicleIds[0]!,
      pickupBranchId: branchId,
      returnBranchId: branchId,
      startAt: days(20),
      endAt: days(21),
      expiresAt,
      clientKey: `b27-${run}`,
    };
  }
});
