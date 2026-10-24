// Specs that go through the start-time check (booking-window.ts) need dates that stay valid as the real
// clock moves, so they are built from today instead of written as literals.
const DAY_MS = 86_400_000;

// 10:00 UTC (a 30-minute slot) `days` days from today.
export function daysAhead(days: number, hour = 10): Date {
  const today = new Date();
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + days, hour));
}

const SLOT_MS = 30 * 60_000;

// The first 30-minute slot at or after `minutes` minutes from now: the earliest start the API accepts when
// `minutes` is 30.
export function slotAtLeast(minutes: number): Date {
  return new Date(Math.ceil((Date.now() + minutes * 60_000) / SLOT_MS) * SLOT_MS);
}

// The last 30-minute slot strictly before `minutes` minutes from now: the latest start the API refuses.
export function slotBefore(minutes: number): Date {
  return new Date((Math.ceil((Date.now() + minutes * 60_000) / SLOT_MS) - 1) * SLOT_MS);
}

export { DAY_MS };
