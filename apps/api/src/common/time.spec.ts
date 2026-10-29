import { istanbulDay } from './time.js';

describe('istanbulDay (V2-25)', () => {
  const iso = (date: Date) => date.toISOString();

  it('gives the range of the Istanbul calendar day that contains the moment', () => {
    // 15:00 UTC is 18:00 in Istanbul (UTC+3, no daylight saving).
    const day = istanbulDay(new Date('2026-10-29T15:00:00Z'));
    expect(day.date).toBe('2026-10-29');
    expect(iso(day.start)).toBe('2026-10-28T21:00:00.000Z');
    expect(iso(day.end)).toBe('2026-10-29T21:00:00.000Z');
  });

  it('turns over at Istanbul midnight, not at UTC midnight', () => {
    // One second before and exactly at 00:00 on 30 October in Istanbul.
    expect(istanbulDay(new Date('2026-10-29T20:59:59Z')).date).toBe('2026-10-29');
    expect(istanbulDay(new Date('2026-10-29T21:00:00Z')).date).toBe('2026-10-30');
    // 22:00 UTC is already the next day there; the UTC date would still say the 29th.
    expect(istanbulDay(new Date('2026-10-29T22:00:00Z')).date).toBe('2026-10-30');
  });

  it('the day is half-open: its start belongs to it, its end to the next day', () => {
    const day = istanbulDay(new Date('2026-10-29T12:00:00Z'));
    expect(istanbulDay(day.start).date).toBe('2026-10-29');
    expect(istanbulDay(day.end).date).toBe('2026-10-30');
    expect(istanbulDay(new Date(day.end.getTime() - 1)).date).toBe('2026-10-29');
  });

  it('the seven-day window is today and the six days before it', () => {
    const day = istanbulDay(new Date('2026-10-29T15:00:00Z'));
    expect(iso(day.weekStart)).toBe('2026-10-22T21:00:00.000Z');
    expect(istanbulDay(day.weekStart).date).toBe('2026-10-23');
  });

  it('crosses a month and a year end', () => {
    expect(istanbulDay(new Date('2026-12-31T21:30:00Z')).date).toBe('2027-01-01');
    expect(istanbulDay(new Date('2027-01-02T10:00:00Z')).weekStart.toISOString()).toBe('2026-12-26T21:00:00.000Z');
  });
});
