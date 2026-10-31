import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { testPlate } from '../../common/plate.testing.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AdminContractsService } from './contracts.service.js';

// The contracts, fleet cars and readings of the administration (V2-35) against a real PostgreSQL (TEST_DATABASE_URL), like the other
// integration tests; skipped without one.
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

describeDb('contract and fleet car administration against the database (V2-35)', () => {
  let prisma: PrismaService;
  let service: AdminContractsService;
  const run = randomUUID().slice(0, 8);
  const ids = { classId: '', modelId: '', modelSlug: `v35-model-${run}`, productSlug: `v35-urun-${run}`, productId: '', branchId: '', companyId: '' };
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  const contract = (extra: Record<string, unknown> = {}) =>
    service.create(ids.companyId, { productSlug: ids.productSlug, startAt: day(-30), endAt: day(335), monthlyFee: 4_500_000, deliveryCity: 'İzmir', ...extra });

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    service = new AdminContractsService(prisma);
    ids.classId = (await prisma.vehicleClass.create({ data: { slug: `v35-sinif-${run}`, nameTr: 'T', nameEn: 'T' } })).id;
    ids.modelId = (
      await prisma.vehicleModel.create({
        data: {
          slug: ids.modelSlug,
          brand: 'Test',
          model: 'Filo',
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
    ids.productId = (await prisma.product.create({ data: { slug: ids.productSlug } })).id;
    ids.branchId = (
      await prisma.branch.create({
        data: { name: `Filo Bayi ${run}`, city: 'Test', address: 'Test', latitude: 1, longitude: 1, phone: '+90 000 000 00 00', email: `filo-${run}@example.test`, openingHours: { weekdays: { open: '08:00', close: '20:00' } } },
      })
    ).id;
    ids.companyId = (await prisma.company.create({ data: { name: `V35 Firma ${run}` } })).id;
  });

  afterAll(async () => {
    const vehicles = await prisma.fleetVehicle.findMany({ where: { companyId: ids.companyId }, select: { id: true } });
    const vehicleIds = vehicles.map((row) => row.id);
    await prisma.vehicleReading.deleteMany({ where: { fleetVehicleId: { in: vehicleIds } } });
    await prisma.vehicleAssignment.deleteMany({ where: { companyId: ids.companyId } });
    await prisma.fleetVehicle.deleteMany({ where: { companyId: ids.companyId } });
    await prisma.fleetContract.deleteMany({ where: { companyId: ids.companyId } });
    await prisma.companyEmployee.deleteMany({ where: { companyId: ids.companyId } });
    await prisma.vehicle.deleteMany({ where: { branchId: ids.branchId } });
    await prisma.company.deleteMany({ where: { id: ids.companyId } });
    await prisma.product.deleteMany({ where: { id: ids.productId } });
    await prisma.branch.deleteMany({ where: { id: ids.branchId } });
    await prisma.vehicleModel.deleteMany({ where: { id: ids.modelId } });
    await prisma.vehicleClass.deleteMany({ where: { id: ids.classId } });
    await prisma.$disconnect();
  });

  describe('making a contract', () => {
    it('numbers it from a sequence (SZL-year-5 digits, one after the other), and lists the company’s contracts', async () => {
      const first = await contract();
      const second = await contract({ deliveryCity: 'Ankara' });
      expect(first).toMatchObject({ productSlug: ids.productSlug, startAt: day(-30), endAt: day(335), monthlyFee: 4_500_000, deliveryCity: 'İzmir', status: 'ACTIVE', vehicleCount: 0, company: { id: ids.companyId } });
      expect(first.number).toMatch(/^SZL-\d{4}-\d{5,}$/);
      expect(first.remainingDays).toBe(335);
      const serial = (number: string) => Number(number.split('-')[2]);
      expect(serial(second.number)).toBeGreaterThan(serial(first.number));

      const list = await service.listForCompany(ids.companyId);
      expect(list.items.map((row) => row.number)).toEqual(expect.arrayContaining([first.number, second.number]));
    });

    it('two made at the same moment never share a number', async () => {
      const both = await Promise.all([contract(), contract(), contract()]);
      expect(new Set(both.map((row) => row.number)).size).toBe(3);
    });

    it('is 422 for what is not right, with a code for each field, and writes nothing', async () => {
      const before = (await service.listForCompany(ids.companyId)).items.length;
      const answer = await refused(service.create(ids.companyId, { productSlug: 'yok-' + run, startAt: day(10), endAt: day(5), monthlyFee: 0, deliveryCity: 'Atlantis' }));
      expect(answer.status).toBe(422);
      expect(answer.body.fieldErrors).toMatchObject({ monthlyFee: 'OUT_OF_RANGE', deliveryCity: 'INVALID_FORMAT' });
      expect((await refused(service.create(ids.companyId, { productSlug: 'yok-' + run, startAt: day(1), endAt: day(9), monthlyFee: 100, deliveryCity: 'Ankara' }))).body.fieldErrors).toEqual({ productSlug: 'UNKNOWN_REFERENCE' });
      expect((await refused(contract({ startAt: day(10), endAt: day(10) }))).body.fieldErrors).toEqual({ endAt: 'INVALID_DATE_RANGE' });
      expect((await refused(contract({ startAt: '2026-02-30' }))).body.fieldErrors).toEqual({ startAt: 'INVALID_FORMAT' });
      expect((await service.listForCompany(ids.companyId)).items).toHaveLength(before);
    });

    it('is 404 for a company that is not there or cannot be one', async () => {
      expect((await refused(service.create(randomUUID(), { productSlug: ids.productSlug, startAt: day(1), endAt: day(9), monthlyFee: 100, deliveryCity: 'Ankara' }))).status).toBe(404);
      expect((await refused(service.listForCompany('not-an-id'))).status).toBe(404);
    });

    it('the database itself refuses a contract that ends before it starts or has no fee', async () => {
      const number = 'SZL-2099-' + String(Math.floor(Math.random() * 90000) + 10000);
      const base = { number, companyId: ids.companyId, productId: ids.productId, deliveryCity: 'Ankara' };
      await expect(prisma.fleetContract.create({ data: { ...base, startAt: new Date('2090-02-01'), endAt: new Date('2090-01-01'), monthlyFee: 100 } })).rejects.toThrow();
      await expect(prisma.fleetContract.create({ data: { ...base, startAt: new Date('2090-01-01'), endAt: new Date('2090-02-01'), monthlyFee: 0 } })).rejects.toThrow();
    });
  });

  describe('changing a contract', () => {
    it('changes only what is sent, moves the version on, and refuses a copy that is old', async () => {
      const made = await contract();
      const changed = await service.update(made.number.toLowerCase(), { updatedAt: made.updatedAt, monthlyFee: 5_000_000, endAt: day(400) });
      expect(changed).toMatchObject({ monthlyFee: 5_000_000, endAt: day(400), deliveryCity: 'İzmir' });
      expect(changed.updatedAt > made.updatedAt).toBe(true);
      const stale = await refused(service.update(made.number, { updatedAt: made.updatedAt, monthlyFee: 1 }));
      expect(stale).toMatchObject({ status: 409, body: { code: 'STALE_WRITE' } });
      expect((await service.get(made.number)).monthlyFee).toBe(5_000_000);
    });

    it('cannot end before it starts, and a contract with cars still in use is not ended', async () => {
      const made = await contract();
      expect((await refused(service.update(made.number, { updatedAt: made.updatedAt, endAt: day(-31) }))).body.fieldErrors).toEqual({ endAt: 'INVALID_DATE_RANGE' });

      const car = await service.createVehicle(made.number, { modelSlug: ids.modelSlug, plate: testPlate(), year: 2025, startKm: 100 });
      const blocked = await refused(service.update(made.number, { updatedAt: made.updatedAt, status: 'ENDED' }));
      expect(blocked).toMatchObject({ status: 409, body: { code: 'IN_USE', details: { vehicles: 1 } } });

      const given = await service.updateVehicle(car.id, { updatedAt: car.updatedAt, returned: true });
      expect(given.status).toBe('RETURNED');
      const ended = await service.update(made.number, { updatedAt: made.updatedAt, status: 'ENDED' });
      expect(ended).toMatchObject({ status: 'ENDED', remainingDays: 0, vehicleCount: 0 });
      // No car is added to a contract that has ended.
      expect((await refused(service.createVehicle(made.number, { modelSlug: ids.modelSlug, plate: testPlate(), year: 2025, startKm: 0 }))).body).toMatchObject({ code: 'INVALID_TRANSITION' });
    });

    it('is 404 for a number that is not there or cannot be one', async () => {
      for (const number of ['SZL-2099-99999', 'nope']) {
        expect((await refused(service.get(number))).status).toBe(404);
        expect((await refused(service.update(number, { updatedAt: new Date().toISOString() }))).status).toBe(404);
      }
    });
  });

  describe('fleet cars', () => {
    it('adds a car to a contract, in the form of the plate that is stored, with the contract’s company, and lists it with the contract', async () => {
      const made = await contract();
      const plate = testPlate();
      const car = await service.createVehicle(made.number, { modelSlug: ids.modelSlug, plate: plate.replace(/ /g, '').toLowerCase(), year: 2025, startKm: 1200, nextMaintenanceOn: day(60), inspectionDueOn: day(200) });
      expect(car).toMatchObject({
        plate,
        model: { slug: ids.modelSlug, brand: 'Test', model: 'Filo' },
        year: 2025,
        status: 'ACTIVE',
        startKm: 1200,
        lastKm: 1200,
        lastReadingAt: null,
        assignee: null,
        nextMaintenanceOn: day(60),
        inspectionDueOn: day(200),
        contract: { number: made.number, productSlug: ids.productSlug },
      });
      const stored = await prisma.fleetVehicle.findUniqueOrThrow({ where: { id: car.id } });
      expect(stored.companyId).toBe(ids.companyId);
      const detail = await service.get(made.number);
      expect(detail.vehicleCount).toBe(1);
      expect(detail.vehicles.map((row) => row.plate)).toEqual([plate]);
    });

    it('does not take a plate that a fleet car or a rented car has, in whatever way it is typed: 409 PLATE_TAKEN', async () => {
      const made = await contract();
      const plate = testPlate();
      await service.createVehicle(made.number, { modelSlug: ids.modelSlug, plate, year: 2025, startKm: 0 });
      const again = await refused(service.createVehicle(made.number, { modelSlug: ids.modelSlug, plate: plate.replace(/ /g, '-'), year: 2025, startKm: 0 }));
      expect(again).toMatchObject({ status: 409, body: { code: 'PLATE_TAKEN', fieldErrors: { plate: 'PLATE_TAKEN' } } });

      const rentedPlate = testPlate();
      await prisma.vehicle.create({ data: { plate: rentedPlate, year: 2030, vehicleModelId: ids.modelId, branchId: ids.branchId } });
      const rented = await refused(service.createVehicle(made.number, { modelSlug: ids.modelSlug, plate: rentedPlate, year: 2025, startKm: 0 }));
      expect(rented).toMatchObject({ status: 409, body: { code: 'PLATE_TAKEN' } });
      expect(await prisma.fleetVehicle.count({ where: { plate: rentedPlate } })).toBe(0);
    });

    it('is 422 for a plate, a year, a kilometre or a model that is not right', async () => {
      const made = await contract();
      const answer = await refused(service.createVehicle(made.number, { modelSlug: 'yok-' + run, plate: 'abc', year: 1990, startKm: -1 }));
      expect(answer.status).toBe(422);
      expect(answer.body.fieldErrors).toMatchObject({ plate: 'INVALID_FORMAT', year: 'OUT_OF_RANGE', startKm: 'OUT_OF_RANGE' });
      expect((await refused(service.createVehicle(made.number, { modelSlug: 'yok-' + run, plate: testPlate(), year: 2025, startKm: 0 }))).body.fieldErrors).toEqual({ modelSlug: 'UNKNOWN_REFERENCE' });
    });

    it('changes the two dates (and clears one), and giving the car back ends its assignment and closes the car to changes', async () => {
      const made = await contract();
      const car = await service.createVehicle(made.number, { modelSlug: ids.modelSlug, plate: testPlate(), year: 2025, startKm: 10, nextMaintenanceOn: day(30) });
      const changed = await service.updateVehicle(car.id, { updatedAt: car.updatedAt, nextMaintenanceOn: null, inspectionDueOn: day(90) });
      expect(changed).toMatchObject({ nextMaintenanceOn: null, inspectionDueOn: day(90) });
      expect((await refused(service.updateVehicle(car.id, { updatedAt: car.updatedAt, inspectionDueOn: day(1) }))).body).toMatchObject({ code: 'STALE_WRITE' });

      const employee = await prisma.companyEmployee.create({ data: { companyId: ids.companyId, firstName: 'Kişi', lastName: run } });
      await prisma.vehicleAssignment.create({ data: { companyId: ids.companyId, fleetVehicleId: car.id, employeeId: employee.id, startedAt: new Date(Date.now() - 86_400_000) } });
      const returned = await service.updateVehicle(car.id, { updatedAt: changed.updatedAt, returned: true });
      expect(returned).toMatchObject({ status: 'RETURNED', assignee: null });
      expect(returned.returnedAt).toEqual(expect.any(String));
      expect(await prisma.vehicleAssignment.count({ where: { fleetVehicleId: car.id, endedAt: null } })).toBe(0);
      // A car that has been given back is history.
      expect((await refused(service.updateVehicle(car.id, { updatedAt: returned.updatedAt, inspectionDueOn: day(5) }))).body).toMatchObject({ code: 'INVALID_TRANSITION' });
      expect((await refused(service.updateVehicle(car.id, { updatedAt: returned.updatedAt, returned: false }))).status).toBe(422);
    });

    it('is 404 for a car that is not there or cannot be one', async () => {
      for (const id of [randomUUID(), 'not-an-id']) {
        expect((await refused(service.updateVehicle(id, { updatedAt: new Date().toISOString(), inspectionDueOn: day(5) }))).status).toBe(404);
        expect((await refused(service.addReading(id, { km: 10 }))).status).toBe(404);
      }
    });
  });

  describe('readings', () => {
    it('takes a reading, and the car’s last kilometre follows it; the kilometre and the time do not go back', async () => {
      const made = await contract();
      const car = await service.createVehicle(made.number, { modelSlug: ids.modelSlug, plate: testPlate(), year: 2025, startKm: 500 });
      const reading = await service.addReading(car.id, { km: 800, fuelPercent: 60, chargePercent: null, batteryHealthPercent: 97 });
      expect(reading).toMatchObject({ km: 800, fuelPercent: 60, chargePercent: null, batteryHealthPercent: 97, source: 'MANUAL' });
      expect((await service.get(made.number)).vehicles[0]).toMatchObject({ lastKm: 800, lastReadingAt: reading.at });

      expect((await refused(service.addReading(car.id, { km: 799 }))).body.fieldErrors).toEqual({ km: 'OUT_OF_RANGE' });
      expect((await refused(service.addReading(car.id, { km: 900, at: new Date(Date.now() - 3_600_000).toISOString() }))).body.fieldErrors).toEqual({ at: 'OUT_OF_RANGE' });
      expect((await refused(service.addReading(car.id, { km: 900, at: new Date(Date.now() + 3_600_000).toISOString() }))).body.fieldErrors).toEqual({ at: 'OUT_OF_RANGE' });
      // The same kilometre is a reading too (the car did not move).
      expect((await service.addReading(car.id, { km: 800 })).km).toBe(800);
    });

    it('is 422 for a kilometre or a percentage that is not right, and the database refuses them as well', async () => {
      const made = await contract();
      const car = await service.createVehicle(made.number, { modelSlug: ids.modelSlug, plate: testPlate(), year: 2025, startKm: 0 });
      const answer = await refused(service.addReading(car.id, { km: 1.5, fuelPercent: 101, chargePercent: -1, batteryHealthPercent: 'a lot' }));
      expect(answer.status).toBe(422);
      expect(answer.body.fieldErrors).toEqual({ km: 'INVALID_FORMAT', fuelPercent: 'OUT_OF_RANGE', chargePercent: 'OUT_OF_RANGE', batteryHealthPercent: 'INVALID_FORMAT' });
      await expect(prisma.vehicleReading.create({ data: { fleetVehicleId: car.id, km: 10, fuelPercent: 101 } })).rejects.toThrow();
    });

    it('takes no reading from a car that has been given back', async () => {
      const made = await contract();
      const car = await service.createVehicle(made.number, { modelSlug: ids.modelSlug, plate: testPlate(), year: 2025, startKm: 0 });
      await service.updateVehicle(car.id, { updatedAt: car.updatedAt, returned: true });
      expect((await refused(service.addReading(car.id, { km: 10 }))).body).toMatchObject({ code: 'INVALID_TRANSITION' });
    });
  });
});
