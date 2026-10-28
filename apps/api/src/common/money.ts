import type { Currency } from '../generated/prisma/client.js';
import type { Db } from './db.js';

// Used when the table has no rate for a currency yet (the first run before the rates were fetched): 1 TRY in that
// currency. One definition (V2-13, QUALITY V-10); the catalog and the price calculation had a copy each.
export const FALLBACK_RATES: Record<Currency, number> = { TRY: 1, EUR: 0.02, USD: 0.023 };

export async function getRate(db: Db<'exchangeRate'>, currency: Currency): Promise<number> {
  if (currency === 'TRY') return 1;
  const row = await db.exchangeRate.findUnique({ where: { currency } });
  return row ? Number(row.ratePerTry) : FALLBACK_RATES[currency];
}

// Converts an amount in kuruş to the smallest unit of `currency`. The unit price is converted first and then
// multiplied by the days or the quantity, so the lines of a price add up to its total (ADR-15).
export function convertMinor(tryMinor: number, rate: number, currency: Currency): number {
  return currency === 'TRY' ? tryMinor : Math.round(tryMinor * rate);
}

export function toMoney(tryMinor: number, rate: number, currency: Currency) {
  return { amount: convertMinor(tryMinor, rate, currency), currency };
}
