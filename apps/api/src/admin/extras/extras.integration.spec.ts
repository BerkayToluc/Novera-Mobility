import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PricingService } from '../../reservations/pricing.service.js';
import { parseReservationRequest } from '../../reservations/reservation-input.js';
import { ExtrasService } from './extras.service.js';

// The extra service administration against a real PostgreSQL (TEST_DATABASE_URL), like the other integration tests; skipped
// without one. The test database is shared with suites that run at the same time and holds the seed extras, which other suites
// price, so these tests only change an extra of their own.
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !/test/i.test(databaseUrl)) {
  throw new Error('TEST_DATABASE_URL must point at a database with "test" in its name.');
}
const describeDb = databaseUrl ? describe : describe.skip;

const DAY = 86_400_000;
const slotAt = (count: number) => {
  const moment = new Date(Date.now() + count * DAY);
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

describeDb('extra service administration against the database (V2-30)', () => {
  let prisma: PrismaService;
  let service: ExtrasService;
  const run = randomUUID().slice(0, 8);
  const ids = { classId: '', modelId: '', branchId: '', vehicleId: '', extraId: '' };
  const slug = `v30x-${run}`;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    service = new ExtrasService(prisma);
    ids.classId = (await prisma.vehicleClass.create({ data: { slug: `v30xc-${run}`, nameTr: 'Deneme', nameEn: 'Test' } })).id;
    ids.modelId = (
      await prisma.vehicleModel.create({
        data: {
          slug: `v30xm-${run}`,
          brand: 'Deneme',
          model: 'Ek',
          seats: 5,
          bags: 2,
          transmission: 'MANUAL',
          fuelType: 'PETROL',
          consumption: 5.4,
          consumptionUnit: 'L_PER_100KM',
          dailyPrice: 100000,
          description: { tr: 'Deneme', en: 'Test' },
          classId: ids.classId,
        },
      })
    ).id;
    ids.branchId = (
      await prisma.branch.create({
        data: {
          name: `Ek Bayi ${run}`,
          city: 'Ankara',
          address: 'Test',
          latitude: 39.9,
          longitude: 32.8,
          phone: '+90 312 555 00 00',
          email: `ek-${run}@example.test`,
          openingHours: { weekdays: '00:00-23:59', saturday: '00:00-23:59', sunday: '00:00-23:59' },
        },
      })
    ).id;
    ids.vehicleId = (await prisma.vehicle.create({ data: { plate: `34 ZZZ ${run.replace(/\D/g, '').padEnd(4, '7').slice(0, 4)}`, year: 2025, vehicleModelId: ids.modelId, branchId: ids.branchId } })).id;
    ids.extraId = (await prisma.extra.create({ data: { slug, nameTr: 'Deneme ek hizmeti', nameEn: 'Test extra', price: 10000, pricing: 'PER_DAY' } })).id;
  });

  afterAll(async () => {
    await prisma.reservationExtra.deleteMany({ where: { extraId: ids.extraId } });
    await prisma.reservation.deleteMany({ where: { number: { startsWith: `V30X-${run}` } } });
    await prisma.vehicle.deleteMany({ where: { id: ids.vehicleId } });
    await prisma.vehicleModel.deleteMany({ where: { id: ids.modelId } });
    await prisma.branch.deleteMany({ where: { id: ids.branchId } });
    await prisma.vehicleClass.deleteMany({ where: { id: ids.classId } });
    await prisma.extra.deleteMany({ where: { id: ids.extraId } });
    await prisma.$disconnect();
  });

  const quote = (extraSlug: string) =>
    new PricingService(prisma).calculate(
      prisma,
      parseReservationRequest({
        vehicleId: ids.vehicleId,
        pickupBranchId: ids.branchId,
        returnBranchId: ids.branchId,
        startAt: slotAt(50),
        endAt: slotAt(52),
        currency: 'TRY',
        extras: [{ slug: extraSlug, quantity: 1 }],
      }),
    );

  it('lists the extras with both names, the price in kuruş and how they are priced, cheapest first', async () => {
    const list = await service.list();
    const own = list.find((extra) => extra.slug === slug)!;
    expect(own).toMatchObject({ name: { tr: 'Deneme ek hizmeti', en: 'Test extra' }, price: 10000, pricing: 'PER_DAY' });
    const prices = list.map((extra) => extra.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it('gives one extra by its address, whatever the case, and 404 for one that is not there', async () => {
    expect((await service.get(slug.toUpperCase())).slug).toBe(slug);
    expect((await refused(service.get('no-such-extra'))).status).toBe(404);
    expect((await refused(service.get('Not A Slug'))).status).toBe(404);
    expect((await refused(service.update('no-such-extra', { updatedAt: new Date().toISOString(), price: 1 }))).status).toBe(404);
  });

  it('changes only what is sent, keeps the address and the way it is priced, and moves the version on', async () => {
    const before = await service.get(slug);
    const named = await service.update(slug, { updatedAt: before.updatedAt, name: { tr: 'Yeni ad', en: 'New name' } });
    expect(named).toMatchObject({ name: { tr: 'Yeni ad', en: 'New name' }, price: 10000, pricing: 'PER_DAY', slug });
    expect(named.updatedAt).not.toBe(before.updatedAt);
    const priced = await service.update(slug, { updatedAt: named.updatedAt, price: 12500 });
    expect(priced).toMatchObject({ name: { tr: 'Yeni ad', en: 'New name' }, price: 12500 });
  });

  it('an edit made against an old version is 409 STALE_WRITE and writes nothing', async () => {
    const before = await service.get(slug);
    await service.update(slug, { updatedAt: before.updatedAt, price: 11000 });
    const answer = await refused(service.update(slug, { updatedAt: before.updatedAt, price: 99999 }));
    expect(answer).toMatchObject({ status: 409, body: { code: 'STALE_WRITE' } });
    expect((await service.get(slug)).price).toBe(11000);
  });

  it('refuses a price that is out of range, and the database itself refuses a negative one', async () => {
    const current = await service.get(slug);
    expect((await refused(service.update(slug, { updatedAt: current.updatedAt, price: -1 }))).body).toMatchObject({ fieldErrors: { price: 'OUT_OF_RANGE' } });
    expect((await refused(service.update(slug, { updatedAt: current.updatedAt, price: 1_000_001 }))).body).toMatchObject({ fieldErrors: { price: 'OUT_OF_RANGE' } });
    await expect(prisma.extra.update({ where: { slug }, data: { price: -5 } })).rejects.toThrow();
  });

  it('a new price is in the next quote, and a booking that was made keeps what it was told', async () => {
    const start = await service.get(slug);
    const first = await service.update(slug, { updatedAt: start.updatedAt, price: 10000 });
    const reservation = await prisma.reservation.create({
      data: {
        number: `V30X-${run}-1`,
        startAt: new Date(slotAt(50)),
        endAt: new Date(slotAt(52)),
        days: 2,
        vehicleDailyPrice: 100000,
        totalPrice: 220000,
        vehicleId: ids.vehicleId,
        pickupBranchId: ids.branchId,
        returnBranchId: ids.branchId,
        extras: { create: [{ extraId: ids.extraId, quantity: 2, unitPrice: 10000, totalPrice: 20000 }] },
      },
    });

    await service.update(slug, { updatedAt: first.updatedAt, price: 25000 });

    const kept = await prisma.reservationExtra.findFirstOrThrow({ where: { reservationId: reservation.id } });
    expect(kept).toMatchObject({ unitPrice: 10000, totalPrice: 20000 });
    const next = await quote(slug);
    expect(next.lines.find((line) => line.type === 'EXTRA')?.unitPrice).toEqual({ amount: 25000, currency: 'TRY' });
  });
});
