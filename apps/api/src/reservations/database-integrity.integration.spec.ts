import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import type { UserRow } from '../auth/user-view.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DAY_MS, daysAhead } from './dates.testing.js';
import { PricingService } from './pricing.service.js';
import { ReservationsService } from './reservations.service.js';

// V2-11: the rules the database itself keeps (CHECK, foreign keys, the number sequence, indexes), tested by writing
// rows around the API. Runs only on a database whose name contains "test"; skipped without TEST_DATABASE_URL.
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !/test/i.test(databaseUrl)) {
  throw new Error('TEST_DATABASE_URL adında "test" geçen bir veritabanını göstermeli.');
}
const describeDb = databaseUrl ? describe : describe.skip;

const PARALLEL = 20;
const START = daysAhead(30);

describeDb('database integrity (gerçek PostgreSQL)', () => {
  let prisma: PrismaService;
  let service: ReservationsService;
  const run = randomUUID().slice(0, 8);
  const ids = { classId: '', modelId: '', branchId: '', extraId: '', userId: '' };
  const vehicleIds: string[] = [];
  const userIds: string[] = [];
  const created: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    service = new ReservationsService(prisma, new PricingService(prisma));

    const klass = await prisma.vehicleClass.create({ data: { slug: `i-sinif-${run}`, nameTr: 'T', nameEn: 'T' } });
    ids.classId = klass.id;
    const model = await prisma.vehicleModel.create({
      data: {
        slug: `i-model-${run}`, brand: 'Test', model: 'Model', seats: 5, bags: 3, transmission: 'AUTOMATIC',
        fuelType: 'PETROL', consumption: 5.5, consumptionUnit: 'L_PER_100KM', dailyPrice: 125000,
        description: { tr: 'Test', en: 'Test' }, classId: klass.id,
      },
    });
    ids.modelId = model.id;
    const branch = await prisma.branch.create({
      data: {
        name: `Test Bayi ${run}`, city: 'Test', address: 'Test', latitude: 1, longitude: 1,
        phone: '+90 000 000 00 00', email: `integrity-${run}@example.test`,
        openingHours: { weekdays: { open: '08:00', close: '20:00' } },
      },
    });
    ids.branchId = branch.id;
    ids.extraId = (await prisma.extra.create({ data: { slug: `i-extra-${run}`, nameTr: 'T', nameEn: 'T', price: 1000, pricing: 'FIXED' } })).id;
    for (let i = 0; i < PARALLEL; i += 1) {
      vehicleIds.push((await prisma.vehicle.create({ data: { plate: `I${run}${i}`, year: 2030, vehicleModelId: model.id, branchId: branch.id } })).id);
      userIds.push(
        (await prisma.user.create({ data: { email: `i${i}-${run}@example.test`, passwordHash: 'x', firstName: 'Test', lastName: 'Integrity' } })).id,
      );
    }
  });

  afterAll(async () => {
    await prisma.reservation.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
    await prisma.hold.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.vehicle.deleteMany({ where: { id: { in: vehicleIds } } });
    await prisma.extra.deleteMany({ where: { id: ids.extraId } });
    await prisma.branch.deleteMany({ where: { id: ids.branchId } });
    await prisma.vehicleModel.deleteMany({ where: { id: ids.modelId } });
    await prisma.vehicleClass.deleteMany({ where: { id: ids.classId } });
    await prisma.$disconnect();
  });

  const reservationData = (over: Record<string, unknown> = {}) => ({
    number: `ZZ-${run}-${created.length}`,
    startAt: START,
    endAt: new Date(START.getTime() + DAY_MS),
    days: 1,
    vehicleDailyPrice: 125000,
    totalPrice: 125000,
    vehicleId: vehicleIds[0]!,
    pickupBranchId: ids.branchId,
    returnBranchId: ids.branchId,
    ...over,
  });
  const insertReservation = async (over: Record<string, unknown> = {}) => {
    const row = await prisma.reservation.create({ data: reservationData(over) as never });
    created.push(row.id);
    return row;
  };
  const holdData = (over: Record<string, unknown> = {}) => ({
    startAt: START,
    endAt: new Date(START.getTime() + DAY_MS),
    expiresAt: new Date(Date.now() + 15 * 60_000),
    vehicleId: vehicleIds[0]!,
    pickupBranchId: ids.branchId,
    returnBranchId: ids.branchId,
    ...over,
  });

  it('20 bookings at the same moment get 20 different numbers in the usual format', async () => {
    const results = await Promise.all(
      userIds.map((userId, index) =>
        service.create({ id: userId } as unknown as UserRow, {
          vehicleId: vehicleIds[index]!,
          pickupBranchId: ids.branchId,
          returnBranchId: ids.branchId,
          startAt: START.toISOString(),
          endAt: new Date(START.getTime() + DAY_MS).toISOString(),
          currency: 'TRY',
        }),
      ),
    );
    const numbers = results.map((result) => result.number);
    expect(new Set(numbers).size).toBe(PARALLEL);
    for (const number of numbers) expect(number).toMatch(/^NVR-\d{4}-\d{5,}$/);
  });

  describe('CHECK constraints', () => {
    it('a reservation that ends before or when it starts is refused', async () => {
      await expect(insertReservation({ endAt: START })).rejects.toThrow(/Reservation_period_check/);
      await expect(insertReservation({ endAt: new Date(START.getTime() - DAY_MS) })).rejects.toThrow(/Reservation_period_check/);
    });

    it('a negative amount, a zero exchange rate or zero days is refused', async () => {
      await expect(insertReservation({ totalPrice: -1 })).rejects.toThrow(/Reservation_amounts_check/);
      await expect(insertReservation({ vehicleDailyPrice: -1 })).rejects.toThrow(/Reservation_amounts_check/);
      await expect(insertReservation({ discountAmount: -5 })).rejects.toThrow(/Reservation_amounts_check/);
      await expect(insertReservation({ pointsUsed: -1 })).rejects.toThrow(/Reservation_amounts_check/);
      await expect(insertReservation({ exchangeRate: 0 })).rejects.toThrow(/Reservation_amounts_check/);
      await expect(insertReservation({ days: 0 })).rejects.toThrow(/Reservation_days_check/);
    });

    it('a free booking (amount 0) is allowed', async () => {
      await expect(insertReservation({ totalPrice: 0 })).resolves.toMatchObject({ totalPrice: 0 });
    });

    it('an extra needs a quantity of at least 1 and no negative amount', async () => {
      const reservation = await insertReservation();
      const extra = (over: Record<string, unknown>) =>
        prisma.reservationExtra.create({ data: { reservationId: reservation.id, extraId: ids.extraId, unitPrice: 1000, totalPrice: 1000, ...over } as never });
      await expect(extra({ quantity: 0 })).rejects.toThrow(/ReservationExtra_quantity_check/);
      await expect(extra({ totalPrice: -1 })).rejects.toThrow(/ReservationExtra_amounts_check/);
      await expect(extra({ quantity: 1 })).resolves.toMatchObject({ quantity: 1 });
    });

    it('a hold that ends before or when it starts is refused', async () => {
      await expect(prisma.hold.create({ data: holdData({ endAt: START }) as never })).rejects.toThrow(/Hold_period_check/);
    });

    it('a negative catalog price is refused', async () => {
      await expect(prisma.vehicleModel.update({ where: { id: ids.modelId }, data: { dailyPrice: -1 } })).rejects.toThrow(/VehicleModel_dailyPrice_check/);
      await expect(prisma.extra.update({ where: { id: ids.extraId }, data: { price: -1 } })).rejects.toThrow(/Extra_price_check/);
    });
  });

  describe('foreign keys on holds', () => {
    it('a hold for a branch that does not exist is refused, for pickup and for return', async () => {
      await expect(prisma.hold.create({ data: holdData({ pickupBranchId: randomUUID() }) as never })).rejects.toThrow(/Hold_pickupBranchId_fkey|foreign key/i);
      await expect(prisma.hold.create({ data: holdData({ returnBranchId: randomUUID() }) as never })).rejects.toThrow(/Hold_returnBranchId_fkey|foreign key/i);
    });
  });

  describe('timestamps', () => {
    it('updatedAt moves on an update, and createdAt stays', async () => {
      const before = await prisma.branch.findUniqueOrThrow({ where: { id: ids.branchId } });
      await new Promise((resolve) => setTimeout(resolve, 15));
      const after = await prisma.branch.update({ where: { id: ids.branchId }, data: { name: `Test Bayi ${run} (2)` } });
      expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
      expect(after.createdAt.getTime()).toBe(before.createdAt.getTime());
    });
  });

  describe('indexes', () => {
    it('the lookups that were missing an index have one', async () => {
      const rows = await prisma.$queryRaw<{ indexname: string }[]>`SELECT indexname FROM pg_indexes WHERE schemaname = current_schema()`;
      const names = new Set(rows.map((row) => row.indexname));
      for (const name of [
        'Reservation_pickupBranchId_idx',
        'Reservation_returnBranchId_idx',
        'Reservation_userId_startAt_idx',
        'ReservationExtra_extraId_idx',
        'QuoteRequest_productId_idx',
      ]) {
        expect(names.has(name)).toBe(true);
      }
    });
  });
});
