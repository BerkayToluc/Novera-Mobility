import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import type { UserRow } from '../auth/user-view.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DAY_MS, daysAhead } from './dates.testing.js';
import { PricingService } from './pricing.service.js';
import { ReservationsService } from './reservations.service.js';
import { testPlate } from '../common/plate.testing.js';

// Integration test against a real PostgreSQL (QUALITY G-04): a campaign code's total cap and its one-use-per-person
// rule must hold when bookings arrive at the same moment, and a cancelled booking gives the code back.
// Runs only on a database whose name contains "test"; skipped without TEST_DATABASE_URL.
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !/test/i.test(databaseUrl)) {
  throw new Error('TEST_DATABASE_URL adında "test" geçen bir veritabanını göstermeli.');
}
const describeDb = databaseUrl ? describe : describe.skip;

const VEHICLES = 4;

describeDb('campaign code caps (gerçek PostgreSQL)', () => {
  let prisma: PrismaService;
  let service: ReservationsService;
  let pricing: PricingService;
  const run = randomUUID().slice(0, 8);
  let branchId = '';
  const vehicleIds: string[] = [];
  const users: UserRow[] = [];
  const ids = { classId: '', modelId: '' };
  const codes: string[] = [];

  const newCode = async (data: { maxRedemptions?: number | null; oncePerUser?: boolean }) => {
    const code = `P${randomUUID().replace(/-/g, '').slice(0, 9).toUpperCase()}`;
    await prisma.promoCode.create({ data: { code, percent: 10, ...data } });
    codes.push(code);
    return code;
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    pricing = new PricingService(prisma);
    service = new ReservationsService(prisma, pricing);

    const klass = await prisma.vehicleClass.create({ data: { slug: `p-sinif-${run}`, nameTr: 'T', nameEn: 'T' } });
    ids.classId = klass.id;
    const model = await prisma.vehicleModel.create({
      data: {
        slug: `p-model-${run}`,
        brand: 'Test',
        model: 'Model',
        seats: 5,
        bags: 3,
        transmission: 'AUTOMATIC',
        fuelType: 'PETROL',
        consumption: 5.5,
        consumptionUnit: 'L_PER_100KM',
        dailyPrice: 125000,
        description: { tr: 'Test', en: 'Test' },
        classId: klass.id,
      },
    });
    ids.modelId = model.id;
    const branch = await prisma.branch.create({
      data: {
        name: `Test Bayi ${run}`,
        city: 'Test',
        address: 'Test',
        latitude: 1,
        longitude: 1,
        phone: '+90 000 000 00 00',
        email: `promo-${run}@example.test`,
        openingHours: { weekdays: { open: '08:00', close: '20:00' } },
      },
    });
    branchId = branch.id;
    for (let i = 0; i < VEHICLES; i += 1) {
      const vehicle = await prisma.vehicle.create({
        data: { plate: testPlate(), year: 2030, vehicleModelId: model.id, branchId: branch.id },
      });
      vehicleIds.push(vehicle.id);
    }
    for (const name of ['a', 'b']) {
      const created = await prisma.user.create({
        data: {
          email: `p-${name}-${run}@example.test`,
          passwordHash: 'x',
          firstName: 'Test',
          lastName: name,
          accountType: 'INDIVIDUAL',
        },
      });
      users.push(created as unknown as UserRow);
    }
  });

  afterAll(async () => {
    await prisma.promoCode.deleteMany({ where: { code: { in: codes } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    await prisma.reservation.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
    await prisma.vehicle.deleteMany({ where: { id: { in: vehicleIds } } });
    await prisma.branch.deleteMany({ where: { id: branchId } });
    await prisma.vehicleModel.deleteMany({ where: { id: ids.modelId } });
    await prisma.vehicleClass.deleteMany({ where: { id: ids.classId } });
    await prisma.$disconnect();
  });

  // Every test starts without bookings, so one test's bookings neither occupy a car nor count toward the 3-booking cap.
  beforeEach(async () => {
    await prisma.reservation.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
  });

  const body = (vehicleIndex: number, promoCode: string, startDays = 30) => {
    const startAt = daysAhead(startDays);
    return {
      vehicleId: vehicleIds[vehicleIndex]!,
      pickupBranchId: branchId,
      returnBranchId: branchId,
      startAt: startAt.toISOString(),
      endAt: new Date(startAt.getTime() + DAY_MS).toISOString(),
      currency: 'TRY',
      promoCode,
    };
  };
  const fieldErrorOf = (error: unknown) => {
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(422);
    return ((error as HttpException).getResponse() as { fieldErrors: Record<string, string> }).fieldErrors.promoCode;
  };

  it('a code with a cap of 1 goes to only one of two simultaneous bookings; the other gets CODE_EXHAUSTED', async () => {
    const code = await newCode({ maxRedemptions: 1, oncePerUser: false });
    const results = await Promise.allSettled([
      service.create(users[0]!, body(0, code)),
      service.create(users[1]!, body(1, code)),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(fieldErrorOf(failed[0]!.reason)).toBe('CODE_EXHAUSTED');
    expect(await prisma.reservation.count({ where: { promoCode: code, status: 'CONFIRMED' } })).toBe(1);
  });

  it('with the cap spent, the price says "not applied" and looks like a code that does not exist', async () => {
    const code = await newCode({ maxRedemptions: 1, oncePerUser: false });
    await service.create(users[0]!, body(0, code));
    const exhausted = await pricing.price(body(2, code));
    const missing = await pricing.price(body(2, 'NOSUCHCODE1'));
    expect(exhausted.promo).toEqual({ code, applied: false, percent: null });
    expect(Object.keys(exhausted.promo!).sort()).toEqual(Object.keys(missing.promo!).sort());
  });

  it('the same person cannot use a code twice (CODE_ALREADY_USED) until the first booking is cancelled', async () => {
    const code = await newCode({ oncePerUser: true });
    const first = await service.create(users[0]!, body(0, code, 40));
    const error = await service.create(users[0]!, body(1, code, 41)).catch((e: unknown) => e);
    expect(fieldErrorOf(error)).toBe('CODE_ALREADY_USED');

    // Another account is not affected.
    await expect(service.create(users[1]!, body(1, code, 41))).resolves.toMatchObject({ status: 'CONFIRMED' });

    await service.cancel(users[0]!.id, first.id, new Date());
    await expect(service.create(users[0]!, body(0, code, 40))).resolves.toMatchObject({ status: 'CONFIRMED' });
  });

  it('a cancelled booking gives a capped code back to everyone', async () => {
    const code = await newCode({ maxRedemptions: 1, oncePerUser: false });
    const first = await service.create(users[0]!, body(2, code, 50));
    expect(fieldErrorOf(await service.create(users[1]!, body(3, code, 50)).catch((e: unknown) => e))).toBe(
      'CODE_EXHAUSTED',
    );
    await service.cancel(users[0]!.id, first.id, new Date());
    await expect(service.create(users[1]!, body(3, code, 50))).resolves.toMatchObject({ status: 'CONFIRMED' });
  });

  it('with oncePerUser off and no cap, one person may use the code again and again', async () => {
    const code = await newCode({ oncePerUser: false });
    await service.create(users[1]!, body(0, code, 60));
    await expect(service.create(users[1]!, body(1, code, 61))).resolves.toMatchObject({ status: 'CONFIRMED' });
  });
});
