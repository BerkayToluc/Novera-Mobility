import { z } from 'zod';
import { field } from '../../common/zod-fields.js';
import { isUuid } from '../../common/uuid.js';
import { pageFields, sortField } from '../admin-list.js';
import { RESERVATION_STATUSES } from './reservations.view.js';

// The input of the booking endpoints (V2-31, ADMIN.md §3.2). Field problems are the fixed codes of ADR-17.
export const MIN_REASON = 5;
export const MAX_REASON = 500;

// Why an administrator cancels a booking: 5 to 500 characters, written down on the booking. Missing or empty is REQUIRED.
const reason = field<string>((raw) => {
  if (raw === undefined || raw === null) return { code: 'REQUIRED' };
  if (typeof raw !== 'string') return { code: 'INVALID_FORMAT' };
  const value = raw.trim();
  if (value === '') return { code: 'REQUIRED' };
  if (value.length < MIN_REASON) return { code: 'TOO_SHORT' };
  return value.length > MAX_REASON ? { code: 'TOO_LONG' } : { value };
});

export const cancelReservationSchema = z.object({ reason });

export const RESERVATION_SORT_FIELDS = ['startAt', 'createdAt', 'number'] as const;

// A date as people write it, "2026-10-30", that is a real day.
const dayOnly = field<string | null>((raw) => {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { code: 'INVALID_FORMAT' };
  const [year, month, day] = raw.split('-').map(Number) as [number, number, number];
  const real = new Date(Date.UTC(year, month - 1, day));
  const same = real.getUTCFullYear() === year && real.getUTCMonth() === month - 1 && real.getUTCDate() === day;
  return same && year >= 2000 && year <= 2100 ? { value: raw } : { code: 'INVALID_FORMAT' };
});

export const listReservationSchema = z.object({
  ...pageFields,
  sort: sortField(RESERVATION_SORT_FIELDS, { field: 'startAt', direction: 'desc' }),
  // A part of the number or of the customer's e-mail address; case does not matter.
  q: field<string | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    if (typeof raw !== 'string') return { code: 'INVALID_FORMAT' };
    return raw.trim().length > 100 ? { code: 'TOO_LONG' } : { value: raw.trim() || null };
  }),
  status: field<(typeof RESERVATION_STATUSES)[number] | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    return typeof raw === 'string' && (RESERVATION_STATUSES as readonly string[]).includes(raw)
      ? { value: raw as (typeof RESERVATION_STATUSES)[number] }
      : { code: 'INVALID_FORMAT' };
  }),
  // The pick-up branch, by its id; one that does not exist simply finds nothing.
  branch: field<string | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    return isUuid(raw) ? { value: raw } : { code: 'INVALID_FORMAT' };
  }),
  // The days the rental starts on, both included, by the Istanbul calendar.
  from: dayOnly,
  to: dayOnly,
  // The three numbers of the summary (V2-25), as a list: the cards of the administration summary open the list with these, and
  // the list counts the same bookings the card did (it adds `status=CONFIRMED`, as the card counts confirmed bookings only).
  start: field<'today' | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    return raw === 'today' ? { value: 'today' } : { code: 'INVALID_FORMAT' };
  }),
  end: field<'today' | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    return raw === 'today' ? { value: 'today' } : { code: 'INVALID_FORMAT' };
  }),
  created: field<'last7days' | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    return raw === 'last7days' ? { value: 'last7days' } : { code: 'INVALID_FORMAT' };
  }),
});
