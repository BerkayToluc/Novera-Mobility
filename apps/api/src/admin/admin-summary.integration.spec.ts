import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { AdminSummaryService } from './admin-summary.service.js';

// The counts against a real PostgreSQL (TEST_DATABASE_URL), like the other integration tests; skipped without one.
// The test database is shared with other suites that run at the same time, so the day-based numbers are tested in the
// year 2090, where nothing else writes, and the quote count (which has no date) is tested as a change.
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !/test/i.test(databaseUrl)) {
  throw new Error('TEST_DATABASE_URL must point at a database with "test" in its name.');
}
const describeDb = databaseUrl ? describe : describe.skip;

// 29 Oct 2090, 15:00 UTC = 18:00 in Istanbul. The Istanbul day is [28 Oct 21:00 UTC, 29 Oct 21:00 UTC).
const NOW = new Date('2090-10-29T15:00:00Z');
const at = (iso: string) => new Date(iso);

describeDb('admin summary against the database (V2-25)', () => {
  let prisma: PrismaService;
  let service: AdminSummaryService;
  const run = randomUUID().slice(0, 8);
  const ids = { classId: '', modelId: '', branchId: '', vehicleId: '' };
  const quoteNumbers: string[] = [];

  const reservation = (label: string, data: { startAt: Date; endAt: Date; createdAt: Date; status?: 'CONFIRMED' | 'CANCELLED' }) =>
    prisma.reservation.create({
      data: {
        number: `SUM-${run}-${label}`,
        days: 1,
        vehicleDailyPrice: 100000,
        totalPrice: 100000,
        vehicleId: ids.vehicleId,
        pickupBranchId: ids.branchId,
        returnBranchId: ids.branchId,
        ...data,
      },
    });

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    service = new AdminSummaryService(prisma);

    ids.classId = (await prisma.vehicleClass.create({ data: { slug: `sum-sinif-${run}`, nameTr: 'T', nameEn: 'T' } })).id;
    ids.modelId = (
      await prisma.vehicleModel.create({
        data: {
          slug: `sum-model-${run}`,
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
    ids.branchId = (
      await prisma.branch.create({
        data: {
          name: `Ozet Bayi ${run}`,
          city: 'Test',
          address: 'Test',
          latitude: 1,
          longitude: 1,
          phone: '+90 000 000 00 00',
          email: `ozet-${run}@example.test`,
          openingHours: { weekdays: { open: '08:00', close: '20:00' } },
        },
      })
    ).id;
    ids.vehicleId = (
      await prisma.vehicle.create({ data: { plate: `S${run}`, year: 2030, vehicleModelId: ids.modelId, branchId: ids.branchId } })
    ).id;
  });

  afterAll(async () => {
    await prisma.reservation.deleteMany({ where: { vehicleId: ids.vehicleId } });
    await prisma.quoteRequest.deleteMany({ where: { number: { in: quoteNumbers } } });
    await prisma.vehicle.deleteMany({ where: { id: ids.vehicleId } });
    await prisma.branch.deleteMany({ where: { id: ids.branchId } });
    await prisma.vehicleModel.deleteMany({ where: { id: ids.modelId } });
    await prisma.vehicleClass.deleteMany({ where: { id: ids.classId } });
    await prisma.$disconnect();
  });

  it('counts rentals starting and ending today, and reservations of the last seven Istanbul days', async () => {
    const earlier = at('2090-10-01T09:00:00Z'); // made long ago: outside the seven days
    const later = at('2090-11-05T09:00:00Z');
    // Starts today: 00:00 Istanbul (the first instant of the day), noon, and one millisecond before the day ends.
    await reservation('s1', { startAt: at('2090-10-28T21:00:00Z'), endAt: later, createdAt: earlier });
    await reservation('s2', { startAt: at('2090-10-29T09:00:00Z'), endAt: later, createdAt: earlier });
    await reservation('s3', { startAt: at('2090-10-29T20:59:59.999Z'), endAt: later, createdAt: earlier });
    // Not today: the last millisecond of yesterday, and the first of tomorrow (the end of the day is not part of it).
    await reservation('n1', { startAt: at('2090-10-28T20:59:59.999Z'), endAt: at('2090-10-28T22:00:00Z'), createdAt: earlier });
    await reservation('n2', { startAt: at('2090-10-29T21:00:00Z'), endAt: later, createdAt: earlier });
    // Ends today (e2 starts and ends today, so it is in both numbers).
    await reservation('e1', { startAt: at('2090-10-20T09:00:00Z'), endAt: at('2090-10-29T08:00:00Z'), createdAt: earlier });
    await reservation('e2', { startAt: at('2090-10-29T05:00:00Z'), endAt: at('2090-10-29T18:00:00Z'), createdAt: earlier });
    // A cancelled one is in no number.
    await reservation('c1', {
      startAt: at('2090-10-29T09:00:00Z'),
      endAt: at('2090-10-29T18:00:00Z'),
      createdAt: at('2090-10-29T08:00:00Z'),
      status: 'CANCELLED',
    });
    // The seven-day window is 23 Oct 00:00 Istanbul (22 Oct 21:00 UTC) up to the end of today.
    const far = { startAt: at('2090-12-01T09:00:00Z'), endAt: at('2090-12-02T09:00:00Z') };
    await reservation('w1', { ...far, createdAt: at('2090-10-22T21:00:00Z') });
    await reservation('w2', { ...far, createdAt: at('2090-10-29T14:00:00Z') });
    await reservation('w3', { ...far, createdAt: at('2090-10-22T20:59:59.999Z') });

    const summary = await service.get(NOW);
    expect(summary.date).toBe('2090-10-29');
    // s1, s2, s3 and e2 start today; the cancelled c1 does not count.
    expect(summary.rentalsStartingToday).toBe(4);
    // e1 and e2 end today, and so does n1: it ends at 01:00 Istanbul on the 29th, though it started yesterday.
    expect(summary.rentalsEndingToday).toBe(3);
    // Made in the window: w1 (its very first instant) and w2. Not w3 (a millisecond before), not the older ones.
    expect(summary.reservationsLast7Days).toBe(2);
  });

  it('turns over at Istanbul midnight', async () => {
    // One second after Istanbul midnight the day is the 30th: only n2, which starts at its first instant, is "today".
    const next = await service.get(at('2090-10-29T21:00:01Z'));
    expect(next.date).toBe('2090-10-30');
    expect(next.rentalsStartingToday).toBe(1);
  });

  it('counts the quote requests nobody has started on', async () => {
    const quote = (label: string, status: 'RECEIVED' | 'IN_REVIEW' | 'OFFERED') => {
      const number = `SUM-${run}-${label}`;
      quoteNumbers.push(number);
      return prisma.quoteRequest.create({
        data: { number, status, companyName: 'Ege Lojistik', email: `q-${label}-${run}@example.test`, vehicleCount: 5, durationMonths: 12, vehicleType: 'SUV' },
      });
    };
    await quote('q1', 'RECEIVED');
    await quote('q2', 'RECEIVED');
    await quote('q3', 'IN_REVIEW');
    await quote('q4', 'OFFERED');
    // Counted over this run's rows only: the table is shared with suites that run at the same time and add and remove quote
    // requests of their own, so a count of all of them would change under the test. The rule itself (RECEIVED only) is the service's.
    const mine = { reservation: prisma.reservation, quoteRequest: { count: (args: { where?: object }) => prisma.quoteRequest.count({ where: { ...args.where, number: { startsWith: `SUM-${run}` } } }) } };
    expect((await new AdminSummaryService(mine as unknown as PrismaService).get(NOW)).quotesAwaiting).toBe(2);
  });

  it('leaves the numbers that have no source yet as null, not zero', async () => {
    const summary = await service.get(NOW);
    expect(summary.unhandledMessages).toBeNull();
    expect(summary.serviceRequests).toBeNull();
  });
});
