import { isPromoUsable } from '../reservations/pricing.service.js';
import { promoStatus } from './promo-codes.view.js';

const NOW = new Date('2026-10-29T12:00:00Z');
const at = (iso: string) => new Date(iso);
const code = (overrides: Partial<Parameters<typeof promoStatus>[0]> = {}) => ({
  active: true,
  validFrom: null,
  validUntil: null,
  maxRedemptions: null,
  ...overrides,
});

describe('promoStatus (V2-26)', () => {
  it('a code that is on, inside its dates and under its cap is ACTIVE', () => {
    expect(promoStatus(code(), 0, NOW)).toBe('ACTIVE');
    expect(promoStatus(code({ validFrom: at('2026-10-01T00:00:00Z'), validUntil: at('2026-12-01T00:00:00Z'), maxRedemptions: 5 }), 4, NOW)).toBe('ACTIVE');
  });

  it('a switched-off code is INACTIVE whatever else is true of it', () => {
    expect(promoStatus(code({ active: false }), 0, NOW)).toBe('INACTIVE');
    expect(promoStatus(code({ active: false, validUntil: at('2026-01-01T00:00:00Z'), maxRedemptions: 1 }), 9, NOW)).toBe('INACTIVE');
  });

  it('is EXPIRED from the very instant it ends: the end is not part of the period', () => {
    expect(promoStatus(code({ validUntil: at('2026-10-29T12:00:00Z') }), 0, NOW)).toBe('EXPIRED');
    expect(promoStatus(code({ validUntil: at('2026-10-29T12:00:00.001Z') }), 0, NOW)).toBe('ACTIVE');
  });

  it('is EXHAUSTED when the uses reach the cap, and not before', () => {
    expect(promoStatus(code({ maxRedemptions: 3 }), 2, NOW)).toBe('ACTIVE');
    expect(promoStatus(code({ maxRedemptions: 3 }), 3, NOW)).toBe('EXHAUSTED');
  });

  it('is SCHEDULED until its start, and the start itself counts as begun', () => {
    expect(promoStatus(code({ validFrom: at('2026-10-30T00:00:00Z') }), 0, NOW)).toBe('SCHEDULED');
    expect(promoStatus(code({ validFrom: at('2026-10-29T12:00:00Z') }), 0, NOW)).toBe('ACTIVE');
  });

  it('gives one answer when several are true: past its end beats used up beats not started', () => {
    expect(promoStatus(code({ validUntil: at('2026-01-01T00:00:00Z'), maxRedemptions: 1 }), 5, NOW)).toBe('EXPIRED');
    expect(promoStatus(code({ validFrom: at('2026-12-01T00:00:00Z'), maxRedemptions: 1 }), 1, NOW)).toBe('EXHAUSTED');
  });

  // The list says ACTIVE only for a code the booking would take: both read the same dates the same way.
  it('agrees with the check made at booking time on the dates and the switch', () => {
    const samples = [
      code(),
      code({ active: false }),
      code({ validUntil: at('2026-10-29T12:00:00Z') }),
      code({ validUntil: at('2026-10-29T12:00:00.001Z') }),
      code({ validFrom: at('2026-10-29T12:00:00Z') }),
      code({ validFrom: at('2026-10-29T12:00:00.001Z') }),
    ];
    for (const sample of samples) {
      expect(promoStatus(sample, 0, NOW) === 'ACTIVE').toBe(isPromoUsable(sample, NOW));
    }
  });
});
