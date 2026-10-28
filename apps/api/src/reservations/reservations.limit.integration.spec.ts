import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import type { UserRow } from '../auth/user-view.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DAY_MS, daysAhead } from './dates.testing.js';
import { PricingService } from './pricing.service.js';
import { MAX_ACTIVE_RESERVATIONS, ReservationsService } from './reservations.service.js';

// Integration test against a real PostgreSQL (QUALITY G-02, G-16): the cap on upcoming bookings must hold when
// requests arrive at the same moment, and a hold id must not open someone else's hold.
// Runs only on a database whose name contains "test"; skipped without TEST_DATABASE_URL.
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !/test/i.test(databaseUrl)) {
  throw new Error('TEST_DATABASE_URL adında "test" geçen bir veritabanını göstermeli.');
}
const describeDb = databaseUrl ? describe : describe.skip;

const VEHICLES = 8;
const START = daysAhead(30);

describeDb('reservation cap and hold ownership (gerçek PostgreSQL)', () => {
  let prisma: PrismaService;
  let service: ReservationsService;
  const run = randomUUID().slice(0, 8);
  let branchId = '';
  let user: UserRow;
  const vehicleIds: string[] = [];
  const ids = { classId: '', modelId: '', userId: '' };

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    service = new ReservationsService(prisma, new PricingService(prisma));

    const klass = await prisma.vehicleClass.create({ data: { slug: `l-sinif-${run}`, nameTr: 'T', nameEn: 'T' } });
    ids.classId = klass.id;
    const model = await prisma.vehicleModel.create({
      data: {
        slug: `l-model-${run}`,
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
        email: `limit-${run}@example.test`,
        openingHours: { weekdays: { open: '08:00', close: '20:00' } },
      },
    });
    branchId = branch.id;
    for (let i = 0; i < VEHICLES; i += 1) {
      const vehicle = await prisma.vehicle.create({
        data: { plate: `L${run}${i}`, year: 2030, vehicleModelId: model.id, branchId: branch.id },
      });
      vehicleIds.push(vehicle.id);
    }
    const created = await prisma.user.create({
      data: {
        email: `l-${run}@example.test`,
        passwordHash: 'x',
        firstName: 'Test',
        lastName: 'Limit',
        accountType: 'INDIVIDUAL',
      },
    });
    ids.userId = created.id;
    user = created as unknown as UserRow;
  });

  afterAll(async () => {
    await prisma.hold.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
    await prisma.user.deleteMany({ where: { id: ids.userId } });
    await prisma.reservation.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
    await prisma.vehicle.deleteMany({ where: { id: { in: vehicleIds } } });
    await prisma.branch.deleteMany({ where: { id: branchId } });
    await prisma.vehicleModel.deleteMany({ where: { id: ids.modelId } });
    await prisma.vehicleClass.deleteMany({ where: { id: ids.classId } });
    await prisma.$disconnect();
  });

  const body = (vehicleId: string, startAt = START, days = 1) => ({
    vehicleId,
    pickupBranchId: branchId,
    returnBranchId: branchId,
    startAt: startAt.toISOString(),
    endAt: new Date(startAt.getTime() + days * DAY_MS).toISOString(),
    currency: 'TRY',
  });
  const activeCount = () => prisma.reservation.count({ where: { userId: ids.userId, status: 'CONFIRMED' } });

  it('simultaneous bookings on different cars still stop at the cap', async () => {
    const results = await Promise.allSettled(vehicleIds.map((id) => service.create(user, body(id))));
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(ok).toHaveLength(MAX_ACTIVE_RESERVATIONS);
    expect(failed).toHaveLength(VEHICLES - MAX_ACTIVE_RESERVATIONS);
    for (const f of failed) {
      expect(f.reason).toBeInstanceOf(HttpException);
      expect((f.reason as HttpException).getStatus()).toBe(422);
      expect(((f.reason as HttpException).getResponse() as { code: string }).code).toBe('RESERVATION_LIMIT');
    }
    expect(await activeCount()).toBe(MAX_ACTIVE_RESERVATIONS);
  });

  it('cancelling one booking opens a place again', async () => {
    const mine = await service.listMine(ids.userId);
    await service.cancel(ids.userId, mine[0]!.id, new Date());
    expect(await activeCount()).toBe(MAX_ACTIVE_RESERVATIONS - 1);
    const free = vehicleIds[VEHICLES - 1]!;
    await expect(service.create(user, body(free, daysAhead(50)))).resolves.toMatchObject({ status: 'CONFIRMED' });
    expect(await activeCount()).toBe(MAX_ACTIVE_RESERVATIONS);
  });

  it('a hold made by another client does not open for this one, and stays', async () => {
    await prisma.reservation.deleteMany({ where: { userId: ids.userId } });
    const vehicleId = vehicleIds[0]!;
    const startAt = daysAhead(90);
    const hold = await prisma.hold.create({
      data: {
        vehicleId,
        pickupBranchId: branchId,
        returnBranchId: branchId,
        startAt,
        endAt: new Date(startAt.getTime() + DAY_MS),
        expiresAt: new Date(Date.now() + 10 * 60_000),
        clientKey: 'owner-client',
      },
    });
    const request = { ...body(vehicleId, startAt), holdId: hold.id };

    const stranger = await service.create(user, request, 'other-client').catch((e: unknown) => e);
    expect(stranger).toBeInstanceOf(HttpException);
    expect((stranger as HttpException).getStatus()).toBe(409);
    expect(await prisma.hold.count({ where: { id: hold.id } })).toBe(1);

    await expect(service.create(user, request, 'owner-client')).resolves.toMatchObject({ status: 'CONFIRMED' });
    expect(await prisma.hold.count({ where: { id: hold.id } })).toBe(0);
  });
});
