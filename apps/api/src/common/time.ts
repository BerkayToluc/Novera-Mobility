// One definition of the time constants the API counts in (V2-13, QUALITY M-01); they were declared in six files.
export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

// The number of days a rental is charged for: the period divided by 24 hours, rounded up, at least 1.
export function rentalDays(startAt: Date, endAt: Date): number {
  return Math.max(1, Math.ceil((endAt.getTime() - startAt.getTime()) / DAY_MS));
}

const ISTANBUL = 'Europe/Istanbul';

// The offset of Istanbul from UTC at an instant, in ms. Read from the time zone database, not hard-coded to +3, so a
// future rule change is followed without touching this file.
function istanbulOffsetMs(at: Date): number {
  const name =
    new Intl.DateTimeFormat('en-US', { timeZone: ISTANBUL, timeZoneName: 'longOffset' })
      .formatToParts(at)
      .find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return (match[1] === '-' ? -1 : 1) * minutes * MINUTE_MS;
}

// The instant an Istanbul calendar day starts (00:00 there). `dayOffset` moves the day: -6 is six days before.
function istanbulMidnight(year: number, month: number, day: number, dayOffset = 0): Date {
  const utcMidnight = Date.UTC(year, month - 1, day + dayOffset);
  return new Date(utcMidnight - istanbulOffsetMs(new Date(utcMidnight - istanbulOffsetMs(new Date(utcMidnight)))));
}

// The Istanbul calendar day that contains `now`: its date and the half-open range [start, end) of instants it covers.
// "Today" on the administration screens means this, whatever time zone the server or the browser is in (V2-25).
export function istanbulDay(now: Date): { date: string; start: Date; end: Date; weekStart: Date } {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: ISTANBUL, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return {
    date,
    start: istanbulMidnight(year, month, day),
    end: istanbulMidnight(year, month, day, 1),
    // The first instant of the seven-day window that ends today: today and the six days before it.
    weekStart: istanbulMidnight(year, month, day, -6),
  };
}

// The instant an Istanbul calendar day starts, from its date as people write it ("2026-10-30"); `dayOffset` 1 gives the start of
// the next day, so a range "from the 1st to the 3rd, both days included" is [start of the 1st, start of the 4th) (V2-31).
export function istanbulDateStart(date: string, dayOffset = 0): Date {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return istanbulMidnight(year, month, day, dayOffset);
}
