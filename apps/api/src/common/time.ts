// One definition of the time constants the API counts in (V2-13, QUALITY M-01); they were declared in six files.
export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

// The number of days a rental is charged for: the period divided by 24 hours, rounded up, at least 1.
export function rentalDays(startAt: Date, endAt: Date): number {
  return Math.max(1, Math.ceil((endAt.getTime() - startAt.getTime()) / DAY_MS));
}
