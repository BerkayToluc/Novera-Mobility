import { DAY_MS } from '../common/time.js';

// The days of the fleet (contracts, maintenance, inspection) are calendar days, kept as `date` columns: the same day in every time
// zone. They are written as "2026-10-31" and read back the same way.
export const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// "2026-10-31" as a `Date` at 00:00 UTC (what a `date` column is read and written as), or `null` for what is not a real day.
export function parseDay(value: string): Date | null {
  if (!DAY_PATTERN.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  const same = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return same && year >= 2000 && year <= 2100 ? date : null;
}

export const dayOf = (date: Date | null): string | null => (date ? date.toISOString().slice(0, 10) : null);

export const addDays = (date: Date, days: number): Date => new Date(date.getTime() + days * DAY_MS);

// Whole days from `from` to `to` (both days, no time): negative when `to` is before `from`.
export const daysBetween = (from: Date, to: Date): number => Math.round((to.getTime() - from.getTime()) / DAY_MS);
