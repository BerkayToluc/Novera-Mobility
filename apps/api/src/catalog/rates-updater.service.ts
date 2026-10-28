import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { DAY_MS } from '../common/time.js';
import { isTestRun, ratesApiUrl } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { judgeRate, type RateCandidateState } from './rate-guard.js';

// BACKLOG Y1 (#192, ADR-15): the exchange rates are kept in the ExchangeRate table and refreshed
// from an outside service about once a day. If the service is down, the last known rate stays.
export const DEFAULT_RATES_URL = 'https://api.frankfurter.dev/v1/latest';
export const RATES_MAX_AGE_MS = DAY_MS;
export const RATES_CHECK_EVERY_MS = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;

const FOREIGN = ['EUR', 'USD'] as const;
type Foreign = (typeof FOREIGN)[number];
export type FreshRates = Record<Foreign, number>;

// Reads the answer of the rate service: { rates: { EUR: 0.018, USD: 0.020 } } for base TRY.
export function parseRates(body: unknown): FreshRates {
  const rates = (body as { rates?: Record<string, unknown> } | null)?.rates;
  if (typeof rates !== 'object' || rates === null) throw new Error('The answer has no rates');
  const result = {} as FreshRates;
  for (const currency of FOREIGN) {
    const value = rates[currency];
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      throw new Error(`The rate for ${currency} is missing or not a positive number`);
    }
    result[currency] = value;
  }
  return result;
}

@Injectable()
export class RatesUpdater implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RatesUpdater.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  // Replaceable in tests.
  fetcher: typeof fetch = (input, init) => fetch(input, init);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    // Tests never reach out to the network.
    if (isTestRun()) return;
    void this.refreshIfStale();
    this.timer = setInterval(() => void this.refreshIfStale(), RATES_CHECK_EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  // The rates are old (or missing) when either currency has no row or the oldest row is over a day old.
  async isStale(now: Date = new Date()): Promise<boolean> {
    const rows = await this.prisma.exchangeRate.findMany({
      where: { currency: { in: [...FOREIGN] } },
      select: { currency: true, updatedAt: true },
    });
    if (FOREIGN.some((currency) => !rows.some((row) => row.currency === currency))) return true;
    return rows.some((row) => now.getTime() - row.updatedAt.getTime() >= RATES_MAX_AGE_MS);
  }

  async refreshIfStale(now: Date = new Date()): Promise<boolean> {
    try {
      if (!(await this.isStale(now))) return false;
      return await this.updateRates();
    } catch (error) {
      this.logger.warn(`Rate refresh check failed: ${(error as Error).message}`);
      return false;
    }
  }

  // Fetches and stores the rates. Never throws: on any problem the stored rates stay as they are.
  async updateRates(now: Date = new Date()): Promise<boolean> {
    try {
      const url = new URL(ratesApiUrl() ?? DEFAULT_RATES_URL);
      url.searchParams.set('base', 'TRY');
      url.searchParams.set('symbols', FOREIGN.join(','));
      const response = await this.fetcher(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!response.ok) throw new Error(`The rate service answered ${response.status}`);
      const fresh = parseRates(await response.json());

      const stored = await this.prisma.exchangeRate.findMany({
        where: { currency: { in: [...FOREIGN] } },
        select: { currency: true, ratePerTry: true },
      });
      const candidates = await this.prisma.rateCandidate.findMany({ where: { currency: { in: [...FOREIGN] } } });
      // A big move is held back, and told in the log; one held currency keeps both from being stored, so the pair
      // never mixes an old and a new day.
      const held: string[] = [];
      for (const currency of FOREIGN) {
        const row = stored.find((entry) => entry.currency === currency);
        const waiting = candidates.find((entry) => entry.currency === currency);
        const candidate: RateCandidateState = waiting ? { ratePerTry: Number(waiting.ratePerTry), since: waiting.since } : null;
        const verdict = judgeRate(row ? Number(row.ratePerTry) : null, fresh[currency], candidate, now);
        if (verdict.action === 'hold') {
          held.push(`${currency} ${verdict.reason}`);
          await this.prisma.rateCandidate.upsert({
            where: { currency },
            update: { ratePerTry: verdict.candidate.ratePerTry, since: verdict.candidate.since },
            create: { currency, ratePerTry: verdict.candidate.ratePerTry, since: verdict.candidate.since },
          });
        }
      }
      if (held.length > 0) throw new Error(`Rate not stored: ${held.join('; ')}`);

      await this.prisma.rateCandidate.deleteMany({ where: { currency: { in: [...FOREIGN] } } });
      for (const currency of FOREIGN) {
        await this.prisma.exchangeRate.upsert({
          where: { currency },
          update: { ratePerTry: fresh[currency] },
          create: { currency, ratePerTry: fresh[currency] },
        });
      }
      this.logger.log(`Rates updated: EUR ${fresh.EUR}, USD ${fresh.USD}`);
      return true;
    } catch (error) {
      this.logger.warn(`Rate update failed, keeping the last known rates: ${(error as Error).message}`);
      return false;
    }
  }
}
