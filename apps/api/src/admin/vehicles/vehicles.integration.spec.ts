import 'dotenv/config';
import { randomInt, randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { AvailabilityService } from '../../catalog/availability.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { VehiclesService } from './vehicles.service.js';

// The vehicle administration against a real PostgreSQL (TEST_DATABASE_URL), like the other integration tests; skipped without
// one. The test database is shared with suites that run at the same time and holds the seed cars, so every list is narrowed to
// this run's own branches.
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !/test/i.test(databaseUrl)) {
  throw new Error('TEST_DATABASE_URL must point at a database with "test" in its name.');
}
const describeDb = databaseUrl ? describe : describe.skip;

const DAY = 86_400_000;
const days = (count: number) => new Date(Date.now() + count * DAY);
const slotAt = (count: number) => {
  const moment = days(count);
  moment.setUTCMinutes(0, 0, 0);
  return moment.toISOString();
};

async function refused(promise: Promise<unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return { status: error.getStatus(), body: error.getResponse() as Record<string, unknown> };
    throw error;
  }
  throw new Error('expected the call to be refused');
}

describeDb('vehicle administration against the database (V2-30)', () => {
  let prisma: PrismaService;
  let service: VehiclesService;
  const run = randomUUID().slice(0, 8);
  const ids = { classId: '', modelSlug: `v30-${run}`, modelId: '', retiredSlug: `v30r-${run}`, retiredId: '', open: '', other: '', closed: '' };
  const usedPlates = new Set<string>();
  // Branches a test makes for itself, removed with the others.
  const spare: string[] = [];

  // A plate that is a good one and that nothing else in the shared database has: the province 34 and random letters and digits.
  const LETTERS = 'ABCDEFGHJKLMNPRSTUVYZ';
  const plateOf = (): string => {
    for (;;) {
      const letters = Array.from({ length: 3 }, () => LETTERS[randomInt(LETTERS.length)]).join('');
      const plate = `34 ${letters} ${randomInt(1000, 10000)}`;
      if (!usedPlates.has(plate)) {
        usedPlates.add(plate);
        return plate;
      }
    }
  };
  const body = (overrides: Record<string, unknown> = {}) => ({
    plate: plateOf(),
    year: 2025,
    modelSlug: ids.modelSlug,
    branchId: ids.open,
    ...overrides,
  });
  const make = async (overrides: Record<string, unknown> = {}) => service.create(body(overrides));
  const book = (suffix: string, vehicleId: string, startAt: Date, endAt: Date, status: 'CONFIRMED' | 'CANCELLED' = 'CONFIRMED') =>
    prisma.reservation.create({
      data: {
        number: `V30-${run}-${suffix}`,
        status,
        startAt,
        endAt,
        days: 1,
        vehicleDailyPrice: 125000,
        totalPrice: 125000,
        vehicleId,
        pickupBranchId: ids.open,
        returnBranchId: ids.open,
      },
    });
  const branchData = (name: string) => ({
    name: `${name} ${run}`,
    city: 'Ankara',
    address: 'Test',
    latitude: 39.9,
    longitude: 32.8,
    phone: '+90 312 555 00 00',
    email: `${name.toLowerCase().replace(/\s+/g, '-')}-${run}@example.test`,
    openingHours: { weekdays: '00:00-23:59', saturday: '00:00-23:59', sunday: '00:00-23:59' },
  });
  const modelData = (slug: string, retired: boolean) => ({
    slug,
    brand: 'Deneme',
    model: slug,
    seats: 5,
    bags: 2,
    transmission: 'MANUAL' as const,
    fuelType: 'PETROL' as const,
    consumption: 5.4,
    consumptionUnit: 'L_PER_100KM' as const,
    dailyPrice: 125000,
    description: { tr: 'Deneme', en: 'Test' },
    classId: ids.classId,
    retiredAt: retired ? new Date() : null,
  });

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    service = new VehiclesService(prisma);
    ids.classId = (await prisma.vehicleClass.create({ data: { slug: `v30c-${run}`, nameTr: 'Deneme', nameEn: 'Test' } })).id;
    ids.modelId = (await prisma.vehicleModel.create({ data: modelData(ids.modelSlug, false) })).id;
    ids.retiredId = (await prisma.vehicleModel.create({ data: modelData(ids.retiredSlug, true) })).id;
    ids.open = (await prisma.branch.create({ data: branchData('Arac Bayi A') })).id;
    ids.other = (await prisma.branch.create({ data: branchData('Arac Bayi B') })).id;
    ids.closed = (await prisma.branch.create({ data: { ...branchData('Arac Bayi C'), closedAt: new Date() } })).id;
  });

  afterAll(async () => {
    const branchIds = [ids.open, ids.other, ids.closed, ...spare];
    const cars = await prisma.vehicle.findMany({ where: { branchId: { in: branchIds } }, select: { id: true } });
    const carIds = cars.map((vehicle) => vehicle.id);
    await prisma.hold.deleteMany({ where: { vehicleId: { in: carIds } } });
    await prisma.reservation.deleteMany({ where: { number: { startsWith: `V30-${run}` } } });
    await prisma.vehicle.deleteMany({ where: { id: { in: carIds } } });
    await prisma.vehicleModel.deleteMany({ where: { id: { in: [ids.modelId, ids.retiredId] } } });
    await prisma.branch.deleteMany({ where: { id: { in: branchIds } } });
    await prisma.vehicleClass.deleteMany({ where: { id: ids.classId } });
    await prisma.$disconnect();
  });

  describe('adding a car', () => {
    it('writes what was sent, switched on, with the plate in its stored form', async () => {
      const typed = plateOf().replace(/ /g, '').toLowerCase();
      const view = await make({ plate: typed });
      expect(view).toMatchObject({ status: 'ACTIVE', year: 2025, model: { slug: ids.modelSlug, retired: false }, branch: { id: ids.open, closed: false } });
      expect(view.plate).toMatch(/^34 [A-Z]{3} \d{4}$/);
      const row = await prisma.vehicle.findUniqueOrThrow({ where: { id: view.id } });
      expect(row).toMatchObject({ plate: view.plate, active: true, branchId: ids.open, vehicleModelId: ids.modelId });
    });

    it('is free to rent at its branch for dates that are free, and at no other', async () => {
      await make();
      const search = (branchId: string) =>
        new AvailabilityService(prisma).getAvailableVehicles({
          pickupBranchId: branchId,
          returnBranchId: branchId,
          startAt: slotAt(30),
          endAt: slotAt(32),
        });
      expect((await search(ids.open)).some((offer) => offer.model.slug === ids.modelSlug && offer.branch.id === ids.open)).toBe(true);
      expect((await search(ids.other)).some((offer) => offer.model.slug === ids.modelSlug)).toBe(false);
    });

    it('a plate that is already used, in whatever way it is typed, is 409 PLATE_TAKEN and nothing is added', async () => {
      const first = await make();
      const before = await prisma.vehicle.count({ where: { branchId: ids.open } });
      for (const typed of [first.plate, first.plate.replace(/ /g, '-').toLowerCase()]) {
        const answer = await refused(service.create(body({ plate: typed })));
        expect(answer.status).toBe(409);
        expect(answer.body).toMatchObject({ code: 'PLATE_TAKEN', fieldErrors: { plate: 'PLATE_TAKEN' } });
      }
      expect(await prisma.vehicle.count({ where: { branchId: ids.open } })).toBe(before);
    });

    it('refuses a closed branch, a branch or a model that does not exist, and a retired model, each on its own field', async () => {
      expect((await refused(service.create(body({ branchId: ids.closed })))).body).toMatchObject({ fieldErrors: { branchId: 'UNKNOWN_REFERENCE' } });
      expect((await refused(service.create(body({ branchId: randomUUID() })))).body).toMatchObject({ fieldErrors: { branchId: 'UNKNOWN_REFERENCE' } });
      expect((await refused(service.create(body({ modelSlug: ids.retiredSlug })))).body).toMatchObject({ fieldErrors: { modelSlug: 'UNKNOWN_REFERENCE' } });
      expect((await refused(service.create(body({ modelSlug: 'no-such-model' })))).body).toMatchObject({ fieldErrors: { modelSlug: 'UNKNOWN_REFERENCE' } });
    });

    it('is 422 for a plate, a year or a model that is not right, with the year bound moving with the date', async () => {
      const answer = await refused(service.create(body({ plate: 'ABC', year: 2014 })));
      expect(answer.status).toBe(422);
      expect(answer.body).toMatchObject({ fieldErrors: { plate: 'INVALID_FORMAT', year: 'OUT_OF_RANGE' } });
      const next = new Date().getUTCFullYear() + 1;
      expect((await make({ year: next })).year).toBe(next);
      expect((await refused(service.create(body({ year: next + 1 })))).body).toMatchObject({ fieldErrors: { year: 'OUT_OF_RANGE' } });
    });

    it('the database itself refuses a plate or a year that is not one', async () => {
      const model = { vehicleModelId: ids.modelId, branchId: ids.open };
      await expect(prisma.vehicle.create({ data: { ...model, plate: `bad-${run}`, year: 2025 } })).rejects.toThrow();
      await expect(prisma.vehicle.create({ data: { ...model, plate: plateOf(), year: 1999 } })).rejects.toThrow();
    });
  });

  describe('listing', () => {
    it('lists the cars of one branch with their model and state, and narrows by state, model and plate', async () => {
      const a = await make({ branchId: ids.other });
      const b = await make({ branchId: ids.other });
      await service.update(b.id, { updatedAt: b.updatedAt, active: false });

      const all = await service.list({ branch: ids.other, sort: 'plate:asc' });
      expect(all.total).toBe(2);
      expect(all.items.map((view) => view.plate)).toEqual([a.plate, b.plate].sort());
      expect(all.items[0]).toMatchObject({ model: { slug: ids.modelSlug }, branch: { id: ids.other } });

      expect((await service.list({ branch: ids.other, status: 'INACTIVE' })).items.map((view) => view.id)).toEqual([b.id]);
      expect((await service.list({ branch: ids.other, status: 'ACTIVE' })).items.map((view) => view.id)).toEqual([a.id]);
      expect((await service.list({ branch: ids.other, model: 'another-model' })).total).toBe(0);
      // A plate is found by a part of it, however it is typed.
      const part = a.plate.replace(/ /g, '').slice(0, 6).toLowerCase();
      expect((await service.list({ q: part, branch: ids.other })).items.map((view) => view.id)).toContain(a.id);
    });

    it('pages with a total that does not change, and sorts by year', async () => {
      const wanted = [2020, 2022, 2024];
      for (const year of wanted) await make({ year });
      const page = await service.list({ branch: ids.open, sort: 'year:desc', pageSize: '2', page: '1' });
      expect(page.items).toHaveLength(2);
      expect(page.total).toBeGreaterThanOrEqual(3);
      expect(page.items[0]!.year).toBeGreaterThanOrEqual(page.items[1]!.year);
    });

    it('says what keeps one car where it is', async () => {
      const view = await make();
      expect((await service.get(view.id)).usage).toEqual({ reservations: 0, holds: 0 });
      await book('GET', view.id, days(5), days(6));
      expect((await service.get(view.id)).usage).toEqual({ reservations: 1, holds: 0 });
      expect((await refused(service.get(randomUUID()))).status).toBe(404);
    });
  });

  describe('moving and switching off', () => {
    it('moves a car to another open branch and moves the version on', async () => {
      const view = await make();
      const moved = await service.update(view.id, { updatedAt: view.updatedAt, branchId: ids.other });
      expect(moved.branch.id).toBe(ids.other);
      expect(moved.updatedAt).not.toBe(view.updatedAt);
    });

    it('an edit made against an old version is 409 STALE_WRITE and writes nothing', async () => {
      const view = await make();
      await service.update(view.id, { updatedAt: view.updatedAt, active: false });
      const answer = await refused(service.update(view.id, { updatedAt: view.updatedAt, branchId: ids.other }));
      expect(answer).toMatchObject({ status: 409, body: { code: 'STALE_WRITE' } });
      expect((await prisma.vehicle.findUniqueOrThrow({ where: { id: view.id } })).branchId).toBe(ids.open);
    });

    it('does not move a car to a closed branch or one that does not exist', async () => {
      const view = await make();
      for (const branchId of [ids.closed, randomUUID()]) {
        expect((await refused(service.update(view.id, { updatedAt: view.updatedAt, branchId }))).body).toMatchObject({ fieldErrors: { branchId: 'UNKNOWN_REFERENCE' } });
      }
      expect((await prisma.vehicle.findUniqueOrThrow({ where: { id: view.id } })).branchId).toBe(ids.open);
    });

    it('is refused for a car with a booking still to come, with how many, and nothing changes', async () => {
      const view = await make();
      await book('IU', view.id, days(10), days(11));
      for (const change of [{ branchId: ids.other }, { active: false }]) {
        const answer = await refused(service.update(view.id, { updatedAt: view.updatedAt, ...change }));
        expect(answer).toMatchObject({ status: 409, body: { code: 'IN_USE', details: { reservations: 1, holds: 0 } } });
      }
      expect(await prisma.vehicle.findUniqueOrThrow({ where: { id: view.id } })).toMatchObject({ active: true, branchId: ids.open });
    });

    it('is refused while a hold is running on the car, and not by one that has run out', async () => {
      const view = await make();
      const hold = (expiresAt: Date) =>
        prisma.hold.create({
          data: { startAt: days(20), endAt: days(21), expiresAt, vehicleId: view.id, pickupBranchId: ids.open, returnBranchId: ids.open },
        });
      const expired = await hold(new Date(Date.now() - 60_000));
      expect((await service.update(view.id, { updatedAt: view.updatedAt, branchId: ids.other })).branch.id).toBe(ids.other);
      await prisma.hold.delete({ where: { id: expired.id } });

      const moved = await prisma.vehicle.findUniqueOrThrow({ where: { id: view.id } });
      await hold(new Date(Date.now() + 10 * 60_000));
      const answer = await refused(service.update(view.id, { updatedAt: moved.updatedAt.toISOString(), active: false }));
      expect(answer.body).toMatchObject({ code: 'IN_USE', details: { reservations: 0, holds: 1 } });
    });

    it('past, running and cancelled bookings do not keep a car where it is', async () => {
      const view = await make();
      await book('P1', view.id, days(-10), days(-9));
      await book('P2', view.id, days(-1), days(1));
      await book('P3', view.id, days(10), days(11), 'CANCELLED');
      const off = await service.update(view.id, { updatedAt: view.updatedAt, active: false });
      expect(off.status).toBe('INACTIVE');
    });

    it('a car that is switched off drops out of the search, and put back it is in again', async () => {
      // A branch of its own, so this car is the only one of its model there: an offer is one per model.
      const alone = await prisma.branch.create({ data: branchData("Arac Bayi E") });
      spare.push(alone.id);
      const view = await make({ branchId: alone.id });
      const offers = async () =>
        (
          await new AvailabilityService(prisma).getAvailableVehicles({
            pickupBranchId: alone.id,
            returnBranchId: alone.id,
            startAt: slotAt(40),
            endAt: slotAt(42),
          })
        ).length;
      expect(await offers()).toBe(1);
      const off = await service.update(view.id, { updatedAt: view.updatedAt, active: false });
      expect(await offers()).toBe(0);
      await service.update(view.id, { updatedAt: off.updatedAt, active: true });
      expect(await offers()).toBe(1);
    });

    it('a car cannot be switched on while its model is retired or its branch is closed', async () => {
      const onRetired = await prisma.vehicle.create({ data: { plate: plateOf(), year: 2025, active: false, vehicleModelId: ids.retiredId, branchId: ids.open } });
      expect((await refused(service.update(onRetired.id, { updatedAt: onRetired.updatedAt.toISOString(), active: true }))).body).toMatchObject({ fieldErrors: { active: 'NOT_ALLOWED' } });

      const atClosed = await prisma.vehicle.create({ data: { plate: plateOf(), year: 2025, active: false, vehicleModelId: ids.modelId, branchId: ids.closed } });
      expect((await refused(service.update(atClosed.id, { updatedAt: atClosed.updatedAt.toISOString(), active: true }))).body).toMatchObject({ fieldErrors: { active: 'NOT_ALLOWED' } });
      // Moved to an open branch and switched on in the same change, it is fine.
      const fixed = await service.update(atClosed.id, { updatedAt: atClosed.updatedAt.toISOString(), branchId: ids.open, active: true });
      expect(fixed).toMatchObject({ status: 'ACTIVE', branch: { id: ids.open } });
    });

    it('a car that is off may stay where it is even when the branch is closed, and a car that does not exist is 404', async () => {
      const off = await prisma.vehicle.create({ data: { plate: plateOf(), year: 2025, active: false, vehicleModelId: ids.modelId, branchId: ids.closed } });
      expect((await service.update(off.id, { updatedAt: off.updatedAt.toISOString(), active: false })).branch.closed).toBe(true);
      expect((await refused(service.update(randomUUID(), { updatedAt: new Date().toISOString(), active: false }))).status).toBe(404);
    });
  });

  // The cars are locked the way a booking locks one, so a booking that is being made and a change to the same car take turns.
  describe('against a booking or a closing made at the same moment', () => {
    it('a switching off waits for the booking that holds the car, then sees it and refuses', async () => {
      const view = await make();
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
        await tx.$queryRaw`SELECT "id" FROM "Vehicle" WHERE "id" = ${view.id} FOR UPDATE`;
        await tx.reservation.create({
          data: {
            number: `V30-${run}-RC`,
            startAt: days(7),
            endAt: days(8),
            days: 1,
            vehicleDailyPrice: 125000,
            totalPrice: 125000,
            vehicleId: view.id,
            pickupBranchId: ids.open,
            returnBranchId: ids.open,
          },
        });
        events.push('booking made');
        locked();
        await held;
        events.push('booking commits');
      });
      await lockTaken;

      const switching = refused(service.update(view.id, { updatedAt: view.updatedAt, active: false })).then((answer) => {
        events.push('switching answered');
        return answer;
      });
      await new Promise((resolve) => setTimeout(resolve, 400));
      expect(events).toEqual(['booking made']);

      release();
      await booking;
      const answer = await switching;
      expect(events).toEqual(['booking made', 'booking commits', 'switching answered']);
      expect(answer.body).toMatchObject({ code: 'IN_USE', details: { reservations: 1 } });
      expect((await prisma.vehicle.findUniqueOrThrow({ where: { id: view.id } })).active).toBe(true);
    });

    it('adding a car waits for the closing of its branch, then finds the branch closed and refuses', async () => {
      const branch = await prisma.branch.create({ data: branchData('Arac Bayi D') });
      const events: string[] = [];
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      let locked!: () => void;
      const lockTaken = new Promise<void>((resolve) => {
        locked = resolve;
      });
      const closing = prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Branch" WHERE "id" = ${branch.id} FOR UPDATE`;
        await tx.branch.update({ where: { id: branch.id }, data: { closedAt: new Date() } });
        events.push('branch closed');
        locked();
        await held;
        events.push('closing commits');
      });
      await lockTaken;

      const adding = refused(service.create(body({ branchId: branch.id }))).then((answer) => {
        events.push('adding answered');
        return answer;
      });
      await new Promise((resolve) => setTimeout(resolve, 400));
      expect(events).toEqual(['branch closed']);

      release();
      await closing;
      const answer = await adding;
      expect(events).toEqual(['branch closed', 'closing commits', 'adding answered']);
      expect(answer.body).toMatchObject({ fieldErrors: { branchId: 'UNKNOWN_REFERENCE' } });
      expect(await prisma.vehicle.count({ where: { branchId: branch.id } })).toBe(0);
      await prisma.branch.delete({ where: { id: branch.id } });
    });
  });
});
