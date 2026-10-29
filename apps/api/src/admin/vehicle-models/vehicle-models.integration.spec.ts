import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { CatalogService } from '../../catalog/catalog.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PricingService } from '../../reservations/pricing.service.js';
import { parseReservationRequest } from '../../reservations/reservation-input.js';
import { VehicleModelsService } from './vehicle-models.service.js';
import { testPlate } from '../../common/plate.testing.js';

// The vehicle model administration against a real PostgreSQL (TEST_DATABASE_URL), like the other integration tests; skipped
// without one. The test database is shared with suites that run at the same time and holds the seed models, so every list is
// narrowed to this run's own models by a word in their address (`run`).
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !/test/i.test(databaseUrl)) {
  throw new Error('TEST_DATABASE_URL must point at a database with "test" in its name.');
}
const describeDb = databaseUrl ? describe : describe.skip;

const DAY = 86_400_000;
const days = (count: number) => new Date(Date.now() + count * DAY);
// A booking starts and ends on a full hour (the half-hour slots of the booking form), so a moment is cut back to one.
const slotAt = (count: number) => {
  const moment = days(count);
  moment.setUTCMinutes(0, 0, 0);
  return moment.toISOString();
};
const STORE_PHOTO = 'https://ce0rcu23vrrdzqap.public.blob.vercel-storage.com/vehicle-models/0b1c2d3e.webp';

async function refused(promise: Promise<unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return { status: error.getStatus(), body: error.getResponse() as Record<string, unknown> };
    throw error;
  }
  throw new Error('expected the call to be refused');
}

describeDb('vehicle model administration against the database (V2-29)', () => {
  let prisma: PrismaService;
  let service: VehicleModelsService;
  const run = randomUUID().slice(0, 8);
  const created: string[] = [];
  const ids = { classA: '', classB: '', branchId: '' };
  const slugs = { classA: `v29a-${run}`, classB: `v29b-${run}` };

  const slug = (suffix: string) => `v29-${run}-${suffix.toLowerCase()}`;
  const body = (suffix: string, overrides: Record<string, unknown> = {}) => ({
    brand: 'Deneme',
    model: `Model ${suffix}`,
    slug: slug(suffix),
    classSlug: slugs.classA,
    fuelType: 'PETROL',
    transmission: 'MANUAL',
    seats: 5,
    bags: 3,
    consumption: 5.4,
    dailyPrice: 125000,
    description: { tr: 'Deneme açıklaması', en: 'A test description' },
    ...overrides,
  });
  const make = async (suffix: string, overrides: Record<string, unknown> = {}) => {
    const view = await service.create(body(suffix, overrides));
    created.push(view.slug);
    return view;
  };
  const car = async (suffix: string, modelSlug: string, active = true) => {
    const model = await prisma.vehicleModel.findUniqueOrThrow({ where: { slug: modelSlug } });
    return prisma.vehicle.create({ data: { plate: testPlate(), year: 2030, active, vehicleModelId: model.id, branchId: ids.branchId } });
  };
  const book = (suffix: string, vehicleId: string, startAt: Date, endAt: Date, status: 'CONFIRMED' | 'CANCELLED' = 'CONFIRMED') =>
    prisma.reservation.create({
      data: {
        number: `V29-${run}-${suffix}`,
        status,
        startAt,
        endAt,
        days: 1,
        vehicleDailyPrice: 125000,
        totalPrice: 125000,
        vehicleId,
        pickupBranchId: ids.branchId,
        returnBranchId: ids.branchId,
      },
    });

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    service = new VehicleModelsService(prisma);
    ids.classA = (await prisma.vehicleClass.create({ data: { slug: slugs.classA, nameTr: 'Deneme A', nameEn: 'Test A' } })).id;
    ids.classB = (await prisma.vehicleClass.create({ data: { slug: slugs.classB, nameTr: 'Deneme B', nameEn: 'Test B' } })).id;
    ids.branchId = (
      await prisma.branch.create({
        data: {
          name: `Model Bayi ${run}`,
          city: 'Ankara',
          address: 'Test',
          latitude: 39.9,
          longitude: 32.8,
          phone: '+90 312 555 00 00',
          email: `model-${run}@example.test`,
          openingHours: { weekdays: '08:00-20:00', saturday: '09:00-17:00', sunday: 'closed' },
        },
      })
    ).id;
  });

  afterAll(async () => {
    const models = await prisma.vehicleModel.findMany({ where: { slug: { in: created } }, select: { id: true } });
    const modelIds = models.map((model) => model.id);
    const cars = await prisma.vehicle.findMany({ where: { vehicleModelId: { in: modelIds } }, select: { id: true } });
    const carIds = cars.map((vehicle) => vehicle.id);
    await prisma.hold.deleteMany({ where: { vehicleId: { in: carIds } } });
    await prisma.reservation.deleteMany({ where: { number: { startsWith: `V29-${run}` } } });
    await prisma.vehicle.deleteMany({ where: { id: { in: carIds } } });
    await prisma.vehicleModel.deleteMany({ where: { id: { in: modelIds } } });
    await prisma.branch.deleteMany({ where: { id: ids.branchId } });
    await prisma.vehicleClass.deleteMany({ where: { id: { in: [ids.classA, ids.classB] } } });
    await prisma.$disconnect();
  });

  describe('creating', () => {
    it('writes what was sent, on the site, with no cars; the unit follows the fuel', async () => {
      const view = await make('NEW', { imageUrl: STORE_PHOTO });
      expect(view).toMatchObject({
        slug: slug('NEW'),
        brand: 'Deneme',
        fuelType: 'PETROL',
        consumption: { value: 5.4, unit: 'L_PER_100KM' },
        dailyPrice: 125000,
        description: { tr: 'Deneme açıklaması', en: 'A test description' },
        imageUrl: STORE_PHOTO,
        status: 'ACTIVE',
        retiredAt: null,
        activeVehicles: 0,
        class: { slug: slugs.classA, name: { tr: 'Deneme A', en: 'Test A' } },
      });
      const electric = await make('EL', { fuelType: 'ELECTRIC', consumption: 16.5 });
      expect(electric.consumption).toEqual({ value: 16.5, unit: 'KWH_PER_100KM' });
      const hybrid = await make('HY', { fuelType: 'HYBRID' });
      expect(hybrid.consumption.unit).toBe('L_PER_100KM');
    });

    it('a picture is optional: left out is no picture, and the site draws its placeholder', async () => {
      expect((await make('NOPIC')).imageUrl).toBeNull();
      expect((await make('EMPTYPIC', { imageUrl: '' })).imageUrl).toBeNull();
    });

    it('a site path of the repository photos is a good picture address', async () => {
      expect((await make('SITEPIC', { imageUrl: '/fleet/fiat-egea.webp' })).imageUrl).toBe('/fleet/fiat-egea.webp');
    });

    it('makes the address from the name when none is given, with the Turkish letters turned plain', async () => {
      const view = await service.create(body('X', { slug: undefined, brand: 'Şişli Otomotiv', model: `Çıkış ${run}` }));
      created.push(view.slug);
      expect(view.slug).toBe(`sisli-otomotiv-cikis-${run}`);
    });

    it('an address that is taken is 409 SLUG_TAKEN and nothing is changed', async () => {
      await make('TAKEN', { dailyPrice: 100000 });
      const again = await refused(service.create(body('TAKEN', { dailyPrice: 200000 })));
      expect(again.status).toBe(409);
      expect(again.body).toMatchObject({ code: 'SLUG_TAKEN', fieldErrors: { slug: 'SLUG_TAKEN' } });
      expect((await service.get(slug('TAKEN'))).dailyPrice).toBe(100000);
    });

    it('refuses what is wrong with a code for each field', async () => {
      const bad = await refused(
        service.create({
          brand: '',
          model: 'x'.repeat(61),
          slug: 'Not A Slug',
          classSlug: 'nope-nope',
          fuelType: 'STEAM',
          transmission: 'CVT',
          seats: 12,
          bags: -1,
          consumption: 0,
          dailyPrice: 0,
          description: { tr: 'Yalnız Türkçe' },
          imageUrl: 'https://evil.com/a.webp',
        }),
      );
      expect(bad.status).toBe(422);
      expect(bad.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        fieldErrors: {
          brand: 'REQUIRED',
          model: 'TOO_LONG',
          slug: 'INVALID_FORMAT',
          fuelType: 'INVALID_FORMAT',
          transmission: 'INVALID_FORMAT',
          seats: 'OUT_OF_RANGE',
          bags: 'OUT_OF_RANGE',
          consumption: 'OUT_OF_RANGE',
          dailyPrice: 'OUT_OF_RANGE',
          description: 'REQUIRED',
          imageUrl: 'INVALID_FORMAT',
        },
      });
    });

    it('a class that does not exist is 422 UNKNOWN_REFERENCE', async () => {
      const bad = await refused(service.create(body('NOCLASS', { classSlug: 'sinif-yok' })));
      expect(bad.body).toMatchObject({ fieldErrors: { classSlug: 'UNKNOWN_REFERENCE' } });
      expect(await prisma.vehicleModel.count({ where: { slug: slug('NOCLASS') } })).toBe(0);
    });

    it('lists the classes, for the form', async () => {
      const classes = await service.classes();
      expect(classes.filter((entry) => entry.slug.startsWith('v29')).map((entry) => entry.slug).sort()).toEqual([slugs.classA, slugs.classB].sort());
    });
  });

  describe('the database itself', () => {
    const row = (overrides: Record<string, unknown>) => ({
      slug: slug('DB'),
      brand: 'D',
      model: 'M',
      seats: 5,
      bags: 2,
      transmission: 'MANUAL' as const,
      fuelType: 'PETROL' as const,
      consumption: 5,
      consumptionUnit: 'L_PER_100KM' as const,
      dailyPrice: 100000,
      description: { tr: 'a', en: 'b' },
      classId: ids.classA,
      ...overrides,
    });

    it('refuses a price of zero, an address that is not one, seats and bags out of range and a unit that does not fit the fuel', async () => {
      for (const [overrides, constraint] of [
        [{ dailyPrice: 0 }, /VehicleModel_dailyPrice_positive_check/],
        [{ slug: 'Not A Slug' }, /VehicleModel_slug_check/],
        [{ seats: 10 }, /VehicleModel_seats_check/],
        [{ bags: 11 }, /VehicleModel_bags_check/],
        [{ consumption: 0 }, /VehicleModel_consumption_check/],
        [{ fuelType: 'ELECTRIC' }, /VehicleModel_consumptionUnit_check/],
        [{ consumptionUnit: 'KWH_PER_100KM' }, /VehicleModel_consumptionUnit_check/],
      ] as const) {
        await expect(prisma.vehicleModel.create({ data: row(overrides) })).rejects.toThrow(constraint);
      }
      expect(await prisma.vehicleModel.count({ where: { slug: slug('DB') } })).toBe(0);
    });
  });

  describe('listing', () => {
    beforeAll(async () => {
      await make('LA', { brand: 'Alfa', model: 'Giulia', fuelType: 'DIESEL', dailyPrice: 300000 });
      await make('LB', { brand: 'Çelik', model: 'Şahin', classSlug: slugs.classB, fuelType: 'ELECTRIC', consumption: 15, dailyPrice: 200000 });
      const old = await make('LC', { brand: 'Eski', model: 'Model', dailyPrice: 100000 });
      await service.retire(old.slug);
    });
    const mine = (query: Record<string, string> = {}) => service.list({ q: `v29-${run}-l`, ...query });

    it('lists this run’s models with their state, by name', async () => {
      const page = await mine({ sort: 'name:asc' });
      expect(page.items.map((item) => item.brand)).toEqual(['Alfa', 'Çelik', 'Eski']);
      expect(page.items.find((item) => item.brand === 'Eski')?.status).toBe('RETIRED');
    });

    it('narrows by class, fuel and state', async () => {
      expect((await mine({ class: slugs.classB })).items.map((item) => item.brand)).toEqual(['Çelik']);
      expect((await mine({ fuel: 'DIESEL' })).items.map((item) => item.brand)).toEqual(['Alfa']);
      expect((await mine({ status: 'RETIRED' })).items.map((item) => item.brand)).toEqual(['Eski']);
      expect((await mine({ status: 'ACTIVE' })).items.map((item) => item.brand).sort()).toEqual(['Alfa', 'Çelik']);
    });

    it('searches the brand, model and address without caring about case or Turkish letters', async () => {
      expect((await service.list({ q: 'sahin' })).items.map((item) => item.slug)).toContain(slug('LB'));
      expect((await service.list({ q: 'CELIK SAHIN' })).items.map((item) => item.slug)).toContain(slug('LB'));
      expect((await service.list({ q: 'giulia' })).items.map((item) => item.slug)).toContain(slug('LA'));
    });

    it('sorts by price, and pages with a total that does not change', async () => {
      expect((await mine({ sort: 'dailyPrice:desc' })).items.map((item) => item.dailyPrice)).toEqual([300000, 200000, 100000]);
      const first = await mine({ sort: 'dailyPrice:desc', pageSize: '2' });
      expect(first).toMatchObject({ total: 3, page: 1, pageSize: 2 });
      expect(first.items).toHaveLength(2);
      expect((await mine({ sort: 'dailyPrice:desc', pageSize: '2', page: '2' })).items.map((item) => item.dailyPrice)).toEqual([100000]);
    });

    it('counts the cars that are switched on', async () => {
      await car('L1', slug('LA'));
      await car('L2', slug('LA'));
      await car('L3', slug('LA'), false);
      expect((await mine({ q: slug('LA') })).items[0]?.activeVehicles).toBe(2);
    });
  });

  describe('changing', () => {
    it('changes only what is sent and moves the version on', async () => {
      const view = await make('CH');
      const changed = await service.update(view.slug, { updatedAt: view.updatedAt, dailyPrice: 150000, imageUrl: STORE_PHOTO });
      expect(changed).toMatchObject({ dailyPrice: 150000, imageUrl: STORE_PHOTO, brand: 'Deneme', seats: 5, consumption: { value: 5.4, unit: 'L_PER_100KM' } });
      expect(changed.updatedAt).not.toBe(view.updatedAt);
      // `null` takes the picture away.
      expect((await service.update(view.slug, { updatedAt: changed.updatedAt, imageUrl: null })).imageUrl).toBeNull();
    });

    it('the address cannot be changed: sending one is refused, not ignored', async () => {
      const view = await make('NOSLUG');
      const refusal = await refused(service.update(view.slug, { updatedAt: view.updatedAt, slug: 'baska-bir-adres' }));
      expect(refusal.status).toBe(422);
      expect(refusal.body).toMatchObject({ fieldErrors: { slug: 'NOT_ALLOWED' } });
      expect((await service.get(view.slug)).slug).toBe(slug('NOSLUG'));
    });

    it('an edit made against an old version is 409 STALE_WRITE and writes nothing', async () => {
      const view = await make('ST');
      await service.update(view.slug, { updatedAt: view.updatedAt, seats: 4 });
      const late = await refused(service.update(view.slug, { updatedAt: view.updatedAt, seats: 7 }));
      expect(late.status).toBe(409);
      expect(late.body.code).toBe('STALE_WRITE');
      expect((await service.get(view.slug)).seats).toBe(4);
    });

    it('moves a model to another class, and refuses a class that does not exist', async () => {
      const view = await make('CL');
      expect((await service.update(view.slug, { updatedAt: view.updatedAt, classSlug: slugs.classB })).class.slug).toBe(slugs.classB);
      const current = await service.get(view.slug);
      expect((await refused(service.update(view.slug, { updatedAt: current.updatedAt, classSlug: 'sinif-yok' }))).body).toMatchObject({
        fieldErrors: { classSlug: 'UNKNOWN_REFERENCE' },
      });
    });

    it('changing the fuel changes the unit, and across electric the consumption has to be given again', async () => {
      const view = await make('FU', { consumption: 5.4 });
      const hybrid = await service.update(view.slug, { updatedAt: view.updatedAt, fuelType: 'HYBRID' });
      expect(hybrid.consumption).toEqual({ value: 5.4, unit: 'L_PER_100KM' });
      const needs = await refused(service.update(view.slug, { updatedAt: hybrid.updatedAt, fuelType: 'ELECTRIC' }));
      expect(needs.body).toMatchObject({ fieldErrors: { consumption: 'REQUIRED' } });
      const electric = await service.update(view.slug, { updatedAt: hybrid.updatedAt, fuelType: 'ELECTRIC', consumption: 16 });
      expect(electric.consumption).toEqual({ value: 16, unit: 'KWH_PER_100KM' });
    });

    it('a wrong value is refused as on a new model; a model that does not exist is 404', async () => {
      const view = await make('BADV');
      expect((await refused(service.update(view.slug, { updatedAt: view.updatedAt, dailyPrice: -5, seats: 0 }))).body).toMatchObject({
        fieldErrors: { dailyPrice: 'OUT_OF_RANGE', seats: 'OUT_OF_RANGE' },
      });
      expect((await refused(service.get('v29-yok-yok'))).status).toBe(404);
      expect((await refused(service.get('Not A Slug'))).status).toBe(404);
      expect((await refused(service.update('v29-yok-yok', { updatedAt: new Date().toISOString() }))).status).toBe(404);
    });
  });

  describe('the price', () => {
    // A change of the price is for the next price that is worked out; a booking that was made keeps what it was told.
    it('does not change a booking that was made, and is what the next price is worked out from', async () => {
      const view = await make('PR', { dailyPrice: 125000 });
      const vehicle = await car('P1', view.slug);
      const booking = await book('PR1', vehicle.id, days(40), days(41));

      await service.update(view.slug, { updatedAt: view.updatedAt, dailyPrice: 200000 });

      const kept = await prisma.reservation.findUniqueOrThrow({ where: { id: booking.id } });
      expect(kept).toMatchObject({ vehicleDailyPrice: 125000, totalPrice: 125000 });

      const request = parseReservationRequest({
        vehicleId: vehicle.id,
        pickupBranchId: ids.branchId,
        returnBranchId: ids.branchId,
        startAt: slotAt(60),
        endAt: slotAt(61),
        currency: 'TRY',
      });
      const next = await new PricingService(prisma).calculate(prisma, request);
      expect(next.lines.find((line) => line.type === 'VEHICLE')?.unitPrice).toEqual({ amount: 200000, currency: 'TRY' });
    });
  });

  describe('retiring and putting back', () => {
    it('retires a model that nothing depends on: it and its cars go off together', async () => {
      const view = await make('RT');
      await car('R1', view.slug);
      await car('R2', view.slug);
      const retired = await service.retire(view.slug);
      expect(retired).toMatchObject({ status: 'RETIRED' });
      expect(retired.retiredAt).not.toBeNull();
      const model = await prisma.vehicleModel.findUniqueOrThrow({ where: { slug: view.slug } });
      expect(await prisma.vehicle.count({ where: { vehicleModelId: model.id, active: true } })).toBe(0);
      expect(await prisma.vehicle.count({ where: { vehicleModelId: model.id } })).toBe(2);
      // Retiring again changes nothing.
      expect((await service.retire(view.slug)).retiredAt).toBe(retired.retiredAt);
    });

    it('is refused while a booking is still to come with one of its cars, with how many; nothing changes', async () => {
      const view = await make('RF');
      const vehicle = await car('F1', view.slug);
      await book('RF1', vehicle.id, days(5), days(6));
      const stay = await refused(service.retire(view.slug));
      expect(stay.status).toBe(409);
      expect(stay.body).toMatchObject({ code: 'IN_USE', details: { reservations: 1, holds: 0 } });
      expect(await service.get(view.slug)).toMatchObject({ status: 'ACTIVE', activeVehicles: 1, updatedAt: view.updatedAt });
      expect((await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } })).active).toBe(true);
      expect((await service.get(view.slug)).usage).toEqual({ reservations: 1, holds: 0 });
    });

    it('past, running and cancelled bookings do not keep a model on the site', async () => {
      const view = await make('RP');
      const vehicle = await car('P2', view.slug);
      await book('RP1', vehicle.id, days(-10), days(-9));
      await book('RP2', vehicle.id, days(-1), days(2));
      await book('RP3', vehicle.id, days(5), days(6), 'CANCELLED');
      expect((await service.retire(view.slug)).status).toBe('RETIRED');
    });

    it('is refused while a hold is running on one of its cars, and not by one that has run out', async () => {
      const held = await make('HD');
      const heldCar = await car('H1', held.slug);
      await prisma.hold.create({
        data: { vehicleId: heldCar.id, pickupBranchId: ids.branchId, returnBranchId: ids.branchId, startAt: days(20), endAt: days(21), expiresAt: new Date(Date.now() + 600_000), clientKey: `v29-${run}` },
      });
      expect((await refused(service.retire(held.slug))).body).toMatchObject({ code: 'IN_USE', details: { holds: 1 } });

      const over = await make('HO');
      const overCar = await car('H2', over.slug);
      await prisma.hold.create({
        data: { vehicleId: overCar.id, pickupBranchId: ids.branchId, returnBranchId: ids.branchId, startAt: days(20), endAt: days(21), expiresAt: new Date(Date.now() - 60_000), clientKey: `v29-${run}` },
      });
      expect((await service.retire(over.slug)).status).toBe('RETIRED');
    });

    it('a retired model is not on the site; put back, it is; its cars stay off', async () => {
      const catalog = new CatalogService(prisma);
      const view = await make('PB', { imageUrl: STORE_PHOTO });
      await car('B1', view.slug);
      const onSite = async () => (await catalog.getVehicleModels()).some((model) => model.slug === view.slug);
      expect(await onSite()).toBe(true);

      await service.retire(view.slug);
      expect(await onSite()).toBe(false);
      // The panel still has it.
      expect(await service.get(view.slug)).toMatchObject({ status: 'RETIRED', imageUrl: STORE_PHOTO });

      const back = await service.restore(view.slug);
      expect(back).toMatchObject({ status: 'ACTIVE', retiredAt: null, activeVehicles: 0 });
      expect(await onSite()).toBe(true);
      // Putting it back twice changes nothing.
      expect((await service.restore(view.slug)).updatedAt).toBe(back.updatedAt);
    });

    it('a booking that was made keeps showing a model that was retired afterwards', async () => {
      const view = await make('KEEP');
      const vehicle = await car('K1', view.slug);
      const past = await book('KEEP1', vehicle.id, days(-10), days(-9));
      await service.retire(view.slug);
      const row = await prisma.reservation.findUniqueOrThrow({
        where: { id: past.id },
        include: { vehicle: { include: { vehicleModel: true } } },
      });
      expect(row.vehicle.vehicleModel).toMatchObject({ slug: view.slug, brand: 'Deneme' });
    });

    it('the price is not worked out for a retired model, even for a car that was switched on by hand', async () => {
      const view = await make('NP');
      const vehicle = await car('N1', view.slug);
      await service.retire(view.slug);
      await prisma.vehicle.update({ where: { id: vehicle.id }, data: { active: true } });
      const request = parseReservationRequest({
        vehicleId: vehicle.id,
        pickupBranchId: ids.branchId,
        returnBranchId: ids.branchId,
        startAt: slotAt(60),
        endAt: slotAt(61),
        currency: 'TRY',
      });
      expect((await refused(new PricingService(prisma).calculate(prisma, request))).body).toMatchObject({
        fieldErrors: { vehicleId: 'UNKNOWN_REFERENCE' },
      });
    });

    it('does not exist: 404 for retiring or putting back what is not there', async () => {
      expect((await refused(service.retire('v29-yok-yok'))).status).toBe(404);
      expect((await refused(service.restore('v29-yok-yok'))).status).toBe(404);
    });
  });

  // A booking locks the car before anything else; the retiring locks the model and then its cars the same way. A booking that
  // is being made on one of them either finishes first (and the retiring sees it) or waits and finds the car switched off.
  describe('against a booking made at the same moment', () => {
    it('a retiring waits for the booking that holds the car, then sees it and refuses', async () => {
      const view = await make('RC');
      const vehicle = await car('C1', view.slug);
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
        await tx.$queryRaw`SELECT "id" FROM "Vehicle" WHERE "id" = ${vehicle.id} FOR UPDATE`;
        await tx.reservation.create({
          data: {
            number: `V29-${run}-RC`,
            startAt: days(7),
            endAt: days(8),
            days: 1,
            vehicleDailyPrice: 125000,
            totalPrice: 125000,
            vehicleId: vehicle.id,
            pickupBranchId: ids.branchId,
            returnBranchId: ids.branchId,
          },
        });
        events.push('booking made');
        locked();
        await held;
        events.push('booking commits');
      });
      await lockTaken;

      const retiring = refused(service.retire(view.slug)).then((answer) => {
        events.push('retiring answered');
        return answer;
      });
      await new Promise((resolve) => setTimeout(resolve, 400));
      expect(events).toEqual(['booking made']);

      release();
      await booking;
      const answer = await retiring;
      expect(events).toEqual(['booking made', 'booking commits', 'retiring answered']);
      expect(answer.body).toMatchObject({ code: 'IN_USE', details: { reservations: 1 } });
      expect((await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } })).active).toBe(true);
    });
  });
});
