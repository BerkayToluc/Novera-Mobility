import { DAY_MS } from '../common/time.js';

// When a rental may start (QUALITY G-01). A start in the past let a booking "end" at once and pay out its
// points the same minute, so the earliest start is one slot ahead of now and the latest is a year away.
export const MIN_START_LEAD_MINUTES = 30;
export const MAX_START_AHEAD_DAYS = 365;

const MINUTE_MS = 60_000;

// A field-error code for a start time outside the window, or null when it is fine.
export function startWindowError(startAt: Date, now: Date): 'IN_PAST' | 'OUT_OF_RANGE' | null {
  const start = startAt.getTime();
  if (start < now.getTime() + MIN_START_LEAD_MINUTES * MINUTE_MS) return 'IN_PAST';
  if (start > now.getTime() + MAX_START_AHEAD_DAYS * DAY_MS) return 'OUT_OF_RANGE';
  return null;
}
