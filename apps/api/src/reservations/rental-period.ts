import { z } from 'zod';
import { slotDate } from '../common/zod-fields.js';
import { startWindowError } from './booking-window.js';
import { DAY_MS } from '../common/time.js';

// The start and end of a rental, shared by holds, the vehicle search and reservations (QUALITY G-01).

// `startAt`: on the half hour and inside the booking window. A start outside the window still comes out as
// a date, so the range check below can look at it, but it carries the field error (IN_PAST, OUT_OF_RANGE).
export const startAtField = (now: Date) =>
  slotDate().transform((date, ctx) => {
    const windowError = startWindowError(date, now);
    if (windowError) ctx.addIssue({ code: 'custom', message: windowError });
    return date;
  });

export const endAtField = slotDate;

interface Period {
  startAt?: unknown;
  endAt?: unknown;
}

const bothDates = (value: Period): value is { startAt: Date; endAt: Date } =>
  value.startAt instanceof Date && value.endAt instanceof Date;

// The end must be after the start (INVALID_DATE_RANGE) and, where `maxDays` is given, within that many days
// of it (OUT_OF_RANGE). These run even when another field failed, so one answer names every problem.
export function withPeriodCheck<S extends z.ZodObject>(schema: S, maxDays?: number) {
  const always = { when: () => true };
  const checked = schema.check(
    z.refine((value: Period) => !bothDates(value) || value.endAt.getTime() > value.startAt.getTime(), {
      path: ['endAt'],
      error: 'INVALID_DATE_RANGE',
      ...always,
    }),
  );
  if (maxDays === undefined) return checked;
  return checked.check(
    z.refine(
      (value: Period) =>
        !bothDates(value) ||
        value.endAt.getTime() <= value.startAt.getTime() ||
        value.endAt.getTime() - value.startAt.getTime() <= maxDays * DAY_MS,
      { path: ['endAt'], error: 'OUT_OF_RANGE', ...always },
    ),
  );
}
