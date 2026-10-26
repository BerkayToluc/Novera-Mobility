import { z } from 'zod';
import { field, optionalFlag, optionalUuid, oneOf, requiredUuid } from '../common/zod-fields.js';
import { endAtField, startAtField, withPeriodCheck } from './rental-period.js';
import {
  CURRENCY_CODES,
  MAX_EXTRA_LINES,
  MAX_EXTRA_QUANTITY,
  MAX_RENTAL_DAYS,
  normalizePromoCode,
  type ExtraSelection,
} from './reservation-input.js';

// POST /reservations/price and POST /reservations (openapi.yaml ReservationRequest).

// What a visitor typed, normalized; null when none was sent; anything that is not a code is INVALID_FORMAT.
const promoCode = () =>
  field<string | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    const normalized = typeof raw === 'string' ? normalizePromoCode(raw) : null;
    return normalized ? { value: normalized } : { code: 'INVALID_FORMAT' };
  });

// One line per extra service: a known-shape slug and a quantity from 1 to 10, no service twice. The first
// problem is the answer for the whole `extras` field.
const extras = () =>
  field<ExtraSelection[]>((raw) => {
    if (raw === undefined || raw === null) return { value: [] };
    if (!Array.isArray(raw)) return { code: 'INVALID_FORMAT' };
    if (raw.length > MAX_EXTRA_LINES) return { code: 'TOO_LONG' };
    const seen = new Set<string>();
    const result: ExtraSelection[] = [];
    for (const item of raw as unknown[]) {
      if (item === null || typeof item !== 'object' || Array.isArray(item)) return { code: 'INVALID_FORMAT' };
      const { slug, quantity } = item as Record<string, unknown>;
      if (typeof slug !== 'string' || slug.trim() === '' || slug.length > 80) return { code: 'INVALID_FORMAT' };
      if (typeof quantity !== 'number' || !Number.isInteger(quantity)) return { code: 'INVALID_FORMAT' };
      if (quantity < 1 || quantity > MAX_EXTRA_QUANTITY) return { code: 'OUT_OF_RANGE' };
      if (seen.has(slug)) return { code: 'INVALID_FORMAT' }; // the same service is not sent twice
      seen.add(slug);
      result.push({ slug, quantity });
    }
    return { value: result };
  });

export const reservationRequestSchema = (now: Date) =>
  withPeriodCheck(
    z.object({
      vehicleId: requiredUuid(),
      holdId: optionalUuid(),
      pickupBranchId: requiredUuid(),
      returnBranchId: requiredUuid(),
      startAt: startAtField(now),
      endAt: endAtField(),
      currency: oneOf(CURRENCY_CODES),
      extras: extras(),
      usePoints: optionalFlag().transform((value) => value ?? false),
      promoCode: promoCode(),
    }),
    MAX_RENTAL_DAYS,
  );
