import { z } from 'zod';
import { normalizePromoCode } from '../reservations/reservation-input.js';
import { field, integer, optionalFlag, optionalText } from '../common/zod-fields.js';
import { pageFields, sortField } from './admin-list.js';
import { PROMO_STATUSES } from './promo-codes.view.js';

// The input of the campaign code endpoints (V2-26, ADMIN.md §3.1). Field problems are the fixed codes of ADR-17.
export const MAX_REDEMPTIONS_LIMIT = 1_000_000;

// A code as typed: spaces and case do not matter, then letters and digits only, 3 to 20 (the booking form reads it the
// same way, `normalizePromoCode`). Anything else is not a code.
const codeField = () =>
  field<string>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { code: 'REQUIRED' };
    if (typeof raw !== 'string') return { code: 'INVALID_FORMAT' };
    const code = normalizePromoCode(raw);
    return code ? { value: code } : { code: 'INVALID_FORMAT' };
  });

// A date-time as an ISO string. `undefined` is "not sent" (a change leaves it as it is), `null` is "none" (a clear).
const optionalDate = () =>
  field<Date | null | undefined>((raw) => {
    if (raw === undefined) return { value: undefined };
    if (raw === null || raw === '') return { value: null };
    const date = typeof raw === 'string' ? new Date(raw) : null;
    return date && !Number.isNaN(date.getTime()) ? { value: date } : { code: 'INVALID_FORMAT' };
  });

const optionalCap = () =>
  field<number | null | undefined>((raw) => {
    if (raw === undefined) return { value: undefined };
    if (raw === null || raw === '') return { value: null };
    if (typeof raw !== 'number' || !Number.isInteger(raw)) return { code: 'INVALID_FORMAT' };
    return raw < 1 || raw > MAX_REDEMPTIONS_LIMIT ? { code: 'OUT_OF_RANGE' } : { value: raw };
  });

// A flag that, when sent, has to be a boolean (null is not a way to say "default" on a change).
const sentFlag = () =>
  field<boolean | undefined>((raw) => {
    if (raw === undefined) return { value: undefined };
    return typeof raw === 'boolean' ? { value: raw } : { code: 'INVALID_FORMAT' };
  });

export const createPromoSchema = z.object({
  code: codeField(),
  percent: integer(1, 90),
  active: optionalFlag(),
  validFrom: optionalDate(),
  validUntil: optionalDate(),
  maxRedemptions: optionalCap(),
  oncePerUser: optionalFlag(),
});

// A change names only what it changes, and always the version it was made against.
export const updatePromoSchema = z.object({
  updatedAt: field<Date>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { code: 'REQUIRED' };
    const date = typeof raw === 'string' ? new Date(raw) : null;
    return date && !Number.isNaN(date.getTime()) ? { value: date } : { code: 'INVALID_FORMAT' };
  }),
  percent: field<number | undefined>((raw) => {
    if (raw === undefined) return { value: undefined };
    if (typeof raw !== 'number' || !Number.isInteger(raw)) return { code: 'INVALID_FORMAT' };
    return raw < 1 || raw > 90 ? { code: 'OUT_OF_RANGE' } : { value: raw };
  }),
  active: sentFlag(),
  validFrom: optionalDate(),
  validUntil: optionalDate(),
  maxRedemptions: optionalCap(),
  oncePerUser: sentFlag(),
});

export const PROMO_SORT_FIELDS = ['code', 'percent', 'used', 'validUntil', 'createdAt'] as const;

export const listPromoSchema = z.object({
  ...pageFields,
  sort: sortField(PROMO_SORT_FIELDS, { field: 'createdAt', direction: 'desc' }),
  // A part of a code; case does not matter.
  q: optionalText(20),
  status: field<(typeof PROMO_STATUSES)[number] | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    return typeof raw === 'string' && (PROMO_STATUSES as readonly string[]).includes(raw)
      ? { value: raw as (typeof PROMO_STATUSES)[number] }
      : { code: 'INVALID_FORMAT' };
  }),
});

