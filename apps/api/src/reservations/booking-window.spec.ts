import { MAX_START_AHEAD_DAYS, MIN_START_LEAD_MINUTES, startWindowError } from './booking-window.js';

const NOW = new Date('2026-10-24T12:10:00.000Z');
const at = (offsetMinutes: number) => new Date(NOW.getTime() + offsetMinutes * 60_000);

describe('startWindowError', () => {
  it('refuses a start in the past', () => {
    expect(startWindowError(at(-1), NOW)).toBe('IN_PAST');
    expect(startWindowError(at(-60 * 24 * 365), NOW)).toBe('IN_PAST');
  });

  it('refuses a start closer than the minimum lead, accepts it exactly at the lead', () => {
    expect(startWindowError(NOW, NOW)).toBe('IN_PAST');
    expect(startWindowError(at(MIN_START_LEAD_MINUTES - 1), NOW)).toBe('IN_PAST');
    expect(startWindowError(at(MIN_START_LEAD_MINUTES), NOW)).toBeNull();
  });

  it('refuses a start more than a year away, accepts it exactly a year away', () => {
    const limit = MAX_START_AHEAD_DAYS * 24 * 60;
    expect(startWindowError(at(limit), NOW)).toBeNull();
    expect(startWindowError(at(limit + 1), NOW)).toBe('OUT_OF_RANGE');
  });
});
