import 'dotenv/config';
import { randomInt, randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { QuotesService } from '../../forms/quotes.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AdminQuotesService } from './quotes.service.js';

// The quote request administration against a real PostgreSQL (TEST_DATABASE_URL), like the other integration tests; skipped
// without one. The test database is shared with suites that run at the same time, so every list is narrowed to this run's own
// requests by a word in the company name.
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

describeDb('quote request administration against the database (V2-32)', () => {
  let prisma: PrismaService;
  let service: AdminQuotesService;
  let customerService: QuotesService;
  const run = randomUUID().slice(0, 8);
  const made: string[] = [];
  let accountId = '';

  const numberOf = () => `TKL-2999-${randomInt(10_000_000, 99_999_999)}`;
  const quote = async (overrides: Record<string, unknown> = {}) => {
    const row = await prisma.quoteRequest.create({
      data: {
        number: numberOf(),
        companyName: `Ege Lojistik ${run}`,
        contactName: 'Ayşe Yılmaz',
        email: `ayse-${run}@example.test`,
        phone: '+90 212 555 01 01',
        vehicleCount: 8,
        durationMonths: 12,
        vehicleType: 'SUV',
        deliveryCities: 'İzmir, Ankara',
        notes: 'İlk teslim kasım ayında.',
        ...overrides,
      },
    });
    made.push(row.id);
    return row;
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    service = new AdminQuotesService(prisma);
    customerService = new QuotesService(prisma);
    accountId = (await prisma.user.create({ data: { email: `kurumsal-${run}@example.test`, passwordHash: 'x', firstName: 'Kurumsal', lastName: 'Hesap', accountType: 'CORPORATE' } })).id;
  });

  afterAll(async () => {
    await prisma.quoteRequest.deleteMany({ where: { id: { in: made } } });
    await prisma.user.deleteMany({ where: { id: accountId } });
    await prisma.$disconnect();
  });

  describe('listing', () => {
    it('lists the requests newest first, with the company, the person, the figures and the state', async () => {
      const older = await quote({ createdAt: new Date('2098-01-01T10:00:00Z') });
      const newer = await quote({ createdAt: new Date('2098-02-01T10:00:00Z'), source: 'FLEET_RENEWAL', status: 'IN_REVIEW' });
      const page = await service.list({ q: run, pageSize: '100' });
      const numbers = page.items.map((item) => item.number);
      expect(numbers.indexOf(newer.number)).toBeLessThan(numbers.indexOf(older.number));
      expect(page.items.find((item) => item.number === newer.number)).toMatchObject({
        status: 'IN_REVIEW',
        source: 'FLEET_RENEWAL',
        companyName: `Ege Lojistik ${run}`,
        contactName: 'Ayşe Yılmaz',
        vehicleCount: 8,
        durationMonths: 12,
        anonymized: false,
      });
    });

    it('finds a request by a part of its number, the company or the e-mail, whatever the case', async () => {
      const row = await quote();
      for (const q of [row.number, row.number.toLowerCase(), row.number.slice(-7), `AYSE-${run.toUpperCase()}@EXAMPLE`]) {
        expect((await service.list({ q })).items.map((item) => item.number)).toContain(row.number);
      }
      expect((await service.list({ q: `ege lojistik ${run}` })).items.map((item) => item.number)).toContain(row.number);
      expect((await service.list({ q: `nobody-${run}` })).total).toBe(0);
    });

    it('narrows by state and by where it came from', async () => {
      const offered = await quote({ status: 'OFFERED' });
      const closed = await quote({ status: 'CLOSED' });
      const renewal = await quote({ source: 'FLEET_RENEWAL' });
      const numbers = (extra: Record<string, unknown>) => service.list({ q: run, pageSize: '100', ...extra }).then((page) => page.items.map((item) => item.number));
      expect(await numbers({ status: 'OFFERED' })).toContain(offered.number);
      expect(await numbers({ status: 'OFFERED' })).not.toContain(closed.number);
      expect(await numbers({ status: 'CLOSED' })).toContain(closed.number);
      expect(await numbers({ source: 'FLEET_RENEWAL' })).toContain(renewal.number);
      expect(await numbers({ source: 'FLEET_RENEWAL' })).not.toContain(offered.number);
    });

    it('pages with a total that does not change, and every request comes once', async () => {
      const same = new Date('2097-05-05T10:00:00Z');
      for (let index = 0; index < 5; index += 1) await quote({ companyName: `Sayfa ${run}`, createdAt: same });
      const all = await service.list({ q: `sayfa ${run}`, pageSize: '100' });
      const first = await service.list({ q: `sayfa ${run}`, pageSize: '2', page: '1' });
      const second = await service.list({ q: `sayfa ${run}`, pageSize: '2', page: '2' });
      expect(first.total).toBe(5);
      expect(all.total).toBe(5);
      const seen = [...first.items, ...second.items].map((item) => item.number);
      expect(new Set(seen).size).toBe(4);
      expect(seen).toEqual(all.items.slice(0, 4).map((item) => item.number));
    });

    it('is 422 for a state, a source or a sort that makes no sense', async () => {
      expect((await refused(service.list({ status: 'GONE' }))).body).toMatchObject({ fieldErrors: { status: 'INVALID_FORMAT' } });
      expect((await refused(service.list({ source: 'MAIL' }))).body).toMatchObject({ fieldErrors: { source: 'INVALID_FORMAT' } });
      expect((await refused(service.list({ sort: 'internalNote:asc' }))).body).toMatchObject({ fieldErrors: { sort: 'INVALID_FORMAT' } });
    });

    it('lists a request whose personal fields were erased, marked as such', async () => {
      const row = await quote({ contactName: 'Silindi', email: '', phone: null, notes: null, anonymizedAt: new Date() });
      const detail = await service.get(row.number);
      expect(detail).toMatchObject({ anonymized: true, contactName: 'Silindi', email: '', companyName: `Ege Lojistik ${run}` });
    });
  });

  describe('one request', () => {
    it('gives everything the customer wrote, the note, the account, and what it can be moved to', async () => {
      const row = await quote({ internalNote: 'Fiyat listesi gönderildi.', userId: accountId, status: 'IN_REVIEW' });
      const detail = await service.get(row.number.toLowerCase());
      expect(detail).toMatchObject({
        number: row.number,
        status: 'IN_REVIEW',
        phone: '+90 212 555 01 01',
        deliveryCities: 'İzmir, Ankara',
        notes: 'İlk teslim kasım ayında.',
        internalNote: 'Fiyat listesi gönderildi.',
        account: { email: `kurumsal-${run}@example.test` },
        nextStatuses: ['OFFERED', 'CLOSED'],
      });
    });

    it('is 404 for a number that is not there or cannot be one', async () => {
      expect((await refused(service.get('TKL-2999-00000000'))).status).toBe(404);
      expect((await refused(service.get('not-a-number'))).status).toBe(404);
      expect((await refused(service.update('not-a-number', { updatedAt: new Date().toISOString(), status: 'CLOSED' }))).status).toBe(404);
    });
  });

  describe('moving it on', () => {
    it('goes forward one step at a time and moves the version on', async () => {
      const row = await quote();
      const reviewing = await service.update(row.number, { updatedAt: row.updatedAt.toISOString(), status: 'IN_REVIEW' });
      expect(reviewing).toMatchObject({ status: 'IN_REVIEW', nextStatuses: ['OFFERED', 'CLOSED'] });
      expect(reviewing.updatedAt).not.toBe(row.updatedAt.toISOString());
      const offered = await service.update(row.number, { updatedAt: reviewing.updatedAt, status: 'OFFERED' });
      expect(offered.status).toBe('OFFERED');
      const closed = await service.update(row.number, { updatedAt: offered.updatedAt, status: 'CLOSED' });
      expect(closed).toMatchObject({ status: 'CLOSED', nextStatuses: [] });
    });

    it('may skip ahead: a request that is answered at once goes straight to offered or closed', async () => {
      const first = await quote();
      expect((await service.update(first.number, { updatedAt: first.updatedAt.toISOString(), status: 'OFFERED' })).status).toBe('OFFERED');
      const second = await quote();
      expect((await service.update(second.number, { updatedAt: second.updatedAt.toISOString(), status: 'CLOSED' })).status).toBe('CLOSED');
    });

    it('never goes back: 409 INVALID_TRANSITION and nothing is written, not even the note sent with it', async () => {
      const row = await quote({ status: 'OFFERED' });
      const answer = await refused(service.update(row.number, { updatedAt: row.updatedAt.toISOString(), status: 'IN_REVIEW', internalNote: 'Geri almak istedim' }));
      expect(answer).toMatchObject({ status: 409, body: { code: 'INVALID_TRANSITION' } });
      const stored = await prisma.quoteRequest.findUniqueOrThrow({ where: { id: row.id } });
      expect(stored).toMatchObject({ status: 'OFFERED', internalNote: null });
      expect(stored.updatedAt.getTime()).toBe(row.updatedAt.getTime());
      // A closed one cannot be opened again, either.
      const closed = await quote({ status: 'CLOSED' });
      expect((await refused(service.update(closed.number, { updatedAt: closed.updatedAt.toISOString(), status: 'RECEIVED' }))).body).toMatchObject({ code: 'INVALID_TRANSITION' });
    });

    it('asking for the state it is already in is no error and changes nothing', async () => {
      const row = await quote({ status: 'IN_REVIEW' });
      const same = await service.update(row.number, { updatedAt: row.updatedAt.toISOString(), status: 'IN_REVIEW' });
      expect(same).toMatchObject({ status: 'IN_REVIEW', updatedAt: row.updatedAt.toISOString() });
    });

    it('is 422 for a state that does not exist', async () => {
      const row = await quote();
      expect((await refused(service.update(row.number, { updatedAt: row.updatedAt.toISOString(), status: 'DONE' }))).body).toMatchObject({ fieldErrors: { status: 'INVALID_FORMAT' } });
    });
  });

  describe('the internal note', () => {
    it('is written, changed and cleared, and a change of the note alone leaves the state', async () => {
      const row = await quote({ status: 'IN_REVIEW' });
      const written = await service.update(row.number, { updatedAt: row.updatedAt.toISOString(), internalNote: '  Cuma günü aranacak.  ' });
      expect(written).toMatchObject({ internalNote: 'Cuma günü aranacak.', status: 'IN_REVIEW' });
      const cleared = await service.update(row.number, { updatedAt: written.updatedAt, internalNote: '   ' });
      expect(cleared.internalNote).toBeNull();
      const again = await service.update(row.number, { updatedAt: cleared.updatedAt, internalNote: 'Tekrar yazıldı', status: 'OFFERED' });
      expect(again).toMatchObject({ internalNote: 'Tekrar yazıldı', status: 'OFFERED' });
      const nulled = await service.update(row.number, { updatedAt: again.updatedAt, internalNote: null });
      expect(nulled.internalNote).toBeNull();
    });

    it('is at most 2000 characters, and the database itself refuses more', async () => {
      const row = await quote();
      expect((await refused(service.update(row.number, { updatedAt: row.updatedAt.toISOString(), internalNote: 'x'.repeat(2001) }))).body).toMatchObject({ fieldErrors: { internalNote: 'TOO_LONG' } });
      expect((await service.update(row.number, { updatedAt: row.updatedAt.toISOString(), internalNote: 'x'.repeat(2000) })).internalNote).toHaveLength(2000);
      await expect(prisma.quoteRequest.update({ where: { id: row.id }, data: { internalNote: 'x'.repeat(2001) } })).rejects.toThrow();
    });

    it('is on the request of an account whose personal fields were erased too', async () => {
      const row = await quote({ contactName: 'Silindi', email: '', anonymizedAt: new Date() });
      expect((await service.update(row.number, { updatedAt: row.updatedAt.toISOString(), internalNote: 'Kayıt silindi, not kalır.' })).internalNote).toBe('Kayıt silindi, not kalır.');
    });
  });

  describe('two people at once', () => {
    it('an edit made against an old version is 409 STALE_WRITE and writes nothing', async () => {
      const row = await quote();
      await service.update(row.number, { updatedAt: row.updatedAt.toISOString(), internalNote: 'İlk not' });
      const answer = await refused(service.update(row.number, { updatedAt: row.updatedAt.toISOString(), status: 'OFFERED' }));
      expect(answer).toMatchObject({ status: 409, body: { code: 'STALE_WRITE' } });
      expect(await prisma.quoteRequest.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ status: 'RECEIVED', internalNote: 'İlk not' });
    });

    it('two edits started together with the same version: one wins, the other is told', async () => {
      const row = await quote();
      const version = row.updatedAt.toISOString();
      const results = await Promise.allSettled([
        service.update(row.number, { updatedAt: version, internalNote: 'Birinci' }),
        service.update(row.number, { updatedAt: version, internalNote: 'İkinci' }),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      const lost = results.find((result) => result.status === 'rejected') as PromiseRejectedResult;
      expect((lost.reason as HttpException).getResponse()).toMatchObject({ code: 'STALE_WRITE' });
    });
  });

  describe('what the customer sees', () => {
    it('shows the new state on the account, and never the note', async () => {
      const row = await quote({ userId: accountId });
      const moved = await service.update(row.number, { updatedAt: row.updatedAt.toISOString(), status: 'OFFERED', internalNote: 'Gizli: indirim payı %12.' });
      expect(moved.internalNote).toBe('Gizli: indirim payı %12.');

      const mine = await customerService.listMine(accountId);
      const seen = mine.find((entry) => entry.number === row.number);
      expect(seen).toMatchObject({ status: 'OFFERED' });
      expect(Object.keys(seen ?? {}).sort()).toEqual(['createdAt', 'durationMonths', 'id', 'number', 'productSlug', 'status', 'vehicleCount']);
      expect(JSON.stringify(mine)).not.toContain('Gizli');

      const closed = await service.update(row.number, { updatedAt: moved.updatedAt, status: 'CLOSED' });
      expect(closed.status).toBe('CLOSED');
      expect((await customerService.listMine(accountId)).find((entry) => entry.number === row.number)?.status).toBe('CLOSED');
    });
  });
});
