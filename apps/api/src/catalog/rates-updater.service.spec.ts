import type { PrismaService } from '../prisma/prisma.service.js';
import { MAX_RATE_JUMP } from './rate-guard.js';
import { RATES_MAX_AGE_MS, RatesUpdater, parseRates } from './rates-updater.service.js';

// Unit test: the database and the rate service are faked in memory.
type Row = { currency: string; ratePerTry: number; updatedAt: Date };
type Candidate = { currency: string; ratePerTry: number; since: Date };

const NOW = new Date('2026-10-16T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;

function setup(rows: Row[], answer: () => Promise<Response>, candidates: Candidate[] = []) {
  const upserts: Array<{ currency: string; ratePerTry: number }> = [];
  const prisma = {
    rateCandidate: {
      findMany: async () => candidates,
      upsert: async ({
        where,
        create,
      }: {
        where: { currency: string };
        create: { ratePerTry: number; since: Date };
      }) => {
        const at = candidates.findIndex((entry) => entry.currency === where.currency);
        const next = { currency: where.currency, ratePerTry: create.ratePerTry, since: create.since };
        if (at >= 0) candidates[at] = next;
        else candidates.push(next);
      },
      deleteMany: async () => {
        candidates.length = 0;
      },
    },
    exchangeRate: {
      findMany: async () => rows,
      upsert: async ({ where, update }: { where: { currency: string }; update: { ratePerTry: number } }) => {
        upserts.push({ currency: where.currency, ratePerTry: update.ratePerTry });
      },
    },
  } as unknown as PrismaService;
  const updater = new RatesUpdater(prisma);
  const calls: string[] = [];
  updater.fetcher = (async (input: URL | string) => {
    calls.push(String(input));
    return answer();
  }) as typeof fetch;
  return { updater, upserts, calls, candidates };
}

const json =
  (body: unknown, status = 200) =>
  async () =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const fresh = (age: number): Row[] => [
  { currency: 'EUR', ratePerTry: 0.018, updatedAt: new Date(NOW.getTime() - age) },
  { currency: 'USD', ratePerTry: 0.02, updatedAt: new Date(NOW.getTime() - age) },
];

describe('parseRates', () => {
  it('reads EUR and USD', () => {
    expect(parseRates({ rates: { EUR: 0.018, USD: 0.02 } })).toEqual({ EUR: 0.018, USD: 0.02 });
  });

  it.each([
    [null],
    [{}],
    [{ rates: { EUR: 0.018 } }],
    [{ rates: { EUR: 0, USD: 0.02 } }],
    [{ rates: { EUR: '0.018', USD: 0.02 } }],
    [{ rates: { EUR: -1, USD: 0.02 } }],
  ])('rejects %j', (body) => {
    expect(() => parseRates(body)).toThrow();
  });
});

describe('RatesUpdater.updateRates', () => {
  it('stores both rates and asks for base TRY', async () => {
    const { updater, upserts, calls } = setup(fresh(HOUR), json({ rates: { EUR: 0.0181, USD: 0.0203 } }));
    expect(await updater.updateRates()).toBe(true);
    expect(upserts).toEqual([
      { currency: 'EUR', ratePerTry: 0.0181 },
      { currency: 'USD', ratePerTry: 0.0203 },
    ]);
    expect(calls[0]).toContain('base=TRY');
    expect(calls[0]).toContain('symbols=EUR%2CUSD');
  });

  it('keeps the last known rates when the service is down', async () => {
    const down = setup(fresh(HOUR), async () => {
      throw new Error('network down');
    });
    expect(await down.updater.updateRates()).toBe(false);
    expect(down.upserts).toEqual([]);

    const error = setup(fresh(HOUR), json({ message: 'oops' }, 503));
    expect(await error.updater.updateRates()).toBe(false);
    expect(error.upserts).toEqual([]);
  });

  it('keeps the rates when the answer is malformed', async () => {
    const { updater, upserts } = setup(fresh(HOUR), json({ rates: { EUR: 'x' } }));
    expect(await updater.updateRates()).toBe(false);
    expect(upserts).toEqual([]);
  });

  it('refuses a rate that jumps too far from the stored one, and writes nothing', async () => {
    const jumped = 0.018 * (1 + MAX_RATE_JUMP + 0.2);
    const { updater, upserts } = setup(fresh(HOUR), json({ rates: { EUR: jumped, USD: 0.02 } }));
    expect(await updater.updateRates()).toBe(false);
    expect(upserts).toEqual([]);
  });

  it('writes a refused rate down as a candidate, and says so', async () => {
    const jumped = 0.018 * (1 + MAX_RATE_JUMP + 0.2);
    const { updater, candidates } = setup(fresh(HOUR), json({ rates: { EUR: jumped, USD: 0.02 } }));
    await updater.updateRates(NOW);
    expect(candidates).toEqual([{ currency: 'EUR', ratePerTry: jumped, since: NOW }]);
  });

  // QUALITY V-10: a big move that the feed keeps repeating is believed on the third day.
  it('takes a big, lasting move on the third day, and not before', async () => {
    const jumped = 0.018 * (1 + MAX_RATE_JUMP + 0.2);
    const answer = json({ rates: { EUR: jumped, USD: 0.02 } });
    const day = (n: number) => new Date(NOW.getTime() + n * 24 * HOUR);
    const { updater, upserts, candidates } = setup(fresh(HOUR), answer);
    expect(await updater.updateRates(day(0))).toBe(false);
    expect(await updater.updateRates(day(1))).toBe(false);
    expect(upserts).toEqual([]);
    expect(candidates[0]!.since).toEqual(day(0));
    expect(await updater.updateRates(day(2))).toBe(true);
    expect(upserts).toEqual([
      { currency: 'EUR', ratePerTry: jumped },
      { currency: 'USD', ratePerTry: 0.02 },
    ]);
    expect(candidates).toEqual([]);
  });

  it('starts over when the feed goes back to normal in between', async () => {
    const jumped = 0.018 * (1 + MAX_RATE_JUMP + 0.2);
    const day = (n: number) => new Date(NOW.getTime() + n * 24 * HOUR);
    const { updater, upserts, candidates } = setup(fresh(HOUR), json({ rates: { EUR: jumped, USD: 0.02 } }));
    await updater.updateRates(day(0));
    expect(candidates).toHaveLength(1);
    updater.fetcher = (async () => new Response(JSON.stringify({ rates: { EUR: 0.0182, USD: 0.02 } }))) as typeof fetch;
    expect(await updater.updateRates(day(1))).toBe(true);
    expect(candidates).toEqual([]);
    expect(upserts).toHaveLength(2);
  });

  it('stores the first rates when the table is empty', async () => {
    const { updater, upserts } = setup([], json({ rates: { EUR: 0.018, USD: 0.02 } }));
    expect(await updater.updateRates()).toBe(true);
    expect(upserts).toHaveLength(2);
  });
});

describe('RatesUpdater.refreshIfStale', () => {
  const answer = json({ rates: { EUR: 0.0181, USD: 0.0203 } });

  it('does not call the service while the rates are under a day old', async () => {
    const { updater, calls } = setup(fresh(RATES_MAX_AGE_MS - HOUR), answer);
    expect(await updater.refreshIfStale(NOW)).toBe(false);
    expect(calls).toEqual([]);
  });

  it('updates when the rates are a day old', async () => {
    const { updater, calls, upserts } = setup(fresh(RATES_MAX_AGE_MS + HOUR), answer);
    expect(await updater.refreshIfStale(NOW)).toBe(true);
    expect(calls).toHaveLength(1);
    expect(upserts).toHaveLength(2);
  });

  it('updates when a currency has no row', async () => {
    const { updater, calls } = setup(fresh(HOUR).slice(0, 1), answer);
    expect(await updater.refreshIfStale(NOW)).toBe(true);
    expect(calls).toHaveLength(1);
  });
});
