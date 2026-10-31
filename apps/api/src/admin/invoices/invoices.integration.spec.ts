import 'dotenv/config';
import { randomInt, randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { FleetInvoicesService } from '../../fleet/fleet-invoices.service.js';
import { FleetSummaryService } from '../../fleet/fleet-summary.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AdminContractsService } from '../contracts/contracts.service.js';
import { InvoicesService } from './invoices.service.js';

// The monthly invoices against a real PostgreSQL (TEST_DATABASE_URL), like the other integration tests; skipped without one. The
// invoices of a month are made for every company that has a contract in it, so each test works in a year of its own (far from the
// dates the other suites use) with companies of its own: what one makes is never in the month of another.
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

describeDb('invoices against the database (V2-37)', () => {
  let prisma: PrismaService;
  let service: InvoicesService;
  let fleet: FleetInvoicesService;
  let summary: FleetSummaryService;
  let contracts: AdminContractsService;
  const run = randomUUID().slice(0, 8);
  const ids = { productSlug: `v37-urun-${run}`, productId: '' };
  const companyIds: string[] = [];
  const usedYears = new Set<number>();

  // A year of its own that nothing else has a contract or an invoice in (checked, and chosen at random, so a leftover of an earlier run or a
  // suite running at the same moment is not in it), and a company for each name; `now` is mid-June of the year after, so every month of the
  // year can be billed.
  const freeYear = async (): Promise<number> => {
    for (;;) {
      const year = randomInt(2030, 2090);
      if (usedYears.has(year)) continue;
      const busy =
        (await prisma.fleetContract.count({ where: { startAt: { lte: new Date(`${year + 1}-12-31`) }, endAt: { gte: new Date(`${year}-01-01`) } } })) +
        (await prisma.fleetInvoice.count({ where: { period: { startsWith: `${year}-` } } }));
      if (busy === 0) {
        usedYears.add(year);
        return year;
      }
    }
  };
  const world = async (...names: string[]) => {
    const year = await freeYear();
    const made: Record<string, string> = {};
    for (const name of names) {
      const company = await prisma.company.create({ data: { name: `V37 ${name} ${year} ${run}` } });
      companyIds.push(company.id);
      made[name] = company.id;
    }
    return { year, company: made, now: new Date(`${year + 1}-06-15T09:00:00Z`) };
  };
  const contract = (companyId: string, startAt: string, endAt: string, monthlyFee = 3_100_000) =>
    contracts.create(companyId, { productSlug: ids.productSlug, startAt, endAt, monthlyFee, deliveryCity: 'İzmir' });

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    service = new InvoicesService(prisma);
    fleet = new FleetInvoicesService(prisma);
    summary = new FleetSummaryService(prisma);
    contracts = new AdminContractsService(prisma);
    ids.productId = (await prisma.product.create({ data: { slug: ids.productSlug } })).id;
  });

  afterAll(async () => {
    await prisma.fleetInvoice.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.fleetContract.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
    await prisma.product.deleteMany({ where: { id: ids.productId } });
    await prisma.$disconnect();
  });

  describe('making the invoices of a month', () => {
    it('makes one invoice for each company that has a contract in it, with a line for each contract, in whole kuruş', async () => {
      const { year, company, now } = await world('A', 'B', 'C');
      const october = `${year}-10`;
      // A: a contract for the whole month, and one that starts on the 16th. B: one that ends on the 10th. C: one that ended before.
      await contract(company.A!, `${year}-01-01`, `${year}-12-31`);
      await contract(company.A!, `${year}-10-16`, `${year + 1}-10-15`, 1_000_000);
      await contract(company.B!, `${year}-01-01`, `${year}-10-10`);
      await contract(company.C!, `${year}-01-01`, `${year}-09-30`);

      const result = await service.generate({ period: october }, now);
      expect(result).toMatchObject({ period: october, created: 2 });
      const byCompany = new Map(result.invoices.map((invoice) => [invoice.company.id, invoice]));
      expect(byCompany.has(company.C!)).toBe(false);

      const a = byCompany.get(company.A!)!;
      expect(a.lines.map((line) => [line.days, line.daysInMonth, line.amount])).toEqual([[31, 31, 3_100_000], [16, 31, 516_129]]);
      // 3 100 000 + 516 129, 20 % VAT of it (723 225,8 → 723 226), the total of both.
      expect(a).toMatchObject({ subtotal: 3_616_129, vatPercent: 20, vat: 723_226, total: 4_339_355, period: october, status: 'PENDING', paidAt: null });
      expect(a.lines.reduce((sum, line) => sum + line.amount, 0)).toBe(a.subtotal);
      expect(a.total).toBe(a.subtotal + a.vat);
      // Issued the day it was made, due 30 days later.
      expect(a).toMatchObject({ issuedAt: `${year + 1}-06-15`, dueAt: `${year + 1}-07-15` });
      expect(a.number).toMatch(/^FTR-\d{4}-\d{5,}$/);

      const b = byCompany.get(company.B!)!;
      expect(b.lines).toEqual([expect.objectContaining({ days: 10, daysInMonth: 31, amount: 1_000_000 })]);
      expect(b).toMatchObject({ subtotal: 1_000_000, vat: 200_000, total: 1_200_000 });
      expect(new Set([a.number, b.number]).size).toBe(2);
    });

    it('the lines are the contracts that touch the month, a month with 28, 29 and 30 days is divided by its own days', async () => {
      const { year, company, now } = await world('Gun');
      await contract(company.Gun!, `${year}-01-01`, `${year}-12-31`, 2_800_000);
      const result = await service.generate({ period: `${year}-02` }, now);
      // February has 28 days, or 29 in a leap year; a whole month is the monthly fee exactly either way.
      const february = new Date(Date.UTC(year, 2, 0)).getUTCDate();
      expect(result.invoices[0]!.lines[0]).toMatchObject({ days: february, daysInMonth: february, amount: 2_800_000 });
      const april = await service.generate({ period: `${year}-04` }, now);
      expect(april.invoices[0]!.lines[0]).toMatchObject({ days: 30, daysInMonth: 30, amount: 2_800_000 });
    });

    it('a second time for the same month is 409 ALREADY_GENERATED and changes nothing; another month is its own', async () => {
      const { year, company, now } = await world('Bir');
      await contract(company.Bir!, `${year}-01-01`, `${year}-12-31`);
      const first = await service.generate({ period: `${year}-05` }, now);
      expect(first.created).toBe(1);
      const again = await refused(service.generate({ period: `${year}-05` }, now));
      expect(again).toMatchObject({ status: 409, body: { code: 'ALREADY_GENERATED' } });
      expect(await prisma.fleetInvoice.count({ where: { companyId: company.Bir!, period: `${year}-05` } })).toBe(1);
      expect((await service.generate({ period: `${year}-06` }, now)).created).toBe(1);
    });

    it('two calls at the same moment: one makes them, the other is refused', async () => {
      const { year, company, now } = await world('Es', 'Zamanli');
      await contract(company.Es!, `${year}-01-01`, `${year}-12-31`);
      await contract(company.Zamanli!, `${year}-01-01`, `${year}-12-31`);
      const results = await Promise.allSettled([1, 2, 3].map(() => service.generate({ period: `${year}-07` }, now)));
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      for (const result of results) {
        if (result.status === 'rejected') expect((result.reason as HttpException).getResponse()).toMatchObject({ code: 'ALREADY_GENERATED' });
      }
      expect(await prisma.fleetInvoice.count({ where: { companyId: { in: [company.Es!, company.Zamanli!] }, period: `${year}-07` } })).toBe(2);
    });

    it('a month in which no company has a contract makes nothing, and does not use the month up', async () => {
      const { year, company, now } = await world('Gec');
      const empty = await service.generate({ period: `${year}-03` }, now);
      expect(empty).toMatchObject({ created: 0, invoices: [] });
      await contract(company.Gec!, `${year}-01-01`, `${year}-12-31`);
      expect((await service.generate({ period: `${year}-03` }, now)).created).toBe(1);
    });

    it('a month that has not started is 422, and so is a period that is missing or is not a month', async () => {
      const { year, now } = await world();
      // Mid-June of the next year: July of that year has not started, June has.
      expect((await refused(service.generate({ period: `${year + 1}-07` }, now))).body.fieldErrors).toEqual({ period: 'OUT_OF_RANGE' });
      expect((await refused(service.generate({ period: `${year + 5}-01` }, now))).body.fieldErrors).toEqual({ period: 'OUT_OF_RANGE' });
      expect((await refused(service.generate({}, now))).body.fieldErrors).toEqual({ period: 'REQUIRED' });
      for (const bad of ['2026-13', '2026-1', 'bu ay', '2026-10-01', 12]) expect((await refused(service.generate({ period: bad }, now))).body.fieldErrors).toEqual({ period: 'INVALID_FORMAT' });
    });

    it('the database itself refuses an invoice whose total is not its parts, whose period is not a month, whose due day is before its issue, or that is a second of the month', async () => {
      const { year, company, now } = await world('Kisit');
      await contract(company.Kisit!, `${year}-01-01`, `${year}-12-31`);
      await service.generate({ period: `${year}-08` }, now);
      const base = { companyId: company.Kisit!, lines: [], issuedAt: new Date(`${year}-09-01`), dueAt: new Date(`${year}-10-01`), subtotal: 100, vat: 20, total: 120 };
      const make = (number: string, extra: Record<string, unknown> = {}) => prisma.fleetInvoice.create({ data: { number, period: `${year}-09`, ...base, ...extra } });
      await expect(make(`FTR-${year}-90001`, { total: 121 })).rejects.toThrow();
      await expect(make(`FTR-${year}-90002`, { period: `${year}-13` })).rejects.toThrow();
      await expect(make(`FTR-${year}-90003`, { dueAt: new Date(`${year}-08-01`) })).rejects.toThrow();
      await expect(make(`FTR-${year}-90004`, { period: `${year}-08` })).rejects.toThrow();
      await expect(make(`FTR-${year}-90005`, { vat: -1, total: 99 })).rejects.toThrow();
      await expect(make(`FTR-${year}-90006`)).resolves.toBeTruthy();
    });
  });

  describe('reading the invoices', () => {
    it('lists them, narrows by month, company, state and word, sorts, and pages with a total that does not change', async () => {
      const { year, company, now } = await world('Liste', 'Baska');
      await contract(company.Liste!, `${year}-01-01`, `${year}-12-31`);
      await contract(company.Baska!, `${year}-01-01`, `${year}-12-31`, 5_000_000);
      for (const month of ['01', '02', '03']) await service.generate({ period: `${year}-${month}` }, now);

      const mine = (extra: Record<string, unknown> = {}) => service.list({ company: company.Liste!, pageSize: '100', ...extra }, now);
      expect((await mine()).total).toBe(3);
      expect((await mine({ period: `${year}-02` })).items.map((invoice) => invoice.period)).toEqual([`${year}-02`]);
      expect((await service.list({ period: `${year}-02`, q: `baska ${year}` }, now)).items.map((invoice) => invoice.company.id)).toEqual([company.Baska!]);
      const byTotal = await mine({ sort: 'total:desc' });
      const totals = byTotal.items.map((invoice) => invoice.total);
      expect(totals).toEqual(totals.toSorted((a, b) => b - a));
      const first = await mine({ pageSize: '2', page: '1', sort: 'number:asc' });
      const second = await mine({ pageSize: '2', page: '2', sort: 'number:asc' });
      expect([first.total, second.total]).toEqual([3, 3]);
      expect(new Set([...first.items, ...second.items].map((invoice) => invoice.number)).size).toBe(3);
      for (const query of [{ sort: 'lines:asc' }, { status: 'LATE' }, { period: '2026-13' }, { company: 'x' }, { pageSize: '101' }]) expect((await refused(service.list(query, now))).status).toBe(422);
    });

    it('works the state out from the due day: waiting until the due day, late after it, paid whenever it is paid', async () => {
      const { year, company, now } = await world('Durum');
      await contract(company.Durum!, `${year}-01-01`, `${year}-12-31`);
      for (const month of ['01', '02', '03']) await service.generate({ period: `${year}-${month}` }, now);
      const rows = await prisma.fleetInvoice.findMany({ where: { companyId: company.Durum! }, orderBy: { period: 'asc' } });
      // Today is the 15th of June: due on the 15th is not late, the 14th is, and a late one that is paid is paid.
      const set = (id: string, dueAt: string, paidAt: Date | null = null) => prisma.fleetInvoice.update({ where: { id }, data: { dueAt: new Date(`${dueAt}T00:00:00Z`), issuedAt: new Date(`${year}-01-01T00:00:00Z`), paidAt } });
      await set(rows[0]!.id, `${year + 1}-06-15`);
      await set(rows[1]!.id, `${year + 1}-06-14`);
      await set(rows[2]!.id, `${year + 1}-06-14`, new Date());

      const state = async (status: string) => (await service.list({ company: company.Durum!, status }, now)).items.map((invoice) => invoice.period);
      expect(await state('PENDING')).toEqual([`${year}-01`]);
      expect(await state('OVERDUE')).toEqual([`${year}-02`]);
      expect(await state('PAID')).toEqual([`${year}-03`]);
      const all = await service.list({ company: company.Durum!, sort: 'number:asc' }, now);
      expect(all.items.map((invoice) => invoice.status)).toEqual(['PENDING', 'OVERDUE', 'PAID']);
      // The next day the first one is late too: nothing was stored.
      expect((await service.list({ company: company.Durum!, status: 'OVERDUE' }, new Date(`${year + 1}-06-16T09:00:00Z`))).total).toBe(2);
    });

    it('opens an invoice by its number, however it is typed; one that is not there, or cannot be one, is 404', async () => {
      const { year, company, now } = await world('Tek');
      await contract(company.Tek!, `${year}-01-01`, `${year}-12-31`);
      const [made] = (await service.generate({ period: `${year}-01` }, now)).invoices;
      expect((await service.get(made!.number.toLowerCase(), now)).id).toBe(made!.id);
      for (const number of ['FTR-2099-99999', 'nope']) expect((await refused(service.get(number, now))).status).toBe(404);
    });
  });

  describe('the paid mark', () => {
    it('marks an invoice paid and takes it back; the same state again is no error and no change; an old copy is refused', async () => {
      const { year, company, now } = await world('Odeme');
      await contract(company.Odeme!, `${year}-01-01`, `${year}-12-31`);
      const [made] = (await service.generate({ period: `${year}-01` }, now)).invoices;

      const paid = await service.update(made!.number, { updatedAt: made!.updatedAt, paid: true }, now);
      expect(paid).toMatchObject({ status: 'PAID' });
      expect(paid.paidAt).toBe(now.toISOString());
      expect(paid.updatedAt > made!.updatedAt).toBe(true);

      // The same state again keeps the first date, and the version.
      const same = await service.update(made!.number, { updatedAt: paid.updatedAt, paid: true }, new Date(now.getTime() + 60_000));
      expect(same.paidAt).toBe(paid.paidAt);
      expect(same.updatedAt).toBe(paid.updatedAt);

      expect((await refused(service.update(made!.number, { updatedAt: made!.updatedAt, paid: false }, now))).body).toMatchObject({ code: 'STALE_WRITE' });
      const undone = await service.update(made!.number, { updatedAt: paid.updatedAt, paid: false }, now);
      expect(undone).toMatchObject({ paidAt: null, status: 'PENDING' });
    });

    it('is 422 for a mark that is not true or false and for no version, and 404 for an invoice that is not there', async () => {
      const { year, company, now } = await world('Hata');
      await contract(company.Hata!, `${year}-01-01`, `${year}-12-31`);
      const [made] = (await service.generate({ period: `${year}-01` }, now)).invoices;
      expect((await refused(service.update(made!.number, { updatedAt: made!.updatedAt, paid: 'yes' }, now))).body.fieldErrors).toEqual({ paid: 'INVALID_FORMAT' });
      expect((await refused(service.update(made!.number, {}, now))).body.fieldErrors).toEqual({ updatedAt: 'REQUIRED', paid: 'REQUIRED' });
      expect((await refused(service.update('FTR-2099-99999', { updatedAt: made!.updatedAt, paid: true }, now))).status).toBe(404);
      expect((await refused(service.update('nope', { updatedAt: made!.updatedAt, paid: true }, now))).status).toBe(404);
    });
  });

  describe('what the customer sees', () => {
    it('lists and opens the company’s own invoices only: another company’s is 404, and a company with none gets an empty list', async () => {
      const { year, company, now } = await world('Musteri', 'Diger', 'Bos');
      await contract(company.Musteri!, `${year}-01-01`, `${year}-12-31`);
      await contract(company.Diger!, `${year}-01-01`, `${year}-12-31`);
      for (const month of ['01', '02']) await service.generate({ period: `${year}-${month}` }, now);
      const theirs = (await service.list({ company: company.Diger! }, now)).items[0]!;

      const own = await fleet.list(company.Musteri!, {}, now);
      expect(own.items.map((invoice) => invoice.period)).toEqual([`${year}-02`, `${year}-01`]);
      expect((await fleet.get(company.Musteri!, own.items[0]!.number.toLowerCase(), now)).lines).toHaveLength(1);
      expect((await refused(fleet.get(company.Musteri!, theirs.number, now))).status).toBe(404);
      expect((await refused(fleet.get(company.Musteri!, 'nope', now))).status).toBe(404);
      expect(await fleet.list(company.Bos!, {}, now)).toMatchObject({ total: 0, items: [] });
      expect((await fleet.list(company.Musteri!, { status: 'OVERDUE' }, now)).total).toBe(0);
      expect((await refused(fleet.list(company.Musteri!, { sort: 'number:asc' }, now))).status).toBe(422);
    });

    it('the summary has this month’s invoice, and what is still to be paid, late ones included', async () => {
      const { year, company, now } = await world('Ozet', 'Sessiz');
      await contract(company.Ozet!, `${year}-01-01`, `${year + 1}-12-31`);
      for (const month of ['01', '02', '06']) await service.generate({ period: `${year + (month === '06' ? 1 : 0)}-${month}` }, now);
      const rows = await prisma.fleetInvoice.findMany({ where: { companyId: company.Ozet! }, orderBy: { period: 'asc' } });
      // January was paid, February is late (due in the spring), June (this month, `now` is the 15th) is waiting.
      await prisma.fleetInvoice.update({ where: { id: rows[0]!.id }, data: { paidAt: now } });
      await prisma.fleetInvoice.update({ where: { id: rows[1]!.id }, data: { dueAt: new Date(`${year + 1}-05-01T00:00:00Z`), issuedAt: new Date(`${year + 1}-04-01T00:00:00Z`) } });

      const view = await summary.get(company.Ozet!, now);
      expect(view.invoices.thisMonth).toMatchObject({ total: rows[2]!.total, status: 'PENDING', number: rows[2]!.number });
      expect(view.invoices.unpaid).toEqual({ count: 2, total: rows[1]!.total + rows[2]!.total });
      expect(view.invoices.overdue).toBe(1);

      expect((await summary.get(company.Sessiz!, now)).invoices).toEqual({ thisMonth: null, unpaid: { count: 0, total: 0 }, overdue: 0 });
    });
  });
});
