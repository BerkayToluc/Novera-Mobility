import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module.js';
import { configureApp } from '../app.setup.js';
import { FALLBACK_RATES } from '../common/money.js';
import { DAY_MS } from '../common/time.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { daysAhead } from '../reservations/dates.testing.js';
import { testPlate } from '../common/plate.testing.js';

// V2-19 (QUALITY T-03): the catalog read through the whole application over HTTP, as the web server calls it: branches,
// models, extras, rates, and the search for vehicles with its 422 answers. Runs only on a database whose name contains
// "test"; skipped without TEST_DATABASE_URL.
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !/test/i.test(databaseUrl)) {
  throw new Error('TEST_DATABASE_URL adında "test" geçen bir veritabanını göstermeli.');
}
const describeDb = databaseUrl ? describe : describe.skip;

type Json = Record<string, any>;

describeDb('the catalog over HTTP (gerçek PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let base = '';
  const run = randomUUID().slice(0, 8);
  const ids = {
    classId: '',
    modelId: '',
    branchId: '',
    otherBranchId: '',
    vehicleId: '',
    extraId: '',
    cheapExtraId: '',
  };
  const START = daysAhead(20);
  const END = new Date(START.getTime() + 2 * DAY_MS);

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0);
    base = await app.getUrl();
    prisma = app.get(PrismaService);

    const klass = await prisma.vehicleClass.create({
      data: { slug: `cat-sinif-${run}`, nameTr: 'Katalog', nameEn: 'Catalog' },
    });
    ids.classId = klass.id;
    ids.modelId = (
      await prisma.vehicleModel.create({
        data: {
          slug: `cat-model-${run}`,
          brand: 'Test',
          model: `Katalog ${run}`,
          seats: 5,
          bags: 3,
          transmission: 'AUTOMATIC',
          fuelType: 'HYBRID',
          consumption: 4.5,
          consumptionUnit: 'L_PER_100KM',
          dailyPrice: 100000,
          description: { tr: 'Katalog aracı', en: 'Catalog car' },
          classId: klass.id,
        },
      })
    ).id;
    const branchData = (name: string) => ({
      name,
      city: 'Testville',
      address: 'Test adresi',
      latitude: 1,
      longitude: 1,
      phone: '+90 000 000 00 00',
      email: `cat-${run}@example.test`,
      openingHours: { weekdays: '08:30-19:00', saturday: '09:00-17:00', sunday: 'closed' },
    });
    ids.branchId = (await prisma.branch.create({ data: branchData(`Katalog bayi ${run}`) })).id;
    ids.otherBranchId = (await prisma.branch.create({ data: branchData(`Katalog bayi 2 ${run}`) })).id;
    ids.vehicleId = (
      await prisma.vehicle.create({
        data: { plate: testPlate(), year: 2026, vehicleModelId: ids.modelId, branchId: ids.branchId },
      })
    ).id;
    // A second car of the same model at the same branch: the list names the model once.
    await prisma.vehicle.create({
      data: { plate: testPlate(), year: 2026, vehicleModelId: ids.modelId, branchId: ids.branchId },
    });
    ids.extraId = (
      await prisma.extra.create({
        data: {
          slug: `cat-ekstra-${run}`,
          nameTr: 'Katalog ek',
          nameEn: 'Catalog extra',
          price: 50000,
          pricing: 'FIXED',
        },
      })
    ).id;
    ids.cheapExtraId = (
      await prisma.extra.create({
        data: { slug: `cat-ucuz-${run}`, nameTr: 'Ucuz ek', nameEn: 'Cheap extra', price: 1000, pricing: 'PER_DAY' },
      })
    ).id;
    // The rates table may be empty in a fresh test database; the same values the code falls back to keep other tests as they were.
    await prisma.exchangeRate.createMany({
      data: [
        { currency: 'EUR', ratePerTry: FALLBACK_RATES.EUR },
        { currency: 'USD', ratePerTry: FALLBACK_RATES.USD },
      ],
      skipDuplicates: true,
    });
  });

  afterAll(async () => {
    await prisma.reservation.deleteMany({
      where: { vehicle: { branchId: { in: [ids.branchId, ids.otherBranchId] } } },
    });
    await prisma.hold.deleteMany({ where: { vehicle: { branchId: ids.branchId } } });
    await prisma.vehicle.deleteMany({ where: { branchId: { in: [ids.branchId, ids.otherBranchId] } } });
    await prisma.branch.deleteMany({ where: { id: { in: [ids.branchId, ids.otherBranchId] } } });
    await prisma.vehicleModel.deleteMany({ where: { id: ids.modelId } });
    await prisma.vehicleClass.deleteMany({ where: { id: ids.classId } });
    await prisma.extra.deleteMany({ where: { id: { in: [ids.extraId, ids.cheapExtraId] } } });
    await app.close();
  });

  let hits = 0;
  const get = (path: string) =>
    fetch(base + path, { headers: { 'X-Forwarded-For': `10.19.${Math.floor(hits / 250)}.${(hits += 1) % 250}` } });
  const json = async (path: string): Promise<{ status: number; body: any }> => {
    const response = await get(path);
    return { status: response.status, body: await response.json() };
  };

  it('GET /branches lists a branch with its models, each model once, and the opening hours as stored', async () => {
    const { status, body } = await json('/branches');
    expect(status).toBe(200);
    const branch = (body as Json[]).find((entry) => entry.id === ids.branchId)!;
    expect(branch).toMatchObject({
      name: `Katalog bayi ${run}`,
      city: 'Testville',
      latitude: 1,
      longitude: 1,
      phone: '+90 000 000 00 00',
    });
    expect(branch.openingHours).toEqual({ weekdays: '08:30-19:00', saturday: '09:00-17:00', sunday: 'closed' });
    expect(branch.vehicleModels).toEqual([{ slug: `cat-model-${run}`, brand: 'Test', model: `Katalog ${run}` }]);
    // A branch with no vehicle has no models, and the list is in name order.
    expect((body as Json[]).find((entry) => entry.id === ids.otherBranchId)!.vehicleModels).toEqual([]);
    const names = (body as Json[]).map((entry) => entry.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('GET /vehicle-models lists the model with its class, its price in TRY and where it is', async () => {
    const { status, body } = await json('/vehicle-models');
    expect(status).toBe(200);
    const model = (body as Json[]).find((entry) => entry.slug === `cat-model-${run}`)!;
    expect(model).toMatchObject({
      brand: 'Test',
      seats: 5,
      bags: 3,
      transmission: 'AUTOMATIC',
      fuelType: 'HYBRID',
      consumption: { value: 4.5, unit: 'L_PER_100KM' },
      class: { slug: `cat-sinif-${run}`, name: { tr: 'Katalog', en: 'Catalog' } },
      description: { tr: 'Katalog aracı', en: 'Catalog car' },
      fromDailyPrice: { amount: 100000, currency: 'TRY' },
    });
    expect(model.branches).toEqual([{ id: ids.branchId, name: `Katalog bayi ${run}`, city: 'Testville' }]);
  });

  it('converts prices with the stored rate, before rounding to the smallest unit', async () => {
    const rates = (await json('/rates')).body as Json[];
    const eur = Number(rates.find((entry) => entry.currency === 'EUR')!.ratePerTry);
    const { body } = await json('/vehicle-models?currency=EUR');
    const model = (body as Json[]).find((entry) => entry.slug === `cat-model-${run}`)!;
    expect(model.fromDailyPrice).toEqual({ amount: Math.round(100000 * eur), currency: 'EUR' });
  });

  it('answers 422 for a currency outside the list, on every endpoint that takes one', async () => {
    const answers: Record<string, unknown> = {};
    for (const path of ['/vehicle-models?currency=GBP', '/extras?currency=gbp', '/vehicles?currency=XXX']) {
      const { status, body } = await json(path);
      answers[path] = [status, body.fieldErrors?.currency];
    }
    expect(answers).toEqual({
      '/vehicle-models?currency=GBP': [422, 'INVALID_FORMAT'],
      '/extras?currency=gbp': [422, 'INVALID_FORMAT'],
      '/vehicles?currency=XXX': [422, 'INVALID_FORMAT'],
    });
  });

  it('GET /extras lists the extras cheapest first, in the asked currency', async () => {
    const { status, body } = await json('/extras');
    expect(status).toBe(200);
    const list = (body as Json[]).filter((entry) => entry.slug.endsWith(run));
    expect(list.map((entry) => entry.slug)).toEqual([`cat-ucuz-${run}`, `cat-ekstra-${run}`]);
    expect(list[1]).toMatchObject({
      name: { tr: 'Katalog ek', en: 'Catalog extra' },
      price: { amount: 50000, currency: 'TRY' },
      pricing: 'FIXED',
    });
    expect(list[0]).toMatchObject({ pricing: 'PER_DAY' });
    const usd = ((await json('/extras?currency=USD')).body as Json[]).find(
      (entry) => entry.slug === `cat-ekstra-${run}`,
    )!;
    expect(usd.price.currency).toBe('USD');
  });

  it('GET /rates gives each foreign currency a positive rate and when it was stored', async () => {
    const { status, body } = await json('/rates');
    expect(status).toBe(200);
    expect((body as Json[]).map((entry) => entry.currency)).toEqual(expect.arrayContaining(['EUR', 'USD']));
    for (const entry of body as Json[]) {
      expect(entry.ratePerTry).toBeGreaterThan(0);
      expect(new Date(entry.updatedAt).toISOString()).toBe(entry.updatedAt);
    }
  });

  describe('GET /vehicles', () => {
    const query = (over: Record<string, string> = {}) =>
      '/vehicles?' +
      new URLSearchParams({
        pickupBranchId: ids.branchId,
        returnBranchId: ids.otherBranchId,
        startAt: START.toISOString(),
        endAt: END.toISOString(),
        ...over,
      }).toString();

    it('offers the model once, with the days and the price of the whole period', async () => {
      const { status, body } = await json(query());
      expect(status).toBe(200);
      const offer = (body as Json[]).find((entry) => entry.model.slug === `cat-model-${run}`)!;
      expect(body.filter((entry: Json) => entry.model.slug === `cat-model-${run}`)).toHaveLength(1);
      expect(offer).toMatchObject({
        days: 2,
        dailyPrice: { amount: 100000, currency: 'TRY' },
        totalPrice: { amount: 200000, currency: 'TRY' },
      });
      expect(offer.branch).toEqual({ id: ids.branchId, name: `Katalog bayi ${run}`, city: 'Testville' });
    });

    it('does not offer the model once every car of it is taken for the period', async () => {
      const cars = await prisma.vehicle.findMany({ where: { vehicleModelId: ids.modelId, branchId: ids.branchId } });
      const rows = cars.map((car, index) => ({
        number: `CAT-${run}-${index}`,
        startAt: START,
        endAt: END,
        days: 2,
        vehicleDailyPrice: 100000,
        totalPrice: 200000,
        vehicleId: car.id,
        pickupBranchId: ids.branchId,
        returnBranchId: ids.branchId,
      }));
      await prisma.reservation.createMany({ data: rows });
      expect((await json(query())).body.filter((entry: Json) => entry.model.slug === `cat-model-${run}`)).toHaveLength(
        0,
      );
      // The day after the period it is free again: the end is not part of it.
      const later = await json(
        query({ startAt: END.toISOString(), endAt: new Date(END.getTime() + DAY_MS).toISOString() }),
      );
      expect(later.body.filter((entry: Json) => entry.model.slug === `cat-model-${run}`)).toHaveLength(1);
      await prisma.reservation.deleteMany({ where: { number: { startsWith: `CAT-${run}` } } });
    });

    it('answers 422 with the field when something is missing, wrong or unknown', async () => {
      const missing = await json('/vehicles');
      expect(missing.status).toBe(422);
      expect(Object.keys(missing.body.fieldErrors).sort()).toEqual([
        'endAt',
        'pickupBranchId',
        'returnBranchId',
        'startAt',
      ]);

      const unknown = await json(query({ pickupBranchId: randomUUID() }));
      expect(unknown.status).toBe(422);
      expect(unknown.body.fieldErrors).toEqual({ pickupBranchId: 'UNKNOWN_REFERENCE' });

      const notAnId = await json(query({ pickupBranchId: 'not-an-id' }));
      expect(notAnId.status).toBe(422);
      expect(notAnId.body.fieldErrors.pickupBranchId).toBe('INVALID_FORMAT');

      const backwards = await json(query({ startAt: END.toISOString(), endAt: START.toISOString() }));
      expect(backwards.status).toBe(422);
      expect(backwards.body.fieldErrors.endAt).toBeDefined();

      const past = await json(query({ startAt: daysAhead(-3).toISOString(), endAt: daysAhead(-1).toISOString() }));
      expect(past.status).toBe(422);
      expect(past.body.fieldErrors.startAt).toBe('IN_PAST');
    });
  });
});
