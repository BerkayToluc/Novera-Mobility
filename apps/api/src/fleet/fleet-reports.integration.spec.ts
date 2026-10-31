import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { AdminContractsService } from '../admin/contracts/contracts.service.js';
import { testPlate } from '../common/plate.testing.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseDay } from './fleet-dates.js';
import { dueDayOf, lineOf, periodRange, totalsOf } from './invoice-calc.js';
import { FleetReportsService } from './fleet-reports.service.js';

// The fleet report against a real PostgreSQL (TEST_DATABASE_URL), like the other integration tests; skipped without one (V2-39). The point
// is the one the issue names: the totals of the report are the invoices and the expenses themselves, to the kuruş. Who may call the
// endpoint (401, 403) is in fleet.http.spec.ts.
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

const DAY = 86_400_000;
const NOW = new Date('2026-10-31T10:00:00.000Z');

// The first day of the month after a period, the day its invoice is made.
const nextMonthDay = (period: string): string => new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 1)).toISOString().slice(0, 10);

describeDb('the fleet report against the database (V2-39)', () => {
  let prisma: PrismaService;
  let admin: AdminContractsService;
  let reports: FleetReportsService;
  const run = randomUUID().slice(0, 8);
  const ids = { classId: '', modelId: '', modelSlug: `v39r-model-${run}`, productSlug: `v39r-urun-${run}`, productId: '' };
  const A = { id: '', contract: '', cars: [] as Array<{ id: string; plate: string }>, ayse: '' };
  const B = { id: '', contract: '', cars: [] as Array<{ id: string; plate: string }>, ayse: '' };
  const NONE = { id: '' };
  const ago = (days: number) => new Date(NOW.getTime() - days * DAY);

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    admin = new AdminContractsService(prisma);
    reports = new FleetReportsService(prisma);

    ids.classId = (await prisma.vehicleClass.create({ data: { slug: `v39r-sinif-${run}`, nameTr: 'T', nameEn: 'T' } })).id;
    ids.modelId = (
      await prisma.vehicleModel.create({
        data: { slug: ids.modelSlug, brand: 'Filom', model: `Rapor${run}`, seats: 5, bags: 3, transmission: 'AUTOMATIC', fuelType: 'PETROL', consumption: 5.5, consumptionUnit: 'L_PER_100KM', dailyPrice: 100000, description: { tr: 'Test', en: 'Test' }, classId: ids.classId },
      })
    ).id;
    ids.productId = (await prisma.product.create({ data: { slug: ids.productSlug } })).id;

    for (const [side, name, cars] of [[A, 'A', 3], [B, 'B', 2]] as const) {
      side.id = (await prisma.company.create({ data: { name: `V39R ${name} ${run}` } })).id;
      // 7,000.01 TL a month so that dividing it between three cars leaves a kuruş over.
      const made = await admin.create(side.id, { productSlug: ids.productSlug, startAt: '2026-06-01', endAt: '2027-05-31', monthlyFee: 700_001, deliveryCity: 'İzmir' });
      side.contract = made.number;
      for (let index = 0; index < cars; index += 1) {
        const plate = testPlate();
        const car = await admin.createVehicle(made.number, { modelSlug: ids.modelSlug, plate, year: 2025, startKm: 1_000 * (index + 1) });
        side.cars.push({ id: car.id, plate });
      }
    }
    NONE.id = (await prisma.company.create({ data: { name: `V39R Bos ${run}` } })).id;
    A.ayse = (await prisma.companyEmployee.create({ data: { companyId: A.id, firstName: 'Ayşe', lastName: `Demir${run}`, department: 'Satış' } })).id;
    await prisma.vehicleAssignment.create({ data: { companyId: A.id, fleetVehicleId: A.cars[0]!.id, employeeId: A.ayse, startedAt: ago(80) } });

    // Two months of invoices for these two companies, made by the rule of the administration (the month is made once for everybody there,
    // and other tests' invoices may be in the same database), then the expenses and readings.
    for (const side of [A, B]) {
      const contract = await prisma.fleetContract.findFirstOrThrow({ where: { number: side.contract }, include: { product: { select: { slug: true } } } });
      for (const period of ['2026-09', '2026-10']) {
        const line = lineOf({ number: contract.number, productSlug: contract.product.slug, monthlyFee: contract.monthlyFee, startAt: contract.startAt, endAt: contract.endAt }, periodRange(period)!)!;
        const issuedAt = parseDay(`${nextMonthDay(period)}`)!;
        await prisma.fleetInvoice.create({ data: { number: `FTR-9${run.slice(0, 3).replace(/\D/g, '0')}-${period.slice(5)}${side === A ? '1' : '2'}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`, companyId: side.id, period, issuedAt, dueAt: parseDay(dueDayOf(issuedAt))!, lines: [line], ...totalsOf([line]) } });
      }
    }
    const expense = (side: typeof A, car: number, at: Date, amount: number) => prisma.fleetExpense.create({ data: { companyId: side.id, fleetVehicleId: side.cars[car]!.id, type: 'HGS', occurredAt: at, amount } });
    await expense(A, 0, new Date('2026-09-12T08:00:00Z'), 8_550);
    await expense(A, 1, new Date('2026-10-02T08:00:00Z'), 12_001);
    await expense(A, 0, new Date('2026-06-02T08:00:00Z'), 99_999);
    await expense(B, 0, new Date('2026-10-05T08:00:00Z'), 4_321);
    await prisma.vehicleReading.createMany({
      data: [
        { fleetVehicleId: A.cars[0]!.id, at: new Date('2026-08-31T12:00:00Z'), km: 1_000 },
        { fleetVehicleId: A.cars[0]!.id, at: new Date('2026-09-30T12:00:00Z'), km: 1_700 },
        { fleetVehicleId: A.cars[0]!.id, at: new Date('2026-10-30T12:00:00Z'), km: 2_300 },
        { fleetVehicleId: A.cars[1]!.id, at: new Date('2026-10-20T12:00:00Z'), km: 2_500 },
      ],
    });
  });

  afterAll(async () => {
    const companyIds = [A.id, B.id, NONE.id];
    const cars = await prisma.fleetVehicle.findMany({ where: { companyId: { in: companyIds } }, select: { id: true } });
    await prisma.vehicleReading.deleteMany({ where: { fleetVehicleId: { in: cars.map((car) => car.id) } } });
    await prisma.fleetExpense.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.vehicleAssignment.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.fleetInvoice.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.fleetVehicle.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.fleetContract.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.companyEmployee.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
    await prisma.product.deleteMany({ where: { id: ids.productId } });
    await prisma.vehicleModel.deleteMany({ where: { id: ids.modelId } });
    await prisma.vehicleClass.deleteMany({ where: { id: ids.classId } });
    await prisma.$disconnect();
  });

  it('the totals are the invoices and the expenses themselves, to the kuruş, whichever way the report is cut', async () => {
    const report = await reports.get(A.id, { from: '2026-09', to: '2026-10' }, NOW);
    const invoiced = await prisma.fleetInvoice.aggregate({ where: { companyId: A.id, period: { in: ['2026-09', '2026-10'] } }, _sum: { subtotal: true } });
    const spent = await prisma.fleetExpense.aggregate({ where: { companyId: A.id, occurredAt: { gte: new Date('2026-08-31T21:00:00Z'), lt: new Date('2026-10-31T21:00:00Z') } }, _sum: { amount: true } });
    expect(invoiced._sum.subtotal).toBeGreaterThan(0);
    expect(report.totals.invoice).toBe(invoiced._sum.subtotal);
    expect(report.totals.expenses).toBe(spent._sum.amount);
    expect(report.totals.expenses).toBe(8_550 + 12_001);
    expect(report.totals.total).toBe(report.totals.invoice + report.totals.expenses);

    const sum = (rows: Array<Record<'invoice' | 'expenses' | 'total' | 'km', number>>, key: 'invoice' | 'expenses' | 'total' | 'km') => rows.reduce((s, r) => s + r[key], 0);
    for (const key of ['invoice', 'expenses', 'total', 'km'] as const) {
      expect(sum(report.months, key)).toBe(report.totals[key]);
      expect(sum(report.departments, key)).toBe(report.totals[key]);
    }
    expect(sum(report.vehicles, 'invoice') + report.unallocated.invoice).toBe(report.totals.invoice);
    expect(sum(report.vehicles, 'expenses')).toBe(report.totals.expenses);
    expect(report.unallocated.invoice).toBe(0);
  });

  it('shares each invoice between the three cars of the contract without losing a kuruş, and finds the person’s department', async () => {
    const report = await reports.get(A.id, { from: '2026-10', to: '2026-10' }, NOW);
    const invoice = await prisma.fleetInvoice.findFirstOrThrow({ where: { companyId: A.id, period: '2026-10' } });
    const shares = report.vehicles.map((row) => row.invoice).sort((a, b) => b - a);
    expect(shares).toHaveLength(3);
    expect(shares.reduce((s, v) => s + v, 0)).toBe(invoice.subtotal);
    expect(shares[0]! - shares[2]!).toBeLessThanOrEqual(1);
    // Car 0 is Ayşe's (since 80 days): her department carries its share and nobody's carries the other two.
    const sales = report.departments.find((row) => row.department === 'Satış')!;
    const own = report.vehicles.find((row) => row.plate === A.cars[0]!.plate)!;
    expect(sales.invoice).toBe(own.invoice);
    expect(report.departments.find((row) => row.department === null)!.invoice).toBe(invoice.subtotal - own.invoice);
  });

  it('counts the kilometres of each month from the readings', async () => {
    const report = await reports.get(A.id, { from: '2026-09', to: '2026-10' }, NOW);
    // Car 0: 1,000 → 1,700 in September, 1,700 → 2,300 in October. Car 1 started at 2,000 and was read at 2,500 in October.
    expect(report.months.map((month) => month.km)).toEqual([700, 600 + 500]);
    expect(report.vehicles.find((row) => row.plate === A.cars[0]!.plate)!.km).toBe(1_300);
    expect(report.vehicles.find((row) => row.plate === A.cars[1]!.plate)!.km).toBe(500);
  });

  it('is the company’s own: another company’s expenses, invoices and cars are in none of the numbers', async () => {
    const mine = await reports.get(A.id, { from: '2026-10', to: '2026-10' }, NOW);
    const theirs = await reports.get(B.id, { from: '2026-10', to: '2026-10' }, NOW);
    expect(mine.vehicles.every((row) => !B.cars.some((car) => car.id === row.id))).toBe(true);
    expect(theirs.totals.expenses).toBe(4_321);
    expect(theirs.vehicles.every((row) => B.cars.some((car) => car.id === row.id))).toBe(true);
  });

  it('a company with nothing in the months gets zeros and an empty list, not an error; the default is this month', async () => {
    const empty = await reports.get(NONE.id, { from: '2026-09', to: '2026-10' }, NOW);
    expect(empty.totals).toEqual({ invoice: 0, expenses: 0, total: 0, km: 0 });
    expect(empty.vehicles).toEqual([]);
    expect(empty.months.map((month) => month.period)).toEqual(['2026-09', '2026-10']);
    expect((await reports.get(A.id, {}, NOW)).months.map((month) => month.period)).toEqual(['2026-10']);
    expect((await reports.get(A.id, { from: '2026-09' }, NOW)).months.map((month) => month.period)).toEqual(['2026-09']);
  });

  it('is 422 for months that make no sense: not a month, the wrong way round, in the future, or more than 24', async () => {
    const cases: Array<[Record<string, string>, Record<string, string>]> = [
      [{ from: '2026-13' }, { from: 'INVALID_FORMAT' }],
      [{ to: 'bu-ay' }, { to: 'INVALID_FORMAT' }],
      [{ from: '2026-10', to: '2026-09' }, { from: 'OUT_OF_RANGE' }],
      [{ from: '2026-10', to: '2026-12' }, { to: 'OUT_OF_RANGE' }],
      [{ from: '2024-10', to: '2026-10' }, { from: 'OUT_OF_RANGE' }],
    ];
    for (const [query, fieldErrors] of cases) {
      const answer = await refused(reports.get(A.id, query, NOW));
      expect([query, answer.status, answer.body.fieldErrors]).toEqual([query, 422, fieldErrors]);
    }
    expect((await reports.get(A.id, { from: '2024-11', to: '2026-10' }, NOW)).months).toHaveLength(24);
  });
});
